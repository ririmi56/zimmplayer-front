import { useInfiniteQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AlbumGrid } from '../components/AlbumGrid'
import { AlbumSortSelect } from '../components/AlbumSortSelect'
import {
  albumSearchParams,
  parseAlbumSort,
  parseFavoris,
  parseReverse,
} from '../components/albumSort'
import { useInfiniteScroll } from '../components/useInfiniteScroll'
import { ICONS, Icon } from '../player/icons'

/**
 * Albums demandes par requete. Le serveur plafonne a 500, mais une page courte
 * arrive plus vite : ce qui compte est que la suivante soit prete avant que le
 * defilement n'atteigne le bas.
 */
const PAGE_SIZE = 60

export function Library() {
  // Le tri vit dans l'URL : il survit a un aller-retour vers un album, se
  // partage tel quel, et le bouton « precedent » retrouve la liste telle
  // qu'elle etait — ce qu'un useState ne donnerait pas.
  const [params, setParams] = useSearchParams()
  const sort = parseAlbumSort(params.get('tri'))
  const reverse = parseReverse(params.get('sens'))
  const favoris = parseFavoris(params.get('favoris'))

  const query = useInfiniteQuery({
    // `sort` dans la cle : sans lui, changer de tri reafficherait les pages
    // deja en cache, triees a l'ancienne. Meme raison pour le filtre.
    queryKey: ['albums', sort, reverse, favoris],
    queryFn: ({ pageParam }) =>
      api.albums({ sort, reverse, favoris, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    // `total` etant renvoye par chaque page, on sait s'arreter sans avoir a
    // deviner d'apres une page incomplete.
    getNextPageParam: (last) => {
      const loaded = last.offset + last.items.length
      return loaded < last.total ? loaded : undefined
    },
  })
  const sentinel = useInfiniteScroll(query)

  if (query.isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (query.error) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>

  const albums = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-100">Bibliothèque</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">
            {albums.length < total ? `${albums.length} sur ${total} albums` : `${total} albums`}
          </span>
          <button
            onClick={() =>
              setParams(albumSearchParams(sort, reverse, !favoris), { replace: true })
            }
            aria-pressed={favoris}
            title={favoris ? 'Afficher tout le catalogue' : 'N’afficher que mes favoris'}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
              favoris
                ? 'border-amber-400/60 text-amber-300'
                : 'border-neutral-700 text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <Icon path={ICONS.star} filled={favoris} className="h-4 w-4" />
            Favoris
          </button>
          {/* `replace` : changer de tri n'est pas une navigation, l'empiler
              obligerait a autant de retours arriere qu'on a essaye de tris. */}
          <AlbumSortSelect
            value={sort}
            reverse={reverse}
            onChange={(next) =>
              setParams(albumSearchParams(next, reverse, favoris), { replace: true })
            }
            onToggleReverse={() =>
              setParams(albumSearchParams(sort, !reverse, favoris), { replace: true })
            }
          />
        </div>
      </header>
      <AlbumGrid albums={albums} />
      <div ref={sentinel} aria-hidden className="h-px" />
      {query.isFetchingNextPage && (
        <p className="py-6 text-center text-sm text-neutral-500">Chargement…</p>
      )}
    </>
  )
}
