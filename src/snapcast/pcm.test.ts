import { describe, expect, it } from 'vitest'
import { decodeInterleaved, frameCount, parseWaveHeader } from './pcm'

/** En-tête RIFF WAVE minimal, tel que snapserver l'envoie pour le codec pcm. */
function waveHeader(sampleRate = 48000, channels = 2, bits = 16, extraChunk = false): Uint8Array {
  const chunks: number[] = []
  const put = (...bytes: number[]) => chunks.push(...bytes)
  const u32 = (v: number) => put(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255)
  const u16 = (v: number) => put(v & 255, (v >> 8) & 255)
  const str = (s: string) => put(...[...s].map((c) => c.charCodeAt(0)))

  str('RIFF')
  u32(0)
  str('WAVE')
  if (extraChunk) {
    // Bloc parasite avant « fmt » : le parcours doit l'enjamber.
    str('JUNK')
    u32(4)
    u32(0)
  }
  str('fmt ')
  u32(16)
  u16(1) // PCM
  u16(channels)
  u32(sampleRate)
  u32((sampleRate * channels * bits) / 8)
  u16((channels * bits) / 8)
  u16(bits)
  return new Uint8Array(chunks)
}

describe('parseWaveHeader', () => {
  it('lit le format annoncé par snapserver', () => {
    expect(parseWaveHeader(waveHeader())).toEqual({
      sampleRate: 48000,
      channels: 2,
      bitsPerSample: 16,
    })
  })

  it('trouve le bloc fmt même s il n est pas en tête', () => {
    expect(parseWaveHeader(waveHeader(44100, 1, 16, true))).toEqual({
      sampleRate: 44100,
      channels: 1,
      bitsPerSample: 16,
    })
  })

  it('refuse un en-tête qui n est pas du RIFF WAVE', () => {
    expect(() => parseWaveHeader(new Uint8Array(20))).toThrow(/RIFF/)
  })
})

describe('decodeInterleaved', () => {
  const format = { sampleRate: 48000, channels: 2, bitsPerSample: 16 }

  it('sépare les canaux entrelacés', () => {
    const payload = new Uint8Array(8)
    const view = new DataView(payload.buffer)
    view.setInt16(0, 1000, true) // trame 0, gauche
    view.setInt16(2, -1000, true) // trame 0, droite
    view.setInt16(4, 2000, true) // trame 1, gauche
    view.setInt16(6, -2000, true) // trame 1, droite

    const [left, right] = decodeInterleaved(payload, format)
    expect(Array.from(left)).toEqual([1000 / 32768, 2000 / 32768])
    expect(Array.from(right)).toEqual([-1000 / 32768, -2000 / 32768])
  })

  it('ramène les valeurs dans [-1, 1]', () => {
    const payload = new Uint8Array(4)
    const view = new DataView(payload.buffer)
    view.setInt16(0, 32767, true)
    view.setInt16(2, -32768, true)

    const [left, right] = decodeInterleaved(payload, format)
    expect(left[0]).toBeLessThanOrEqual(1)
    // -32768 doit donner exactement -1 : c'est pourquoi on divise par 32768.
    expect(right[0]).toBe(-1)
  })

  it('ignore une trame incomplète en fin de tampon', () => {
    const [left] = decodeInterleaved(new Uint8Array(6), format)
    expect(left.length).toBe(1)
  })

  it('refuse une profondeur non gérée', () => {
    expect(() =>
      decodeInterleaved(new Uint8Array(4), { ...format, bitsPerSample: 24 }),
    ).toThrow(/24 bits/)
  })
})

describe('frameCount', () => {
  it('compte les trames selon le format', () => {
    expect(frameCount(48000 * 2 * 2, { sampleRate: 48000, channels: 2, bitsPerSample: 16 })).toBe(
      48000,
    )
  })
})
