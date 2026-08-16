import { nowMs } from './protocol'

/**
 * Estimation du décalage entre l'horloge du serveur et celle du navigateur.
 *
 * Principe, tiré de la spécification Snapcast : le client envoie un message
 * Time horodaté, le serveur répond en indiquant `latency_c2s = t_serveur_reçu −
 * t_client_envoyé`. Le client calcule `latency_s2c = t_client_reçu −
 * t_serveur_envoyé`, et
 *
 *     décalage = (latency_c2s − latency_s2c) / 2
 *
 * ce qui élimine la latence réseau, supposée symétrique.
 *
 * Une mesure isolée est bruitée (ordonnancement, GC, à-coups réseau) : on garde
 * une fenêtre glissante et on retient la **médiane**, insensible aux valeurs
 * aberrantes, là où une moyenne serait tirée par le moindre pic.
 */
export class ServerClock {
  private samples: number[] = []
  private readonly windowSize: number

  constructor(windowSize = 21) {
    this.windowSize = windowSize
  }

  /** Enregistre un aller-retour. Les deux latences sont en millisecondes. */
  addSample(latencyC2sMs: number, latencyS2cMs: number): void {
    this.samples.push((latencyC2sMs - latencyS2cMs) / 2)
    if (this.samples.length > this.windowSize) this.samples.shift()
  }

  /** Décalage retenu : horloge serveur − horloge locale, en millisecondes. */
  get offsetMs(): number {
    if (this.samples.length === 0) return 0
    const sorted = [...this.samples].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2
  }

  get sampleCount(): number {
    return this.samples.length
  }

  /** Vrai quand assez de mesures ont été prises pour lancer la lecture. */
  get isSettled(): boolean {
    return this.samples.length >= 3
  }

  /** Convertit un horodatage serveur en horloge locale. */
  toLocalMs(serverMs: number): number {
    return serverMs - this.offsetMs
  }

  /** Instant local courant, exprimé dans l'horloge du serveur. */
  serverNowMs(): number {
    return nowMs() + this.offsetMs
  }

  reset(): void {
    this.samples = []
  }
}
