import { Link } from 'react-router-dom'
import { Cover } from './Cover'
import { formatDuration } from './format'
import { useCurrentSession, useSessionControl } from '../state/session'

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const { data: session, isLoading } = useCurrentSession()
  const control = useSessionControl()

  if (control.sessionId == null) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-neutral-500">
          Aucune session rejointe.{' '}
          <Link to="/sessions" className="text-emerald-400 hover:underline">
            En rejoindre une
          </Link>{' '}
          pour partager une file d'attente.
        </p>
      </Panel>
    )
  }

  if (isLoading || !session) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-neutral-500">Chargement…</p>
      </Panel>
    )
  }

  return (
    <Panel onClose={onClose} title={session.name}>
      <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {session.items.length} titre{session.items.length > 1 ? 's' : ''} · diffusé par Snapcast
        </span>
        {session.items.length > 0 && (
          <button onClick={control.clear} className="hover:text-red-400">
            Tout retirer
          </button>
        )}
      </div>

      {session.items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          File vide. Utilisez « Ajouter à la file » depuis un album ou un titre.
        </p>
      ) : (
        <ol className="space-y-1">
          {session.items.map((item, index) => {
            const current = item.id === session.current_item_id
            return (
              <li
                key={item.id}
                className={`group flex items-center gap-2 rounded px-2 py-1.5 ${
                  current ? 'bg-neutral-800/60' : 'hover:bg-neutral-800/30'
                }`}
              >
                <button
                  onClick={() => control.playItem(item.id)}
                  title="Lire ce titre"
                  className="shrink-0"
                >
                  <Cover
                    albumId={item.track.album_id}
                    hasCover={item.track.has_cover}
                    className="h-9 w-9 rounded"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-sm ${
                      current ? 'text-emerald-400' : 'text-neutral-100'
                    }`}
                  >
                    {item.track.title}
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    {item.track.artist_name} · ajouté par {item.added_by}
                  </div>
                </div>

                <span className="shrink-0 text-xs tabular-nums text-neutral-600">
                  {formatDuration(item.track.duration_s)}
                </span>

                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => control.move(item.id, Math.max(0, index - 1))}
                    disabled={index === 0}
                    title="Monter"
                    className="text-neutral-500 hover:text-neutral-200 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => control.move(item.id, index + 1)}
                    disabled={index === session.items.length - 1}
                    title="Descendre"
                    className="text-neutral-500 hover:text-neutral-200 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => control.remove(item.id)}
                    title="Retirer"
                    className="text-neutral-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function Panel({
  children,
  onClose,
  title = "File d'attente",
}: {
  children: React.ReactNode
  onClose: () => void
  title?: string
}) {
  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="truncate text-sm font-medium uppercase tracking-wide text-neutral-400">
          {title}
        </h2>
        <button
          onClick={onClose}
          aria-label="Fermer la file"
          className="text-neutral-500 hover:text-neutral-200"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{children}</div>
    </aside>
  )
}
