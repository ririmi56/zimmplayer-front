import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { toggleId } from './toggleId'

/**
 * Les albums que j'ai mis en favori, charges une fois pour toute l'application.
 *
 * Meme forme que `useLikes`, et pour la meme raison : `AlbumOut` est assemble
 * par le catalogue, la recherche et les pages d'artiste, qui n'ont aucune
 * raison de connaitre la personne connectee. Une seule liste d'identifiants
 * suffit, et l'etoile la consulte partout ou elle apparait.
 */
export function useFavorites() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['favorites'],
    queryFn: api.favorites,
    staleTime: 5 * 60_000,
  })
  const favoris = new Set(data ?? [])

  const basculer = useMutation({
    mutationFn: (albumId: number) =>
      favoris.has(albumId) ? api.unfavorite(albumId) : api.favorite(albumId),
    // Reponse immediate : attendre l'aller-retour ferait clignoter l'etoile,
    // et on en marque souvent plusieurs a la suite.
    onMutate: (albumId: number) => {
      queryClient.setQueryData<number[]>(['favorites'], (avant = []) =>
        toggleId(avant, albumId),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
      // Le classement « Les plus mis en favoris » et le filtre se calculent au
      // serveur : sans ceci, la bibliotheque garderait son etat d'avant le clic
      // — et retirer un favori laisserait l'album dans la liste filtree.
      queryClient.invalidateQueries({ queryKey: ['albums'] })
    },
  })

  return { favoris, basculer: basculer.mutate }
}
