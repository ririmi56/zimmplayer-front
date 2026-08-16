import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Track } from '../api/client'
import { TrackEditor } from '../components/TrackEditor'
import { Cover } from '../components/Cover'
import { formatDuration } from '../components/format'
import { TrackList } from '../components/TrackList'
import { usePlayer } from '../player/store'
import { useIdentity } from '../state/identity'
import { useEnqueue, usePlayNowInSession } from '../state/session'

export function Album() {
  const { id } = useParams()
  const albumId = Number(id)
  const playQueue = usePlayer((s) => s.playQueue)
  const toggleShuffle = usePlayer((s) => s.toggleShuffle)
  const shuffle = usePlayer((s) => s.shuffle)
  const [editing, setEditing] = useState<Track | null>(null)
  const enqueue = useEnqueue()
  const playNowInSession = usePlayNowInSession()
  const inSession = useIdentity((s) => s.sessionId) != null

  const { data, isLoading, error } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => api.album(albumId),
  })

  if (isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (error) return <p className="text-sm text-red-400">{(error as Error).message}</p>
  if (!data) return null

  const totalSeconds = data.tracks.reduce((sum, t) => sum + (t.duration_s ?? 0), 0)

  return (
    <>
      <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        <Cover
          albumId={data.id}
          hasCover={data.has_cover}
          size="full"
          className="h-48 w-48 shrink-0 rounded-lg shadow-2xl"
          alt={data.title}
        />
        <div className="min-w-0">
          <h1 className="mb-1 text-3xl font-semibold text-neutral-100">{data.title}</h1>
          <p className="mb-4 text-sm text-neutral-400">
            <Link to={`/artists/${data.artist_id}`} className="hover:text-neutral-100 hover:underline">
              {data.artist_name}
            </Link>
            {data.year ? ` · ${data.year}` : ''} · {data.track_count} titre
            {data.track_count > 1 ? 's' : ''} · {formatDuration(totalSeconds)}
            {data.genre && (
              <>
                {' · '}
                <Link
                  to={`/genres?g=${encodeURIComponent(data.genre)}`}
                  className="hover:text-neutral-100 hover:underline"
                >
                  {data.genre}
                </Link>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                inSession
                  ? playNowInSession.mutate({ trackIds: data.tracks.map((t) => t.id), startIndex: 0 })
                  : playQueue(data.tracks, 0)
              }
              disabled={data.tracks.length === 0 || playNowInSession.isPending}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              Lire l'album
            </button>
            {inSession && (
              <button
                onClick={() => enqueue.mutate({ album_id: albumId })}
                disabled={enqueue.isPending}
                className="rounded-full border border-neutral-700 px-5 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
              >
                Ajouter à la file
              </button>
            )}
            {!inSession && (
              <button
                onClick={() => {
                  if (!shuffle) toggleShuffle()
                  playQueue(data.tracks, Math.floor(Math.random() * data.tracks.length))
                }}
                disabled={data.tracks.length === 0}
                className="rounded-full border border-neutral-700 px-5 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
              >
                Aléatoire
              </button>
            )}
          </div>
        </div>
      </header>

      <TrackList tracks={data.tracks} onEdit={setEditing} />

      {editing && <TrackEditor track={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
