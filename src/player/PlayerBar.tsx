import { Link } from 'react-router-dom'
import { Cover } from '../components/Cover'
import { formatDuration } from '../components/format'
import { ICONS, Icon } from './icons'
import { currentTrack, usePlayer } from './store'

export function PlayerBar({
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
  const track = usePlayer(currentTrack)
  const {
    isPlaying, currentTime, duration, volume, muted, shuffle, repeat,
    togglePlay, next, previous, setVolume, toggleMute, toggleShuffle, cycleRepeat, requestSeek,
  } = usePlayer()

  const total = duration || track?.duration_s || 0
  const progress = total > 0 ? (currentTime / total) * 100 : 0

  return (
    <footer className="flex h-20 shrink-0 items-center gap-4 border-t border-neutral-800 bg-neutral-950 px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {track ? (
          <>
            <Cover
              albumId={track.album_id}
              hasCover={track.has_cover}
              className="h-12 w-12 shrink-0 rounded"
              alt=""
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
          <span className="text-sm text-neutral-500">Aucune lecture en cours</span>
        )}
      </div>

      <div className="flex flex-[2] flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleShuffle}
            title="Lecture aléatoire"
            aria-pressed={shuffle}
            className={shuffle ? 'text-emerald-400' : 'text-neutral-400 hover:text-neutral-100'}
          >
            <Icon path={ICONS.shuffle} />
          </button>
          <button onClick={previous} title="Précédent" className="text-neutral-300 hover:text-white">
            <Icon path={ICONS.previous} filled />
          </button>
          <button
            onClick={togglePlay}
            disabled={!track}
            title={isPlaying ? 'Pause' : 'Lecture'}
            className="rounded-full bg-white p-2 text-neutral-900 hover:scale-105 disabled:opacity-40"
          >
            <Icon path={isPlaying ? ICONS.pause : ICONS.play} filled={!isPlaying} />
          </button>
          <button onClick={() => next()} title="Suivant" className="text-neutral-300 hover:text-white">
            <Icon path={ICONS.next} filled />
          </button>
          <button
            onClick={cycleRepeat}
            title={`Répétition : ${repeat}`}
            className={repeat === 'off' ? 'text-neutral-400 hover:text-neutral-100' : 'text-emerald-400'}
          >
            <span className="relative">
              <Icon path={ICONS.repeat} />
              {repeat === 'one' && (
                <span className="absolute -right-1 -top-1 text-[9px] font-bold">1</span>
              )}
            </span>
          </button>
        </div>

        <div className="flex w-full max-w-xl items-center gap-2">
          <span className="w-10 text-right text-[11px] tabular-nums text-neutral-500">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={total || 0}
            step={0.1}
            value={currentTime}
            disabled={!track || total === 0}
            onChange={(e) => requestSeek(Number(e.target.value))}
            aria-label="Position de lecture"
            className="h-1 flex-1 cursor-pointer appearance-none rounded bg-neutral-700 accent-emerald-400"
            style={{
              background: `linear-gradient(to right, rgb(52 211 153) ${progress}%, rgb(64 64 64) ${progress}%)`,
            }}
          />
          <span className="w-10 text-[11px] tabular-nums text-neutral-500">
            {formatDuration(total)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
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
        <button onClick={toggleMute} title="Couper le son" className="text-neutral-400 hover:text-neutral-100">
          <Icon path={muted || volume === 0 ? ICONS.mute : ICONS.volume} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="h-1 w-24 cursor-pointer appearance-none rounded bg-neutral-700 accent-emerald-400"
        />
      </div>
    </footer>
  )
}
