import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { toggleId } from './toggleId'

/**
 * Les titres que j'aime, charges une fois pour toute l'application.
 *
 * `TrackOut` ne porte pas d'indicateur « aime » : il est assemble par le
 * catalogue, les playlists et les sessions, qui n'ont aucune raison de
 * connaitre la personne connectee. Une seule liste d'identifiants suffit
 * donc, et le bouton la consulte partout ou il apparait.
 */
export function useLikes() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['likes'],
    queryFn: api.likes,
    staleTime: 5 * 60_000,
  })
  const likes = new Set(data ?? [])

  const basculer = useMutation({
    mutationFn: (trackId: number) =>
      likes.has(trackId) ? api.unlike(trackId) : api.like(trackId),
    // Reponse immediate : attendre l'aller-retour ferait clignoter le coeur,
    // et on clique souvent plusieurs titres a la suite.
    onMutate: (trackId: number) => {
      queryClient.setQueryData<number[]>(['likes'], (avant = []) => toggleId(avant, trackId))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['likes'] })
      // Le classement « Les plus aimés » se calcule au serveur : sans ceci,
      // la bibliotheque garderait son ordre d'avant le clic.
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['likedTracks'] })
    },
  })

  return { likes, basculer: basculer.mutate }
}
