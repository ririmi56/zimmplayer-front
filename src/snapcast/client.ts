import { ServerClock } from './clock'
import { SnapPlayer } from './player'
import {
  decodeMessage,
  encodeClientInfo,
  encodeHello,
  encodeTimeRequest,
  nowMs,
  tvToMs,
  type ServerSettings,
} from './protocol'

export type SnapState = 'idle' | 'connecting' | 'syncing' | 'playing' | 'error'

export interface SnapStatus {
  state: SnapState
  error: string | null
  offsetMs: number
  samples: number
  played: number
  late: number
  /** Écart courant entre horloge locale et AudioContext (voir SnapPlayer). */
  driftMs: number
  /** Recalages d'ancrage, automatiques ou forcés, depuis le démarrage. */
  resyncs: number
}

const SYNC_FAST_MS = 500
const SYNC_SLOW_MS = 5000
/** Rythme rapide au démarrage, le temps de stabiliser l'estimation. */
const FAST_SYNC_COUNT = 8

/**
 * Le navigateur en tant que snapclient.
 *
 * Il se connecte au relais de l'API (`/api/snapcast/stream`), s'annonce avec le
 * message Hello — c'est ce qui le fait apparaître dans les groupes de
 * snapserver, au même titre qu'une enceinte — puis synchronise son horloge et
 * joue les morceaux reçus.
 */
export class SnapcastClient {
  private socket: WebSocket | null = null
  private readonly clock = new ServerClock()
  private readonly player: SnapPlayer
  private timeTimer: number | null = null
  private timeRequestId = 0
  private pendingTimeRequests = new Map<number, number>()
  private syncCount = 0
  private reconnectTimer: number | null = null
  private closedByUs = false

  private status: SnapStatus = {
    state: 'idle',
    error: null,
    offsetMs: 0,
    samples: 0,
    played: 0,
    late: 0,
    driftMs: 0,
    resyncs: 0,
  }

  private readonly url: string
  private readonly clientId: string
  private readonly clientName: string
  private readonly onStatus: (status: SnapStatus) => void

  constructor(
    url: string,
    clientId: string,
    clientName: string,
    onStatus: (status: SnapStatus) => void,
  ) {
    this.url = url
    this.clientId = clientId
    this.clientName = clientName
    this.onStatus = onStatus
    this.player = new SnapPlayer(this.clock)
  }

  private update(patch: Partial<SnapStatus>): void {
    this.status = {
      ...this.status,
      ...patch,
      offsetMs: this.clock.offsetMs,
      samples: this.clock.sampleCount,
      ...this.player.stats,
    }
    this.onStatus(this.status)
  }

  /** À appeler depuis un geste utilisateur : l'audio ne démarre pas sans. */
  async start(): Promise<void> {
    this.closedByUs = false
    await this.player.start()
    this.connect()
  }

  async stop(): Promise<void> {
    this.closedByUs = true
    this.clearTimers()
    this.socket?.close()
    this.socket = null
    await this.player.stop()
    this.clock.reset()
    this.update({ state: 'idle', error: null })
  }

  /**
   * Resynchronisation forcée, à la main de l'utilisateur.
   *
   * Le recalage d'ancrage automatique (voir `SnapPlayer.correctDrift`) traite
   * la dérive ordinaire sans qu'on s'en aperçoive. Cette méthode-ci va plus
   * loin : elle jette aussi l'estimation du décalage d'horloge et la reconstruit
   * au rythme rapide du démarrage. C'est le recours quand l'estimation elle-même
   * est fausse — après une mise en veille, un changement de réseau, ou tout
   * simplement quand la lecture s'entend décalée.
   *
   * Le son se coupe le temps de reprendre trois mesures, soit ~1,5 s.
   */
  resync(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    this.clock.reset()
    this.player.resync()
    if (this.timeTimer !== null) window.clearTimeout(this.timeTimer)
    this.pendingTimeRequests.clear()
    this.syncCount = 0
    this.scheduleTimeSync(0)
    this.update({ state: 'syncing', error: null })
  }

