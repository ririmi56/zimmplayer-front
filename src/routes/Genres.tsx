import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AlbumGrid } from '../components/AlbumGrid'

export function Genres() {
  const [params] = useSearchParams()
  const selected = params.get('g')

  const genres = useQuery({ queryKey: ['genres'], queryFn: api.genres })
  const albums = useQuery({
    queryKey: ['albums', 'genre', selected],
    queryFn: () => api.albums({ genre: selected! }),
    enabled: !!selected,
  })

  if (genres.isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (genres.error) return <p className="text-sm text-red-400">{(genres.error as Error).message}</p>

  if (!genres.data?.length) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-neutral-100">Genres</h1>
        <p className="text-sm text-neutral-500">
          Aucun genre dans le catalogue. Le genre est lu dans les tags des fichiers ; s'il est
          absent, rien ne peut le deviner en réseau airgap.
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold text-neutral-100">Genres</h1>

      <ul className="mb-8 flex flex-wrap gap-2">
        {genres.data.map((genre) => {
          const active = genre.name === selected
          return (
            <li key={genre.name}>
              <Link
                to={active ? '/genres' : `/genres?g=${encodeURIComponent(genre.name)}`}
                className={`inline-flex items-baseline gap-2 rounded-full border px-4 py-1.5 text-sm ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                    : 'border-neutral-700 text-neutral-200 hover:border-neutral-500'
                }`}
              >
                {genre.name}
                <span className="text-xs text-neutral-500">{genre.album_count}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {selected &&
        (albums.isLoading ? (
          <p className="text-sm text-neutral-500">Chargement…</p>
        ) : (
          <AlbumGrid albums={albums.data?.items ?? []} />
        ))}
    </>
  )
}
