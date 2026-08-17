import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useInfiniteScroll } from '../components/useInfiniteScroll'

/** Voir Library.tsx : meme compromis entre latence et nombre de requetes. */
const PAGE_SIZE = 100

export function Artists() {
  const query = useInfiniteQuery({
    queryKey: ['artists'],
    queryFn: ({ pageParam }) => api.artists({ limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const loaded = last.offset + last.items.length
      return loaded < last.total ? loaded : undefined
    },
  })
  const sentinel = useInfiniteScroll(query)

  if (query.isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (query.error) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>

  const artists = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0

  return (
    <>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Artistes</h1>
        <span className="text-sm text-neutral-500">
          {artists.length < total ? `${artists.length} sur ${total} artistes` : `${total} artistes`}
        </span>
      </header>
      <ul className="divide-y divide-neutral-800/60">
        {artists.map((artist) => (
          <li key={artist.id}>
            <Link
              to={`/artists/${artist.id}`}
              className="flex items-baseline justify-between px-2 py-3 text-sm hover:bg-neutral-800/40"
            >
              <span className="text-neutral-100">{artist.name}</span>
              <span className="text-xs text-neutral-500">
                {artist.album_count > 0
                  ? `${artist.album_count} album${artist.album_count > 1 ? 's' : ''}`
                  : 'apparitions'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-px" />
      {query.isFetchingNextPage && (
        <p className="py-6 text-center text-sm text-neutral-500">Chargement…</p>
      )}
    </>
  )
}
