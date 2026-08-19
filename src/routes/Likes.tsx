import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { TrackList } from '../components/TrackList'

/**
 * Mes titres aimes, le dernier en premier.
 *
 * Reutilise `TrackList` : c'est la meme liste qu'ailleurs, avec les memes
 * actions — dont le coeur, qui permet d'en retirer un d'ici.
 */
export function Likes() {
  const { data, isLoading } = useQuery({ queryKey: ['likedTracks'], queryFn: api.likedTracks })

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-100">Mes likes</h1>
        {data && data.length > 0 && (
          <p className="mt-1 text-sm text-neutral-500">
            {data.length} titre{data.length > 1 ? 's' : ''}
          </p>
        )}
      </header>

      {isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}

      {data && data.length === 0 && (
        <p className="text-sm text-neutral-500">
          Aucun titre aimé pour l’instant. Le cœur apparaît sur chaque titre —{' '}
          <Link to="/" className="text-emerald-400 hover:underline">
            parcourez la bibliothèque
          </Link>
          .
        </p>
      )}

      {data && data.length > 0 && <TrackList tracks={data} showAlbum />}
    </>
  )
}
