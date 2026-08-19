import { create } from 'zustand'
import type { Track } from '../api/client'
import { moveItem, remapAfterMove, remapAfterRemove } from '../components/queueOrder'

export type RepeatMode = 'off' | 'all' | 'one'

type PlayerState = {
  queue: Track[]
  index: number
  isPlaying: boolean
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  /** Position et duree, alimentees par l'element <audio>. */
  currentTime: number
  duration: number
  /** Ordre de lecture aleatoire ; vide quand shuffle est desactive. */
  order: number[]

  playQueue: (tracks: Track[], startIndex?: number) => void
  playNow: (track: Track) => void
  enqueue: (tracks: Track[]) => void
  move: (from: number, to: number) => void
  remove: (position: number) => void
  togglePlay: () => void
  next: (auto?: boolean) => void
  previous: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setProgress: (currentTime: number, duration: number) => void
  seekTo: number | null
  requestSeek: (seconds: number) => void
  clearSeek: () => void
}

const shuffled = (length: number, keepFirst: number) => {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== keepFirst)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return [keepFirst, ...rest]
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: 0,
  isPlaying: false,
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: 'off',
  currentTime: 0,
  duration: 0,
  order: [],
  seekTo: null,

  playQueue: (tracks, startIndex = 0) =>
    set({
      queue: tracks,
      index: startIndex,
      isPlaying: tracks.length > 0,
      currentTime: 0,
      duration: 0,
      order: get().shuffle ? shuffled(tracks.length, startIndex) : [],
    }),

  playNow: (track) => get().playQueue([track], 0),

  enqueue: (tracks) => {
    const { queue } = get()
    if (queue.length === 0) return get().playQueue(tracks, 0)
    set({ queue: [...queue, ...tracks] })
  },

  /**
   * Reordonne la file sans changer ce qui joue.
   *
   * `index` et `order` designent des RANGS de `queue` : les laisser tels quels
   * apres un deplacement ferait basculer la lecture sur un autre titre, et
   * l'aleatoire en rejouerait certains en en sautant d'autres. On les remappe
   * donc tous les deux, ce qui preserve exactement la sequence de lecture — on
   * a change l'affichage, pas ce qui va suivre.
   */
  move: (from, to) => {
    const { queue, index, order } = get()
    const valid = (i: number) => i >= 0 && i < queue.length
    if (from === to || !valid(from) || !valid(to)) return
    set({
      queue: moveItem(queue, from, to),
      index: remapAfterMove(from, to, index),
      order: order.map((i) => remapAfterMove(from, to, i)),
    })
  },

  /**
   * Retire un titre de la file.
   *
   * Meme remappage que `move` : `index` et `order` designent des rangs de
   * `queue`. Retirer le titre EN COURS enchaine sur le suivant dans l'ordre de
   * lecture, comme le fait le serveur pour une file partagee
   * (`queue.remove_item`) ; en bout de file il n'y a rien a enchainer, et la
   * lecture s'arrete. On ne reboucle pas, meme en repeat : retirer un titre
   * n'est pas la fin d'un morceau.
   */
  remove: (position) => {
    const { queue, index, order, shuffle, isPlaying } = get()
    if (position < 0 || position >= queue.length) return

    const nextQueue = queue.filter((_, i) => i !== position)
    const nextOrder = order
      .map((i) => remapAfterRemove(position, i))
      .filter((i): i is number => i !== null)

    if (nextQueue.length === 0) {
      return set({ queue: [], index: 0, order: [], isPlaying: false, currentTime: 0, duration: 0 })
    }

    if (position !== index) {
      return set({
        queue: nextQueue,
        order: nextOrder,
        index: remapAfterRemove(position, index)!,
      })
    }

    const positions = shuffle && order.length === queue.length ? order : queue.map((_, i) => i)
    const suivant = positions[positions.indexOf(position) + 1]
    set({
      queue: nextQueue,
      order: nextOrder,
      index: suivant === undefined ? 0 : remapAfterRemove(position, suivant)!,
      isPlaying: suivant !== undefined && isPlaying,
      currentTime: 0,
      duration: 0,
    })
  },

  togglePlay: () => {
    if (get().queue.length === 0) return
    set({ isPlaying: !get().isPlaying })
  },

  // `auto` distingue la fin naturelle d'un morceau d'un clic sur "suivant" :
  // seule la premiere doit s'arreter en fin de file quand repeat vaut 'off'.
  next: (auto = false) => {
    const { queue, index, repeat, shuffle, order } = get()
    if (queue.length === 0) return
    if (auto && repeat === 'one') return set({ seekTo: 0, isPlaying: true })

    const positions = shuffle && order.length === queue.length ? order : queue.map((_, i) => i)
    const current = positions.indexOf(index)
    const isLast = current === positions.length - 1

    if (isLast && repeat === 'off') {
      return set({ isPlaying: false, seekTo: 0, currentTime: 0 })
    }
    const nextIndex = positions[(current + 1) % positions.length]
    set({ index: nextIndex, isPlaying: true, currentTime: 0, duration: 0 })
  },

  previous: () => {
    const { queue, index, currentTime, shuffle, order } = get()
    if (queue.length === 0) return
    // Reflexe attendu d'un lecteur : au-dela de 3 s, "precedent" rembobine.
    if (currentTime > 3) return set({ seekTo: 0 })

    const positions = shuffle && order.length === queue.length ? order : queue.map((_, i) => i)
    const current = positions.indexOf(index)
    const previousIndex = positions[(current - 1 + positions.length) % positions.length]
    set({ index: previousIndex, isPlaying: true, currentTime: 0, duration: 0 })
  },

  setVolume: (volume) => set({ volume, muted: volume === 0 }),
  toggleMute: () => set({ muted: !get().muted }),

  toggleShuffle: () => {
    const { shuffle, queue, index } = get()
    set({ shuffle: !shuffle, order: !shuffle ? shuffled(queue.length, index) : [] })
  },

  cycleRepeat: () => {
    const order: RepeatMode[] = ['off', 'all', 'one']
    set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] })
  },

  setProgress: (currentTime, duration) => set({ currentTime, duration }),
  requestSeek: (seconds) => set({ seekTo: seconds }),
  clearSeek: () => set({ seekTo: null }),
}))

export const currentTrack = (state: PlayerState) => state.queue[state.index] ?? null
