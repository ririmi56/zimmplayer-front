import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServerClock } from './clock'
import { DRIFT_WINDOW } from './drift'
import { SnapPlayer } from './player'

/** En-tête RIFF WAVE minimal, tel que snapserver l'envoie pour le codec pcm. */
function waveHeader(sampleRate = 48000, channels = 2, bits = 16): Uint8Array {
  const chunks: number[] = []
  const put = (...bytes: number[]) => chunks.push(...bytes)
  const u32 = (v: number) => put(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255)
  const u16 = (v: number) => put(v & 255, (v >> 8) & 255)
  const str = (s: string) => put(...[...s].map((c) => c.charCodeAt(0)))

  str('RIFF')
  u32(0)
  str('WAVE')
  str('fmt ')
  u32(16)
  u16(1)
  u16(channels)
  u32(sampleRate)
  u32((sampleRate * channels * bits) / 8)
  u16((channels * bits) / 8)
  u16(bits)
  return new Uint8Array(chunks)
}

/**
 * AudioContext factice dont on pilote `currentTime` a la main : c'est
 * precisement l'ecart entre cette horloge-la et `performance.now()` que le
 * lecteur doit surveiller.
 */
class FakeAudioContext {
  currentTime = 0
  state = 'running'
  destination = {}
  resume = vi.fn(async () => {})
  close = vi.fn(async () => {})
  createGain = () => ({ gain: { setTargetAtTime: vi.fn() }, connect: vi.fn() })
  createBufferSource = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null })
  createBuffer = (channels: number, length: number) => ({
    copyToChannel: vi.fn(),
    length,
    numberOfChannels: channels,
  })
}

describe('SnapPlayer — derive entre horloge systeme et horloge audio', () => {
  let context: FakeAudioContext
  let nowMs: number

  /** Avance les deux horloges independamment, en millisecondes. */
  const advance = (systemMs: number, audioMs: number) => {
    nowMs += systemMs
    context.currentTime += audioMs / 1000
  }

  const chunk = () => new Uint8Array(4 * 100) // 100 trames stereo 16 bits

  beforeEach(() => {
    nowMs = 1_000_000
    context = new FakeAudioContext()
    vi.stubGlobal('AudioContext', function () {
      return context
    })
    vi.stubGlobal('performance', { timeOrigin: 0, now: () => nowMs })
  })

  afterEach(() => vi.unstubAllGlobals())

  async function startedPlayer() {
    const clock = new ServerClock()
    // Decalage serveur nul : seule la derive locale nous interesse ici.
    clock.addSample(0, 0)
    const player = new SnapPlayer(clock, 1000, 0)
    await player.start()
    player.setCodecHeader('pcm', waveHeader())
    return player
  }

  it('ne bouge pas tant que les deux horloges restent proches', async () => {
    const player = await startedPlayer()
    // 10 min de lecture, 5 ms d'ecart accumule : sous le seuil.
    advance(600_000, 599_995)
    expect(Math.abs(player.anchorDriftMs)).toBeCloseTo(5, 0)

    player.enqueue(chunk(), nowMs)
    expect(player.stats.resyncs).toBe(0)
  })

  it("recale l'ancrage quand l'ecart audible SE MAINTIENT", async () => {
    const player = await startedPlayer()
    // Meme duree, mais l'horloge audio a pris 40 ms de retard.
    advance(600_000, 599_960)
    expect(player.anchorDriftMs).toBeCloseTo(40, 0)

    // Une mesure isolee ne decide de rien : il faut une fenetre pleine.
    player.enqueue(chunk(), nowMs)
    expect(player.stats.resyncs).toBe(0)

    // L'ecart se maintient morceau apres morceau : c'est une vraie derive.
    for (let i = 1; i < DRIFT_WINDOW; i++) {
      advance(20, 20)
      player.enqueue(chunk(), nowMs)
    }

    expect(player.stats.resyncs).toBe(1)
    // Apres recalage, les deux horloges racontent de nouveau la meme chose.
    expect(player.anchorDriftMs).toBeCloseTo(0, 3)
  })

  it('ne recale pas sur un a-coup de rendu isole', async () => {
    /**
     * Le defaut du 2026-08-20, reproduit ici. `currentTime` se met en retard
     * par a-coups sous charge — jusqu'a 64 ms mesures sur cette machine —
     * alors que les deux horloges sont en phase. Chaque a-coup pris pour une
     * derive declenchait un recalage, donc un saut de 15 a 20 ms dans un
     * morceau qui en dure 20 : c'est le son hache.
     */
    const player = await startedPlayer()

    for (let i = 0; i < DRIFT_WINDOW * 3; i++) {
      // `currentTime` ne recule jamais : elle STAGNE le temps de trois
      // morceaux, puis rattrape tout d'un coup. La derive mesuree monte donc
      // a 60 ms — bien au-dela du seuil — sans qu'aucune horloge ait derive.
      const rang = i % 20
      const stagne = rang < 3
      const rattrape = rang === 3
      advance(20, stagne ? 0 : rattrape ? 80 : 20)
      player.enqueue(chunk(), nowMs)
    }

    expect(player.stats.resyncs).toBe(0)
  })

  it('une resynchronisation forcee vide ce qui etait programme', async () => {
    const player = await startedPlayer()
    // Un morceau largement dans le futur, donc programme et non jete.
    player.enqueue(chunk(), nowMs)
    expect(player.stats.played).toBe(1)

    player.resync()

    expect(player.stats.resyncs).toBe(1)
    expect(player.anchorDriftMs).toBeCloseTo(0, 3)
  })
})
