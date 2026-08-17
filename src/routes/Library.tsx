import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { AlbumGrid } from '../components/AlbumGrid'
import { useInfiniteScroll } from '../components/useInfiniteScroll'

/**
 * Albums demandes par requete. Le serveur plafonne a 500, mais une page courte
 * arrive plus vite : ce qui compte est que la suivante soit prete avant que le
 * defilement n'atteigne le bas.
 */
const PAGE_SIZE = 60

export function Library() {
  const query = useInfiniteQuery({
    queryKey: ['albums'],
    queryFn: ({ pageParam }) => api.albums({ limit: PAGE_SIZE, offset: pageParam }),
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
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Bibliothèque</h1>
        <span className="text-sm text-neutral-500">
          {albums.length < total ? `${albums.length} sur ${total} albums` : `${total} albums`}
        </span>
      </header>
      <AlbumGrid albums={albums} />
      <div ref={sentinel} aria-hidden className="h-px" />
      {query.isFetchingNextPage && (
        <p className="py-6 text-center text-sm text-neutral-500">Chargement…</p>
      )}
    </>
  )
}
