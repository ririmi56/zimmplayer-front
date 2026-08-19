import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ICONS, Icon } from '../player/icons'
import { Cover } from './Cover'
import { LikeButton } from './LikeButton'
import { formatDuration } from './format'
import { dropTarget } from './queueOrder'
import { useCurrentSession, useSessionControl } from '../state/session'
import { type Entry, useQueueEntries } from '../player/queueEntries'

/**
 * La file, en panneau lateral.
 *
 * Affiche la file de la session quand on en a rejoint une, celle du lecteur
 * local sinon : `useQueueEntries` fournit les deux sous la meme forme, et
 * l'onglet Lecture s'en sert deja. Seules restent propres a la session les
 * choses qui n'ont pas de sens en solo — qui a ajoute quoi, et « Tout
 * retirer », que le lecteur local n'expose pas.
 */
export function QueuePanel({ onClose }: { onClose: () => void }) {
  const { data: session, isLoading } = useCurrentSession()
  const control = useSessionControl()
  // Appele avant tout retour anticipe : c'est un hook.
  const entries = useQueueEntries()
  const [dragKey, setDragKey] = useState<Entry['key'] | null>(null)
  /** Rang d'insertion visé, entre 0 et le nombre de titres. */
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  if (control.sessionId != null && (isLoading || !session)) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-neutral-500">Chargement…</p>
      </Panel>
    )
  }

  const cancelDrop = () => {
    setDragKey(null)
    setDropIndex(null)
  }

  const commitDrop = () => {
    const from = entries.findIndex((e) => e.key === dragKey)
    if (from >= 0 && dropIndex != null) {
      const to = dropTarget(from, dropIndex)
      if (to != null) entries[from].move(to)
    }
    cancelDrop()
  }

  return (
    <Panel onClose={onClose} title={session ? session.name : undefined}>
      <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {entries.length} titre{entries.length > 1 ? 's' : ''}
          {session ? ' · diffusé par Snapcast' : ' · écoute locale'}
        </span>
        {session && entries.length > 0 && (
          <button onClick={control.clear} className="hover:text-red-400">
            Tout retirer
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">
          File vide. Utilisez « Ajouter à la file » depuis un album ou un titre.
          {!session && (
            <>
              {' '}
              <Link to="/sessions" className="text-emerald-400 hover:underline">
                Rejoindre une session
              </Link>{' '}
              pour en partager une.
            </>
          )}
        </p>
      ) : (
        <ol>
          {entries.map((entry, index) => {
            const { current, played } = entry
            const dragged = entry.key === dragKey
            return (
              <li
                key={entry.key}
                draggable
                onDragStart={(e) => {
                  setDragKey(entry.key)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (dragKey === null) return
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
                  dropIndex === entries.length && index === entries.length - 1
                    ? 'border-b-sky-400'
                    : 'border-b-transparent',
                  dragged ? 'opacity-40' : '',
                  current ? 'bg-neutral-800/60' : 'hover:bg-neutral-800/30',
                  played && !current ? 'opacity-50' : '',
                ].join(' ')}
              >
                <button
                  onClick={entry.play}
                  title="Lire ce titre"
                  className="shrink-0"
                >
                  <Cover
                    albumId={entry.track.album_id}
                    hasCover={entry.track.has_cover}
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
                    {entry.track.title}
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    {entry.track.artist_name}
                    {entry.addedBy && ` · ajouté par ${entry.addedBy}`}
                  </div>
                </div>

                <LikeButton trackId={entry.track.id} />
                <span className="shrink-0 text-xs tabular-nums text-neutral-600">
                  {formatDuration(entry.track.duration_s)}
                </span>

                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  {/*
                    Le glisser-déposer natif est inaccessible au clavier : cette
                    poignée le double par les flèches haut/bas, ce que faisaient
                    les deux boutons qu'elle remplace.
                  */}
                  <button
                    title="Déplacer (glisser, ou flèches haut et bas)"
                    aria-label={`Déplacer ${entry.track.title}`}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' && index > 0) {
                        e.preventDefault()
                        entry.move(index - 1)
                      }
                      if (e.key === 'ArrowDown' && index < entries.length - 1) {
                        e.preventDefault()
                        entry.move(index + 1)
                      }
                    }}
                    className="cursor-grab text-neutral-600 hover:text-neutral-200"
                  >
                    <Icon path={ICONS.dragHandle} className="h-4 w-4" />
                  </button>
                  <button
                    onClick={entry.remove}
                    title="Retirer de la file"
                    aria-label={`Retirer ${entry.track.title} de la file`}
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
