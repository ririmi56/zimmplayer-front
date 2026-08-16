import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Cover } from '../components/Cover'
import { useNowPlaying } from './nowPlaying'

/**
 * Paroles de la piste en cours.
 *
 * Le contenu n'est jamais inclus dans les listes de pistes : il est chargé ici
 * seulement, via /api/tracks/{id}/lyrics, et uniquement si la piste en annonce.
 */
export function LyricsPanel({ onClose }: { onClose: () => void }) {
  const track = useNowPlaying()

  const { data, isLoading } = useQuery({
    queryKey: ['lyrics', track?.id],
    queryFn: () => api.lyrics(track!.id),
    enabled: !!track?.id && !!track?.has_lyrics,
    staleTime: Infinity,
  })

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">Paroles</h2>
        <button
          onClick={onClose}
          aria-label="Fermer les paroles"
          className="text-neutral-500 hover:text-neutral-200"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!track ? (
          <p className="text-sm text-neutral-500">Aucune lecture en cours.</p>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <Cover
                albumId={track.album_id}
                hasCover={track.has_cover}
                className="h-14 w-14 shrink-0 rounded"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-neutral-100">{track.title}</div>
                <div className="truncate text-xs text-neutral-500">{track.artist_name}</div>
              </div>
            </div>

            {!track.has_lyrics ? (
              <p className="text-sm text-neutral-500">
                Aucune parole dans les métadonnées de ce fichier.
              </p>
            ) : isLoading ? (
              <p className="text-sm text-neutral-500">Chargement…</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                {data?.lyrics}
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
