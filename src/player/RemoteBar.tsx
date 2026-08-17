import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cover } from '../components/Cover'
import { formatDuration } from '../components/format'
import { useCurrentSession, useSessionControl } from '../state/session'
import { ICONS, Icon } from './icons'
import { SnapVolume } from './SnapVolume'

/**
 * Barre de lecture en mode Snapcast.
 *
 * Le navigateur est ici les deux a la fois : telecommande du serveur, et
 * snapclient synchronise avec les enceintes si l'on active « Ecouter ici ».
 * La position vient du serveur ; entre deux interrogations on la fait avancer
 * localement pour que la barre reste fluide.
 */
export function RemoteBar({
  lyricsOpen,
  onToggleLyrics,
  queueOpen,
  onToggleQueue,
}: {
  lyricsOpen: boolean
  onToggleLyrics: () => void
  queueOpen: boolean
  onToggleQueue: () => void
}) {
  const { data: session } = useCurrentSession()
  const control = useSessionControl()
  const [drift, setDrift] = useState(0)

  const serverPosition = session?.position_s ?? 0
  const isPlaying = session?.is_playing ?? false

  useEffect(() => setDrift(0), [serverPosition])
  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => setDrift((d) => d + 0.25), 250)
    return () => clearInterval(timer)
  }, [isPlaying, serverPosition])

  const item = session?.items.find((i) => i.id === session.current_item_id) ?? null
  const track = item?.track ?? null
  const total = track?.duration_s ?? 0
  const position = Math.min(serverPosition + drift, total || Infinity)
  const progress = total > 0 ? (position / total) * 100 : 0

  return (
    <footer className="flex h-20 shrink-0 items-center gap-4 border-t border-sky-900/60 bg-neutral-950 px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {track ? (
          <>
            <Cover
              albumId={track.album_id}
              hasCover={track.has_cover}
              className="h-12 w-12 shrink-0 rounded"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-100">{track.title}</div>
              <Link
                to={`/artists/${track.artist_id}`}
                className="truncate text-xs text-neutral-400 hover:text-neutral-200 hover:underline"
              >
                {track.artist_name}
              </Link>
            </div>
          </>
        ) : (
          <span className="text-sm text-neutral-500">File vide</span>
        )}
      </div>

      <div className="flex flex-[2] flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-300">
            Snapcast
          </span>
          <button
            onClick={control.previous}
            title="Précédent"
            className="text-neutral-300 hover:text-white"
          >
            <Icon path={ICONS.previous} filled />
          </button>
          <button
            onClick={isPlaying ? control.pause : control.play}
            disabled={!track}
            title={isPlaying ? 'Pause' : 'Lecture'}
            className="rounded-full bg-white p-2 text-neutral-900 hover:scale-105 disabled:opacity-40"
          >
            <Icon path={isPlaying ? ICONS.pause : ICONS.play} filled={!isPlaying} />
          </button>
          <button
            onClick={control.next}
            title="Suivant"
            className="text-neutral-300 hover:text-white"
          >
            <Icon path={ICONS.next} filled />
          </button>
        </div>

        <div className="flex w-full max-w-xl items-center gap-2">
          <span className="w-10 text-right text-[11px] tabular-nums text-neutral-500">
            {formatDuration(position)}
          </span>
          <input
            type="range"
            min={0}
            max={total || 0}
            step={1}
            value={position}
            disabled={!track || total === 0}
            onChange={(e) => control.seek(Number(e.target.value))}
            aria-label="Position de lecture"
            className="h-1 flex-1 cursor-pointer appearance-none rounded"
            style={{
              background: `linear-gradient(to right, rgb(56 189 248) ${progress}%, rgb(64 64 64) ${progress}%)`,
            }}
          />
          <span className="w-10 text-[11px] tabular-nums text-neutral-500">
            {formatDuration(total)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <button
          onClick={onToggleQueue}
          title="File d'attente"
          aria-pressed={queueOpen}
          className={queueOpen ? 'text-emerald-400' : 'text-neutral-400 hover:text-neutral-100'}
        >
          <Icon path={ICONS.queue} />
        </button>
        <button
          onClick={onToggleLyrics}
          title="Paroles"
          aria-pressed={lyricsOpen}
          className={
            lyricsOpen
              ? 'text-emerald-400'
              : track?.has_lyrics
                ? 'text-neutral-400 hover:text-neutral-100'
                : 'text-neutral-700'
          }
        >
          <Icon path={ICONS.lyrics} />
        </button>
        <SnapVolume />
      </div>
    </footer>
  )
}
