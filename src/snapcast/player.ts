import { ServerClock } from './clock'
import { DRIFT_WINDOW, estimatedDrift } from './drift'
import { decodeInterleaved, parseWaveHeader, type PcmFormat } from './pcm'

/**
 * Lecture des morceaux audio Snapcast dans le navigateur.
 *
 * Chaque morceau porte l'instant serveur auquel il a été capturé. Snapcast
 * demande de le jouer à `horodatage + bufferMs − latence`, converti dans
 * l'horloge locale via le décalage estimé — c'est ce qui met le navigateur en
 * phase avec les enceintes de la maison.
 *
 * Un morceau arrivé trop tard est jeté plutôt que joué en retard : mieux vaut
 * un micro-trou qu'un décalage qui s'installe.
 */

/**
 * Écart toléré entre l'horloge de l'AudioContext et l'horloge locale avant de
 * recaler l'ancrage.
 *
 * Les deux horloges sont pilotées par des quartz différents — celui de la carte
 * son pour l'une, celui du système pour l'autre — et s'écartent donc lentement,
 * de quelques millisecondes par dizaine de minutes. Sans recalage, l'écart
 * grandit indéfiniment : c'est la dérive constatée sur une longue écoute.
 *
 * 15 ms : en dessous du seuil où un décalage entre pièces s'entend.
 *
 * Ce seuil ne s'applique PAS à une mesure isolée. `currentTime` se met en
 * retard sous charge, par à-coups qui dépassent largement 15 ms, et décider
 * sur une mesure unique déclenchait un recalage plusieurs fois par seconde —
 * chacun produisant le trou qu'il était censé éviter. La décision porte donc
 * sur une fenêtre de mesures, voir `drift.ts`.
 */
const MAX_ANCHOR_DRIFT_MS = 15

/**
 * Attente maximale accordée à `AudioContext.resume()`.
 *
 * Autorisé, il rend la main immédiatement. Refusé faute de geste utilisateur,
 * il n'échoue pas : il ne répond jamais. Cette borne transforme ce silence en
 * refus explicite. Large par rapport au cas nominal, pour ne pas déclarer un
 * refus sur une machine simplement lente à ouvrir sa carte son.
 */
const RESUME_TIMEOUT_MS = 500

/**
 * Le navigateur refuse d'ouvrir la sortie audio tant qu'aucun geste
 * utilisateur n'a eu lieu sur la page. Ce n'est pas une panne : il suffit de
 * réessayer au premier clic venu (voir `useSnapclient`).
 */
export class GesteRequis extends Error {
  constructor() {
    super("Le navigateur exige un geste utilisateur pour ouvrir l'audio")
    this.name = 'GesteRequis'
  }
}

export class SnapPlayer {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private format: PcmFormat | null = null
  private scheduled = new Set<AudioBufferSourceNode>()

  /** Ancrage entre l'horloge locale et celle de l'AudioContext. */
  private anchorLocalMs = 0
  private anchorContextTime = 0

  /** Mesures récentes de dérive, pour décider sur autre chose que du bruit. */
  private driftSamples: number[] = []

  private lateChunks = 0
  private playedChunks = 0
  private resyncs = 0

  private readonly clock: ServerClock
  private bufferMs: number
  private latencyMs: number

  constructor(clock: ServerClock, bufferMs = 1000, latencyMs = 0) {
    this.clock = clock
    this.bufferMs = bufferMs
    this.latencyMs = latencyMs
  }

  get isRunning(): boolean {
    return this.context !== null && this.context.state === 'running'
  }

  get stats(): { played: number; late: number; resyncs: number; driftMs: number } {
    return {
      played: this.playedChunks,
      late: this.lateChunks,
      resyncs: this.resyncs,
      driftMs: this.anchorDriftMs,
    }
  }

  /**
   * Écart courant entre les deux horloges, en millisecondes : ce que l'ancrage
   * prédit pour maintenant, moins l'heure réelle de l'AudioContext. Positif =
   * l'AudioContext prend du retard sur l'horloge locale.
   */
  get anchorDriftMs(): number {
    if (!this.context) return 0
    const nowLocalMs = performance.timeOrigin + performance.now()
    return (this.toContextTime(nowLocalMs) - this.context.currentTime) * 1000
  }

