import type { Track } from '../api/client'
import { useCurrentSession } from '../state/session'
import { currentTrack, usePlayer } from './store'

/**
 * Piste en cours, quelle que soit la sortie audio.
 *
 * Dans une session, la file partagee fait autorite : c'est ce que tout le
 * monde y voit jouer, synchronise via Snapcast. Hors session, c'est une
 * ecoute solo, et la piste vient du lecteur local.
 */
export function useNowPlaying(): Track | null {
  const { data: session } = useCurrentSession()
  const localTrack = usePlayer(currentTrack)

  if (session) {
    const item = session.items.find((i) => i.id === session.current_item_id)
    return item?.track ?? null
  }
  return localTrack
}
