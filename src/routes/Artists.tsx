import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export function Artists() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['artists'],
    queryFn: () => api.artists(),
  })

  if (isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (error) return <p className="text-sm text-red-400">{(error as Error).message}</p>

  return (
    <>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Artistes</h1>
        <span className="text-sm text-neutral-500">{data?.total ?? 0} artistes</span>
      </header>
      <ul className="divide-y divide-neutral-800/60">
        {data?.items.map((artist) => (
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
    </>
  )
}