  /**
   * Ouvre la sortie audio. Lève `GesteRequis` si le navigateur la refuse.
   *
   * Doit être appelé depuis un geste utilisateur : politique d'autoplay. Sans
   * geste, `resume()` ne rejette PAS — sa promesse reste en attente,
   * indéfiniment. Un simple `await` ne rendait donc jamais la main, et tout ce
   * qui suit le démarrage (l'ouverture de la WebSocket, notamment) n'avait
   * jamais lieu, sans la moindre erreur pour le dire.
   *
   * On borne donc l'attente et on juge sur l'état réel du contexte, seul fait
   * qui compte : `running` ou pas.
   */
  async start(): Promise<void> {
    if (this.context === null) {
      this.context = new AudioContext({ latencyHint: 'playback' })
      this.gain = this.context.createGain()
      this.gain.connect(this.context.destination)
    }
    const attente = new Promise((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS))
    await Promise.race([this.context.resume(), attente])
    if (this.context.state !== 'running') throw new GesteRequis()
    this.reanchor()
  }

  async stop(): Promise<void> {
    for (const node of this.scheduled) {
      try {
        node.stop()
      } catch {
        // déjà terminé
      }
    }
    this.scheduled.clear()
    await this.context?.close()
    this.context = null
    this.gain = null
    this.format = null
  }

  setCodecHeader(codec: string, payload: Uint8Array): void {
    if (codec !== 'pcm') {
      throw new Error(
        `codec « ${codec} » non géré : les flux de l'application sont publiés en pcm`,
      )
    }
    this.format = parseWaveHeader(payload)
  }

  setServerSettings(bufferMs: number, latencyMs: number): void {
    this.bufferMs = bufferMs
    this.latencyMs = latencyMs
  }

  setVolume(volume: number, muted: boolean): void {
    if (this.gain && this.context) {
      this.gain.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.02)
    }
  }

  /** Rattache l'horloge de l'AudioContext à l'horloge locale. */
  private reanchor(): void {
    if (!this.context) return
    this.anchorLocalMs = performance.timeOrigin + performance.now()
    this.anchorContextTime = this.context.currentTime
  }

  private toContextTime(localMs: number): number {
    return this.anchorContextTime + (localMs - this.anchorLocalMs) / 1000
  }

  /**
   * Recale l'ancrage quand les deux horloges ont trop divergé. Appelé à chaque
   * morceau : la mesure ne coûte que deux lectures d'horloge.
   *
   * La correction est un saut, non un glissement : le morceau suivant est
   * programmé jusqu'à 15 ms plus tôt ou plus tard que le précédent ne se
   * termine, ce qui produit un très bref chevauchement ou trou. C'est le prix
   * assumé — rare, puisque la dérive met des minutes à atteindre le seuil, et
   * bien préférable à un décalage qui s'installe pour de bon. `resyncs` compte
   * ces corrections, pour qu'une dérive anormale se voie.
   */
  private correctDrift(): void {
    this.driftSamples.push(this.anchorDriftMs)
    if (this.driftSamples.length > DRIFT_WINDOW) this.driftSamples.shift()

    const drift = estimatedDrift(this.driftSamples)
    if (drift === null || Math.abs(drift) < MAX_ANCHOR_DRIFT_MS) return

    this.reanchor()
    // La fenêtre décrit l'ancrage précédent : la garder ferait re-déclencher
    // aussitôt sur des mesures qui n'ont plus cours.
    this.driftSamples = []
    this.resyncs++
  }

  /**
   * Resynchronisation forcée : jette ce qui est déjà programmé et repart de
   * l'instant présent. Contrairement au recalage automatique, coupe le son le
   * temps que le tampon se reconstitue — à réserver au cas où la lecture est
   * visiblement décalée.
   */
  resync(): void {
    for (const node of this.scheduled) {
      try {
        node.stop()
      } catch {
        // déjà terminé
      }
    }
    this.scheduled.clear()
    this.reanchor()
    this.driftSamples = []
    this.resyncs++
  }

  /** Programme un morceau. Renvoie false s'il est arrivé trop tard. */
  enqueue(payload: Uint8Array, timestampServerMs: number): boolean {
    if (!this.context || !this.gain || !this.format) return false

    // Avant de convertir : un ancrage périmé placerait ce morceau au mauvais
    // instant, et le ferait même juger « en retard » à tort.
    this.correctDrift()

    const playAtServerMs = timestampServerMs + this.bufferMs - this.latencyMs
    const playAtContextTime = this.toContextTime(this.clock.toLocalMs(playAtServerMs))

    // Une marge très courte laisse le temps à l'ordonnanceur audio d'agir.
    if (playAtContextTime <= this.context.currentTime + 0.005) {
      this.lateChunks++
      return false
    }

    const channels = decodeInterleaved(payload, this.format)
    const buffer = this.context.createBuffer(
      this.format.channels,
      channels[0].length,
      this.format.sampleRate,
    )
    for (let channel = 0; channel < channels.length; channel++) {
      buffer.copyToChannel(channels[channel], channel)
    }

    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)
    source.onended = () => this.scheduled.delete(source)
    source.start(playAtContextTime)

    this.scheduled.add(source)
    this.playedChunks++
    return true
  }
}
