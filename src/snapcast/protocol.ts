/**
 * Protocole binaire Snapcast.
 *
 * Réimplémenté à partir de la spécification publique (doc/binary_protocol.md du
 * dépôt Snapcast) et non du code de Snapweb, qui est sous GPL-3.0 : recopier ce
 * dernier propagerait la licence à tout ce projet.
 *
 * Tout est en little-endian. L'en-tête fait 26 octets — s'y tromper ne produit
 * pas une erreur propre : snapserver 0.29 segfaute sur un message malformé.
 */

export const HEADER_SIZE = 26

export const MsgType = {
  CodecHeader: 1,
  WireChunk: 2,
  ServerSettings: 3,
  Time: 4,
  Hello: 5,
  ClientInfo: 7,
  Error: 8,
} as const

export interface Tv {
  sec: number
  usec: number
}

export const tvToMs = (tv: Tv): number => tv.sec * 1000 + tv.usec / 1000

export function msToTv(ms: number): Tv {
  const sec = Math.floor(ms / 1000)
  return { sec, usec: Math.round((ms - sec * 1000) * 1000) }
}

/** Horloge monotone rapportée à l'epoch, seule base saine pour se synchroniser. */
export const nowMs = (): number => performance.timeOrigin + performance.now()

export interface Header {
  type: number
  id: number
  refersTo: number
  sent: Tv
  received: Tv
  size: number
}

export interface ServerSettings {
  bufferMs: number
  latency: number
  volume: number
  muted: boolean
}

export type Message =
  | { kind: 'serverSettings'; header: Header; settings: ServerSettings }
  | { kind: 'codecHeader'; header: Header; codec: string; payload: Uint8Array }
  | { kind: 'wireChunk'; header: Header; timestampMs: number; payload: Uint8Array }
  | { kind: 'time'; header: Header; latencyMs: number }
  | { kind: 'error'; header: Header; message: string }
  | { kind: 'unknown'; header: Header }

function readHeader(view: DataView): Header {
  return {
    type: view.getUint16(0, true),
    id: view.getUint16(2, true),
    refersTo: view.getUint16(4, true),
    sent: { sec: view.getInt32(6, true), usec: view.getInt32(10, true) },
    received: { sec: view.getInt32(14, true), usec: view.getInt32(18, true) },
    size: view.getUint32(22, true),
  }
}

function writeHeader(
  view: DataView,
  type: number,
  id: number,
  sent: Tv,
  bodySize: number,
): void {
  view.setUint16(0, type, true)
  view.setUint16(2, id, true)
  view.setUint16(4, 0, true) // refersTo
  view.setInt32(6, sent.sec, true)
  view.setInt32(10, sent.usec, true)
  view.setInt32(14, 0, true) // received : rempli par le destinataire
  view.setInt32(18, 0, true)
  // `size` désigne le corps seul, sans l'en-tête : c'est ce que la
  // spécification décrit et ce que snapserver émet lui-même.
  view.setUint32(22, bodySize, true)
}

/** Lit une chaîne préfixée de sa longueur sur 4 octets. */
function readSizedBytes(view: DataView, offset: number): { bytes: Uint8Array; next: number } {
  const length = view.getUint32(offset, true)
  const start = offset + 4
  return {
    bytes: new Uint8Array(view.buffer, view.byteOffset + start, length),
    next: start + length,
  }
}

const decoder = new TextDecoder()

export function decodeMessage(buffer: ArrayBuffer): Message | null {
  if (buffer.byteLength < HEADER_SIZE) return null
  const view = new DataView(buffer)
  const header = readHeader(view)
  const body = new DataView(buffer, HEADER_SIZE)

  switch (header.type) {
    case MsgType.ServerSettings: {
      const { bytes } = readSizedBytes(body, 0)
      return { kind: 'serverSettings', header, settings: JSON.parse(decoder.decode(bytes)) }
    }
    case MsgType.CodecHeader: {
      const codec = readSizedBytes(body, 0)
      const payload = readSizedBytes(body, codec.next)
      return {
        kind: 'codecHeader',
        header,
        codec: decoder.decode(codec.bytes),
        payload: payload.bytes,
      }
    }
    case MsgType.WireChunk: {
      const timestamp: Tv = { sec: body.getInt32(0, true), usec: body.getInt32(4, true) }
      const payload = readSizedBytes(body, 8)
      return {
        kind: 'wireChunk',
        header,
        timestampMs: tvToMs(timestamp),
        payload: payload.bytes,
      }
    }
    case MsgType.Time: {
      const latency: Tv = { sec: body.getInt32(0, true), usec: body.getInt32(4, true) }
      return { kind: 'time', header, latencyMs: tvToMs(latency) }
    }
    case MsgType.Error: {
      const { bytes } = readSizedBytes(body, 0)
      return { kind: 'error', header, message: decoder.decode(bytes) }
    }
    default:
      return { kind: 'unknown', header }
  }
}

const encoder = new TextEncoder()

function encodeJson(type: number, payload: unknown, sentMs: number): ArrayBuffer {
  const json = encoder.encode(JSON.stringify(payload))
  const buffer = new ArrayBuffer(HEADER_SIZE + 4 + json.length)
  const view = new DataView(buffer)
  writeHeader(view, type, 0, msToTv(sentMs), 4 + json.length)
  view.setUint32(HEADER_SIZE, json.length, true)
  new Uint8Array(buffer).set(json, HEADER_SIZE + 4)
  return buffer
}

export interface HelloOptions {
  clientId: string
  hostName: string
  clientName: string
  version: string
}

export function encodeHello(options: HelloOptions, sentMs = nowMs()): ArrayBuffer {
  return encodeJson(
    MsgType.Hello,
    {
      MAC: '00:00:00:00:00:00',
      HostName: options.hostName,
      Version: options.version,
      ClientName: options.clientName,
      OS: 'Browser',
      Arch: 'web',
      Instance: 1,
      ID: options.clientId,
      SnapStreamProtocolVersion: 2,
    },
    sentMs,
  )
}

/** Signale au serveur un changement local, notamment le volume. */
export function encodeClientInfo(volume: number, muted: boolean, sentMs = nowMs()): ArrayBuffer {
  return encodeJson(MsgType.ClientInfo, { volume: Math.round(volume), muted }, sentMs)
}

export function encodeTimeRequest(id: number, sentMs = nowMs()): ArrayBuffer {
  const buffer = new ArrayBuffer(HEADER_SIZE + 8)
  const view = new DataView(buffer)
  writeHeader(view, MsgType.Time, id, msToTv(sentMs), 8)
  // Le corps porte `latency`, laissé à zéro dans la requête.
  view.setInt32(HEADER_SIZE, 0, true)
  view.setInt32(HEADER_SIZE + 4, 0, true)
  return buffer
}
