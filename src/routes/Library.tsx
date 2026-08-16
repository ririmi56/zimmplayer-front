import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { AlbumGrid } from '../components/AlbumGrid'

export function Library() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['albums'],
    queryFn: () => api.albums(),
  })

  if (isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (error) return <p className="text-sm text-red-400">{(error as Error).message}</p>

  return (
    <>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Bibliothèque</h1>
        <span className="text-sm text-neutral-500">{data?.total ?? 0} albums</span>
      </header>
      <AlbumGrid albums={data?.items ?? []} />
    </>
  )
}
