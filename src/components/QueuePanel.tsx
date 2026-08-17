import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ICONS, Icon } from '../player/icons'
import { Cover } from './Cover'
import { formatDuration } from './format'
import { dropTarget } from './queueOrder'
import { useCurrentSession, useSessionControl } from '../state/session'

export function QueuePanel({ onClose }: { onClose: () => void }) {
  const { data: session, isLoading } = useCurrentSession()
  const control = useSessionControl()
  const [dragId, setDragId] = useState<number | null>(null)
  /** Rang d'insertion visé, entre 0 et le nombre de titres. */
  const [dropIndex, setDropIndex] = useState<number | null>(null)

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

  const currentIndex =
    session.current_item_id != null
      ? session.items.findIndex((i) => i.id === session.current_item_id)
      : -1

  const cancelDrop = () => {
    setDragId(null)
    setDropIndex(null)
  }

  const commitDrop = () => {
    const from = session.items.findIndex((i) => i.id === dragId)
    if (dragId != null && from >= 0 && dropIndex != null) {
      const to = dropTarget(from, dropIndex)
      if (to != null) control.move(dragId, to)
    }
    cancelDrop()
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
        <ol>
          {session.items.map((item, index) => {
            const current = item.id === session.current_item_id
            // La file est une playlist ordonnée avec un pointeur : ce qui
            // précède le titre courant a donc déjà été joué. Grisé, pas retiré
            // — c'est ce qui donne le retour arrière et la relecture.
            const played = currentIndex >= 0 && index < currentIndex
            const dragged = item.id === dragId
            return (
              <li
                key={item.id}
                draggable
                onDragStart={(e) => {
                  setDragId(item.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (dragId == null) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  // Moitié haute : on insère avant ; moitié basse : après.
                  const box = e.currentTarget.getBoundingClientRect()
                  const after = e.clientY - box.top > box.height / 2
                  setDropIndex(after ? index + 1 : index)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  commitDrop()
                }}
                onDragEnd={cancelDrop}
                className={[
                  'group flex items-center gap-2 rounded border-y-2 px-2 py-1.5',
                  // Repère d'insertion. Les bordures existent toujours, en
                  // transparent : le trait apparaît sans décaler la liste.
                  dropIndex === index ? 'border-t-sky-400' : 'border-t-transparent',
                  dropIndex === session.items.length && index === session.items.length - 1
                    ? 'border-b-sky-400'
                    : 'border-b-transparent',
                  dragged ? 'opacity-40' : '',
                  current ? 'bg-neutral-800/60' : 'hover:bg-neutral-800/30',
                  played && !current ? 'opacity-50' : '',
                ].join(' ')}
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
                      current
                        ? 'text-emerald-400'
                        : played
                          ? 'text-neutral-500'
                          : 'text-neutral-100'
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

                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  {/*
                    Le glisser-déposer natif est inaccessible au clavier : cette
                    poignée le double par les flèches haut/bas, ce que faisaient
                    les deux boutons qu'elle remplace.
                  */}
                  <button
                    title="Déplacer (glisser, ou flèches haut et bas)"
                    aria-label={`Déplacer ${item.track.title}`}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' && index > 0) {
                        e.preventDefault()
                        control.move(item.id, index - 1)
                      }
                      if (e.key === 'ArrowDown' && index < session.items.length - 1) {
                        e.preventDefault()
                        control.move(item.id, index + 1)
                      }
                    }}
                    className="cursor-grab text-neutral-600 hover:text-neutral-200"
                  >
                    <Icon path={ICONS.dragHandle} className="h-4 w-4" />
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
