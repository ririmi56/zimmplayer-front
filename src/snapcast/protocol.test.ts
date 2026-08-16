import { describe, expect, it } from 'vitest'
import {
  HEADER_SIZE,
  MsgType,
  decodeMessage,
  encodeClientInfo,
  encodeHello,
  encodeTimeRequest,
  msToTv,
  tvToMs,
} from './protocol'

/** Fabrique une trame serveur, pour éprouver le décodage. */
function frame(type: number, body: Uint8Array, sentMs = 0): ArrayBuffer {
  const buffer = new ArrayBuffer(HEADER_SIZE + body.length)
  const view = new DataView(buffer)
  const sent = msToTv(sentMs)
  view.setUint16(0, type, true)
  view.setInt32(6, sent.sec, true)
  view.setInt32(10, sent.usec, true)
  view.setUint32(22, body.length, true)
  new Uint8Array(buffer).set(body, HEADER_SIZE)
  return buffer
}

function sized(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length)
  new DataView(out.buffer).setUint32(0, payload.length, true)
  out.set(payload, 4)
  return out
}

const utf8 = (s: string) => new TextEncoder().encode(s)

describe('en-tête', () => {
  it('fait exactement 26 octets', () => {
    // Une erreur ici fait segfauter snapserver 0.29 : la valeur est verrouillée.
    expect(HEADER_SIZE).toBe(26)
  })

  it('annonce la taille du corps seul, pas celle de la trame entière', () => {
    const buffer = encodeTimeRequest(7)
    const view = new DataView(buffer)
    expect(buffer.byteLength).toBe(HEADER_SIZE + 8)
    expect(view.getUint32(22, true)).toBe(8)
  })

  it('écrit le type et l identifiant en little-endian', () => {
    const view = new DataView(encodeTimeRequest(513))
    expect(view.getUint16(0, true)).toBe(MsgType.Time)
    expect(view.getUint16(2, true)).toBe(513)
  })
})

describe('conversion de temps', () => {
  it('fait l aller-retour sans perte', () => {
    for (const ms of [0, 1, 999, 1000, 1234.567, 1e12]) {
      expect(tvToMs(msToTv(ms))).toBeCloseTo(ms, 3)
    }
  })

  it('sépare correctement secondes et microsecondes', () => {
    expect(msToTv(1500.25)).toEqual({ sec: 1, usec: 500250 })
  })
})

describe('Hello', () => {
  it('porte l identifiant du client, qui le rend visible côté snapserver', () => {
    const buffer = encodeHello({
      clientId: 'navigateur-abc',
      hostName: 'poste',
      clientName: 'Audioplayer',
      version: '0.29.0',
    })
    const view = new DataView(buffer)
    expect(view.getUint16(0, true)).toBe(MsgType.Hello)

    const length = view.getUint32(HEADER_SIZE, true)
    const json = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, HEADER_SIZE + 4, length)),
    )
    expect(json.ID).toBe('navigateur-abc')
    expect(json.SnapStreamProtocolVersion).toBe(2)
    expect(json.Arch).toBe('web')
  })
})

describe('ClientInfo', () => {
  it('remonte le volume au serveur', () => {
    const buffer = encodeClientInfo(42.6, true)
    const view = new DataView(buffer)
    const length = view.getUint32(HEADER_SIZE, true)
    const json = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, HEADER_SIZE + 4, length)),
    )
    expect(json).toEqual({ volume: 43, muted: true })
  })
})

describe('décodage', () => {
  it('lit les réglages du serveur', () => {
    const settings = { bufferMs: 1000, latency: 0, volume: 100, muted: false }
    const message = decodeMessage(
      frame(MsgType.ServerSettings, sized(utf8(JSON.stringify(settings)))),
    )
    expect(message).toMatchObject({ kind: 'serverSettings', settings })
  })

  it('lit l en-tête de codec et sa charge utile', () => {
    const payload = new Uint8Array([1, 2, 3, 4])
    const body = new Uint8Array([...sized(utf8('pcm')), ...sized(payload)])
    const message = decodeMessage(frame(MsgType.CodecHeader, body))

    expect(message?.kind).toBe('codecHeader')
    if (message?.kind !== 'codecHeader') throw new Error('type inattendu')
    expect(message.codec).toBe('pcm')
    expect(Array.from(message.payload)).toEqual([1, 2, 3, 4])
  })

  it('lit un morceau audio et son horodatage serveur', () => {
    const audio = new Uint8Array([9, 8, 7])
    const body = new Uint8Array(8 + 4 + audio.length)
    const view = new DataView(body.buffer)
    view.setInt32(0, 12, true) // timestamp.sec
    view.setInt32(4, 500000, true) // timestamp.usec
    view.setUint32(8, audio.length, true)
    body.set(audio, 12)

    const message = decodeMessage(frame(MsgType.WireChunk, body))
    expect(message?.kind).toBe('wireChunk')
    if (message?.kind !== 'wireChunk') throw new Error('type inattendu')
    expect(message.timestampMs).toBe(12500)
    expect(Array.from(message.payload)).toEqual([9, 8, 7])
  })

  it('lit la latence d un message Time', () => {
    const body = new Uint8Array(8)
    const view = new DataView(body.buffer)
    view.setInt32(0, 0, true)
    view.setInt32(4, 250000, true)
    const message = decodeMessage(frame(MsgType.Time, body))
    expect(message).toMatchObject({ kind: 'time', latencyMs: 250 })
  })

  it('ignore proprement une trame trop courte', () => {
    expect(decodeMessage(new ArrayBuffer(10))).toBeNull()
  })

  it('ne casse pas sur un type inconnu', () => {
    expect(decodeMessage(frame(99, new Uint8Array(0)))?.kind).toBe('unknown')
  })
})
