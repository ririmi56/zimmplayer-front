import { ServerClock } from './clock'
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
export class SnapPlayer {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private format: PcmFormat | null = null
  private scheduled = new Set<AudioBufferSourceNode>()

  /** Ancrage entre l'horloge locale et celle de l'AudioContext. */
  private anchorLocalMs = 0
  private anchorContextTime = 0

  private lateChunks = 0
  private playedChunks = 0

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

  get stats(): { played: number; late: number } {
    return { played: this.playedChunks, late: this.lateChunks }
  }

  /** Doit être appelé depuis un geste utilisateur : politique d'autoplay. */
  async start(): Promise<void> {
    if (this.context === null) {
      this.context = new AudioContext({ latencyHint: 'playback' })
      this.gain = this.context.createGain()
      this.gain.connect(this.context.destination)
    }
    await this.context.resume()
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

  /** Programme un morceau. Renvoie false s'il est arrivé trop tard. */
  enqueue(payload: Uint8Array, timestampServerMs: number): boolean {
    if (!this.context || !this.gain || !this.format) return false

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
