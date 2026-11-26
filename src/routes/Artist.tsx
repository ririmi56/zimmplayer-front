import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { AlbumGrid } from '../components/AlbumGrid'
import { TrackList } from '../components/TrackList'
import { splitReleases } from '../components/releases'

export function Artist() {
  const { id } = useParams()
  const artistId = Number(id)
  const { data, isLoading, error } = useQuery({
    queryKey: ['artist', artistId],
    queryFn: () => api.artist(artistId),
  })

  if (isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (error) return <p className="text-sm text-red-400">{(error as Error).message}</p>
  if (!data) return null

  // L'API renvoie toutes les sorties ensemble ; le type permet de separer les
  // albums complets des singles, qui sont chacun un album a part entiere.
  const { albums, singles } = splitReleases(data.albums)

  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold text-neutral-100">{data.name}</h1>

      {albums.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Albums
          </h2>
          <AlbumGrid albums={albums} />
        </section>
      )}

      {singles.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Singles
          </h2>
          <AlbumGrid albums={singles} emptyMessage="Aucun single." />
        </section>
      )}

      {data.appears_on.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Apparaît également sur
          </h2>
          <TrackList tracks={data.appears_on} showAlbum />
        </section>
      )}

      {albums.length === 0 && singles.length === 0 && data.appears_on.length === 0 && (
        <p className="text-sm text-neutral-500">Aucun enregistrement pour cet artiste.</p>
      )}
    </>
  )
}
