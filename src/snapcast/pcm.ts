/** Format audio décrit par l'en-tête de codec PCM (un en-tête RIFF WAVE). */
export interface PcmFormat {
  sampleRate: number
  channels: number
  bitsPerSample: number
}

const ascii = (view: DataView, offset: number, length: number): string =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('')

/**
 * Lit le format dans l'en-tête RIFF WAVE envoyé par snapserver pour le codec
 * `pcm`. On parcourt les blocs plutôt que de supposer que « fmt » est à
 * l'offset 12 : rien ne l'impose et un bloc supplémentaire décalerait tout.
 */
export function parseWaveHeader(header: Uint8Array): PcmFormat {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)

  if (header.byteLength < 12 || ascii(view, 0, 4) !== 'RIFF' || ascii(view, 8, 4) !== 'WAVE') {
    throw new Error('en-tête PCM invalide : RIFF/WAVE attendu')
  }

  let offset = 12
  while (offset + 8 <= header.byteLength) {
    const id = ascii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ') {
      return {
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      }
    }
    // Les blocs RIFF sont alignés sur 2 octets.
    offset += 8 + size + (size % 2)
  }
  throw new Error('en-tête PCM invalide : bloc « fmt » introuvable')
}

/**
 * Convertit du PCM entrelacé en canaux séparés de flottants, tels que les
 * attend l'API Web Audio.
 */
export function decodeInterleaved(
  payload: Uint8Array,
  format: PcmFormat,
): Float32Array<ArrayBuffer>[] {
  if (format.bitsPerSample !== 16) {
    throw new Error(`profondeur non gérée : ${format.bitsPerSample} bits`)
  }

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  const frames = Math.floor(payload.byteLength / (2 * format.channels))
  const channels = Array.from(
    { length: format.channels },
    () => new Float32Array(new ArrayBuffer(frames * 4)),
  )

  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < format.channels; channel++) {
      const sample = view.getInt16((frame * format.channels + channel) * 2, true)
      // 32768 et non 32767 : la plage int16 est asymétrique.
      channels[channel][frame] = sample / 32768
    }
  }
  return channels
}

export const frameCount = (byteLength: number, format: PcmFormat): number =>
  Math.floor(byteLength / ((format.bitsPerSample / 8) * format.channels))