  setVolume(volume: number, muted: boolean): void {
    this.player.setVolume(volume, muted)
    // Le serveur doit connaître notre volume pour l'afficher dans la liste des
    // membres et pour que le mixage par groupe reste cohérent.
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(encodeClientInfo(volume * 100, muted))
    }
  }

  private connect(): void {
    this.update({ state: 'connecting', error: null })

    const socket = new WebSocket(this.url)
    socket.binaryType = 'arraybuffer'
    this.socket = socket

    socket.onopen = () => {
      socket.send(
        encodeHello({
          clientId: this.clientId,
          hostName: this.clientName,
          clientName: 'Zimmplayer Web',
          version: '0.29.0',
        }),
      )
      this.syncCount = 0
      this.scheduleTimeSync(0)
      this.update({ state: 'syncing' })
    }

    socket.onmessage = (event) => this.onMessage(event.data as ArrayBuffer)

    socket.onerror = () => this.update({ state: 'error', error: 'connexion au flux impossible' })

    socket.onclose = () => {
      this.clearTimers()
      if (this.closedByUs) return
      this.update({ state: 'connecting', error: 'connexion perdue, nouvelle tentative…' })
      this.reconnectTimer = window.setTimeout(() => this.connect(), 2000)
    }
  }

  private scheduleTimeSync(delayMs: number): void {
    this.timeTimer = window.setTimeout(() => {
      this.sendTimeRequest()
      this.syncCount++
      this.scheduleTimeSync(this.syncCount < FAST_SYNC_COUNT ? SYNC_FAST_MS : SYNC_SLOW_MS)
    }, delayMs)
  }

  private sendTimeRequest(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    const id = (this.timeRequestId = (this.timeRequestId + 1) % 65536)
    const sentMs = nowMs()
    this.pendingTimeRequests.set(id, sentMs)
    // Les requêtes sans réponse ne doivent pas s'accumuler indéfiniment.
    if (this.pendingTimeRequests.size > 32) {
      this.pendingTimeRequests.delete(this.pendingTimeRequests.keys().next().value!)
    }
    this.socket.send(encodeTimeRequest(id, sentMs))
  }

  private onMessage(data: ArrayBuffer): void {
    const message = decodeMessage(data)
    if (!message) return

    switch (message.kind) {
      case 'serverSettings': {
        const settings: ServerSettings = message.settings
        this.player.setServerSettings(settings.bufferMs, settings.latency)
        this.player.setVolume(settings.volume / 100, settings.muted)
        break
      }

      case 'codecHeader':
        try {
          this.player.setCodecHeader(message.codec, message.payload)
        } catch (error) {
          this.update({ state: 'error', error: (error as Error).message })
        }
        break

      case 'time': {
        const sentMs = this.pendingTimeRequests.get(message.header.refersTo)
        if (sentMs === undefined) break
        this.pendingTimeRequests.delete(message.header.refersTo)

        // latency_c2s est renvoyé par le serveur ; latency_s2c se calcule ici.
        const latencyC2s = message.latencyMs
        const latencyS2c = nowMs() - tvToMs(message.header.sent)
        this.clock.addSample(latencyC2s, latencyS2c)
        this.update({})
        break
      }

      case 'wireChunk':
        // Tant que l'horloge n'est pas stabilisée, jouer produirait un décalage
        // audible avec les enceintes : on laisse passer les premiers morceaux.
        if (!this.clock.isSettled) break
        this.player.enqueue(message.payload, message.timestampMs)
        if (this.status.state !== 'playing') this.update({ state: 'playing' })
        break

      case 'error':
        this.update({ state: 'error', error: message.message })
        break
    }
  }

  private clearTimers(): void {
    if (this.timeTimer !== null) window.clearTimeout(this.timeTimer)
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    this.timeTimer = this.reconnectTimer = null
    this.pendingTimeRequests.clear()
  }
}

/** Identifiant stable du navigateur, celui sous lequel snapserver le voit. */
export function browserClientId(): string {
  const key = 'audioplayer.snapclient.id'
  let id = localStorage.getItem(key)
  if (!id) {
    // `crypto.randomUUID` n'existe qu'en contexte sécurisé : absent dès qu'on
    // ouvre l'application sur `http://<ip>`. `getRandomValues` est disponible
    // partout.
    const bytes = crypto.getRandomValues(new Uint8Array(4))
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    id = `web-${hex}`
    localStorage.setItem(key, id)
  }
  return id
}

/**
 * Un navigateur, identifie par ce prefixe (voir `browserClientId`) : son nom
 * Snapcast vient du pseudo choisi en Configuration, pas d'un renommage
 * independant — a l'arrivee d'OIDC, ce sera la meme source, juste imposee.
 */
export function isBrowserClient(clientId: string): boolean {
  return clientId.startsWith('web-')
}
