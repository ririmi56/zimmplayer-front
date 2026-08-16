import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AlbumGrid } from '../components/AlbumGrid'
import { TrackList } from '../components/TrackList'

export function Search() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length > 0,
  })

  if (!q) return <p className="text-sm text-neutral-500">Saisissez un terme de recherche.</p>
  if (isLoading) return <p className="text-sm text-neutral-500">Recherche…</p>

  const empty =
    !data || (data.artists.length === 0 && data.albums.length === 0 && data.tracks.length === 0)

  if (empty) {
    return <p className="text-sm text-neutral-500">Aucun résultat pour « {q} ».</p>
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold text-neutral-100">Résultats pour « {q} »</h1>

      {data.artists.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Artistes
          </h2>
          <ul className="flex flex-wrap gap-2">
            {data.artists.map((artist) => (
              <li key={artist.id}>
                <Link
                  to={`/artists/${artist.id}`}
                  className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-200 hover:border-neutral-500"
                >
                  {artist.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.albums.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Albums
          </h2>
          <AlbumGrid albums={data.albums} />
        </section>
      )}

      {data.tracks.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Titres
          </h2>
          <TrackList tracks={data.tracks} showAlbum />
        </section>
      )}
    </div>
  )
}
