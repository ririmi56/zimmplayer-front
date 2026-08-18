import type { Track } from '../api/client'
import { ICONS, Icon } from '../player/icons'
import { usePlayer } from '../player/store'
import { useNowPlaying } from '../player/nowPlaying'
import { useCurrentSession, useEnqueue, usePlayNowInSession } from '../state/session'
import { useIdentity } from '../state/identity'
import { AddToPlaylist } from './AddToPlaylist'
import { formatDuration } from './format'

type Props = {
  tracks: Track[]
  /** Affiche l'album de chaque piste (utile hors d'une page d'album). */
  showAlbum?: boolean
  onEdit?: (track: Track) => void
}

export function TrackList({ tracks, showAlbum = false, onEdit }: Props) {
  const playQueue = usePlayer((s) => s.playQueue)
  const localIsPlaying = usePlayer((s) => s.isPlaying)
  const { data: session } = useCurrentSession()
  const nowPlaying = useNowPlaying()
  const playingId = nowPlaying?.id
  const enqueue = useEnqueue()
  const playNowInSession = usePlayNowInSession()
  const inSession = useIdentity((s) => s.sessionId) != null
  const isPlaying = inSession ? (session?.is_playing ?? false) : localIsPlaying

  const play = (position: number) =>
    inSession
      ? playNowInSession.mutate({ trackIds: tracks.map((t) => t.id), startIndex: position })
      : playQueue(tracks, position)

  return (
    <ol className="divide-y divide-neutral-800/60">
      {tracks.map((track, position) => {
        const active = track.id === playingId
        return (
          <li
            key={track.id}
            onDoubleClick={() => play(position)}
            className={`group flex items-center gap-3 px-3 py-2 text-sm ${
              active ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/30'
            }`}
          >
            <button
              onClick={() => play(position)}
              title="Lire"
              className={`w-6 shrink-0 text-right tabular-nums ${
                active ? 'text-emerald-400' : 'text-neutral-500 group-hover:text-neutral-200'
              }`}
            >
              <span className="group-hover:hidden">
                {active && isPlaying ? '▶' : (track.track_no ?? position + 1)}
              </span>
              <span className="hidden group-hover:inline">▶</span>
            </button>

            <div className="min-w-0 flex-1">
              <div className={`truncate ${active ? 'text-emerald-400' : 'text-neutral-100'}`}>
                {track.title}
              </div>
              <div className="truncate text-xs text-neutral-500">
                {track.artist_name}
                {showAlbum && ` · ${track.album_title}`}
              </div>
            </div>

            <span className="shrink-0 text-xs uppercase text-neutral-600">{track.format}</span>
            {inSession && (
              <button
                onClick={() => enqueue.mutate({ track_ids: [track.id] })}
                title="Ajouter à la file"
                aria-label="Ajouter à la file"
                className="shrink-0 text-neutral-500 opacity-0 hover:text-emerald-400 group-hover:opacity-100"
              >
                <Icon path={ICONS.queueAdd} className="h-4 w-4" />
              </button>
            )}
            <AddToPlaylist
              trackIds={[track.id]}
              className="text-neutral-500 opacity-0 hover:text-emerald-400 group-hover:opacity-100"
            />
            {onEdit && (
              <button
                onClick={() => onEdit(track)}
                title="Corriger les métadonnées"
                aria-label="Corriger les métadonnées"
                className="shrink-0 text-neutral-500 opacity-0 hover:text-neutral-200 group-hover:opacity-100"
              >
                <Icon path={ICONS.edit} className="h-4 w-4" />
              </button>
            )}
            <span className="w-12 shrink-0 text-right tabular-nums text-neutral-500">
              {formatDuration(track.duration_s)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
