import { useCurrentSession, useSessionControl } from '../state/session'
import type { Track } from '../api/client'
import { usePlayer } from './store'

/** Une entrée de la file, indépendamment de la source qui la fournit. */
export type Entry = {
  key: string | number
  track: Track
  addedBy?: string
  played: boolean
  current: boolean
  play: () => void
  /** Depose cette entree au rang `to` de la file. */
  move: (to: number) => void
  remove: () => void
}

/**
 * File à afficher, quelle que soit la sortie : celle de la session si l'on en a
 * rejoint une, celle du lecteur local sinon.
 *
 * « Déjà joué » se lit dans l'ordre de lecture, pas dans l'ordre d'affichage :
 * en aléatoire, le local suit `order`, sans quoi le grisage désignerait des
 * titres encore à venir.
 */
export function useQueueEntries(): Entry[] {
  const { data: session } = useCurrentSession()
  const control = useSessionControl()
  const queue = usePlayer((s) => s.queue)
  const index = usePlayer((s) => s.index)
  const shuffle = usePlayer((s) => s.shuffle)
  const order = usePlayer((s) => s.order)
  const playQueue = usePlayer((s) => s.playQueue)
  const move = usePlayer((s) => s.move)
  const remove = usePlayer((s) => s.remove)

  if (session) {
    const currentIndex = session.items.findIndex((i) => i.id === session.current_item_id)
    return session.items.map((item, position) => ({
      key: item.id,
      track: item.track,
      addedBy: item.added_by,
      played: currentIndex >= 0 && position < currentIndex,
      current: item.id === session.current_item_id,
      play: () => control.playItem(item.id),
      move: (to) => control.move(item.id, to),
      remove: () => control.remove(item.id),
    }))
  }

  const positions = shuffle && order.length === queue.length ? order : queue.map((_, i) => i)
  const rank = new Map(positions.map((queueIndex, r) => [queueIndex, r]))
  const currentRank = rank.get(index) ?? 0

  return queue.map((track, position) => ({
    key: position,
    track,
    played: (rank.get(position) ?? 0) < currentRank,
    current: position === index,
    play: () => playQueue(queue, position),
    move: (to) => move(position, to),
    remove: () => remove(position),
  }))
}
