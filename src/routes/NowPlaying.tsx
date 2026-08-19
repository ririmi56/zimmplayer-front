import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { coverUrl } from '../api/client'
import { AddToPlaylist } from '../components/AddToPlaylist'
import { Cover } from '../components/Cover'
import { LikeButton } from '../components/LikeButton'
import { formatDuration, formatSpan } from '../components/format'
import { dropTarget } from '../components/queueOrder'
import { resumer } from '../components/queueSummary'
import { ICONS, Icon } from '../player/icons'
import { useNowPlaying } from '../player/nowPlaying'
import { type Entry, useQueueEntries } from '../player/queueEntries'
import { useCurrentSession } from '../state/session'

/**
 * Onglet « Lecture » : ce qui joue, en grand.
 *
 * La pochette sert deux fois — nette au premier plan, floutée et assombrie en
 * fond — ce qui donne à la page la couleur de l'album sans rien avoir à
 * calculer ni à stocker.
 *
 * Volontairement sans barre de progression ni commandes : elles sont déjà en
 * bas de l'écran, en permanence et à deux centimètres. Cette page répond à
 * « qu'est-ce qui joue, et qu'est-ce qui suit », pas à « où en est-on ».
 */
export function NowPlaying() {
  const track = useNowPlaying()
  const entries = useQueueEntries()
  const { data: session } = useCurrentSession()

  if (!track) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-neutral-500">Rien en cours de lecture.</p>
        <Link to="/" className="mt-2 inline-block text-sm text-emerald-400 hover:underline">
          Parcourir la bibliothèque
        </Link>
      </div>
    )
  }

  const details = [
    track.genre,
    track.format?.toUpperCase(),
    track.duration_s != null ? formatDuration(track.duration_s) : null,
    track.bitrate != null ? `${Math.round(track.bitrate / 1000)} kbit/s` : null,
  ].filter(Boolean)

  const upcoming = entries.filter((entry) => !entry.played && !entry.current).length

  return (
    // Déborde le rembourrage de <main> pour que le fond aille jusqu'aux bords.
    <div className="relative -mx-8 -my-6 min-h-full px-8 py-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {track.has_cover && (
          <img
            src={coverUrl(track.album_id, 'full')}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-40 blur-3xl"
          />
        )}
        {/* Le dégradé rattrape la couleur du fond de l'application en bas de la
            page : sans lui, l'image floutée s'arrête net avec le contenu. */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/30 via-neutral-900/75 to-neutral-900" />
      </div>

      <div className="relative">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
          <Cover
            albumId={track.album_id}
            hasCover={track.has_cover}
            size="full"
            alt={track.album_title}
            className="aspect-square w-56 shrink-0 rounded-xl shadow-2xl shadow-black/60 sm:w-64"
          />

          <div className="min-w-0">
            <span className="text-xs uppercase tracking-wide text-neutral-400">
              {session ? (
                <>
                  Session <span className="text-sky-300">{session.name}</span> · diffusé par
                  Snapcast
                </>
              ) : (
                'Écoute locale, sur ce navigateur'
              )}
            </span>
            <div className="mt-2 flex items-start gap-3">
              <h1 className="text-3xl font-semibold leading-tight text-neutral-50 sm:text-4xl">
                {track.title}
              </h1>
              {/* Le meme bouton que dans les listes de titres : depuis ici on
                  garde ce qu'on est en train d'ecouter sans repasser par
                  l'album. */}
              <LikeButton
                trackId={track.id}
                size="h-5 w-5"
                className="mt-2 rounded-full border border-neutral-700 p-2 hover:border-neutral-500"
              />
              <AddToPlaylist
                trackIds={[track.id]}
                className="mt-2 rounded-full border border-neutral-700 p-2 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
              />
            </div>
            <Link
              to={`/artists/${track.artist_id}`}
              className="mt-2 inline-block text-lg text-neutral-300 hover:text-neutral-100 hover:underline"
            >
              {track.artist_name}
            </Link>
            <div className="mt-1 text-sm text-neutral-400">
              <Link to={`/albums/${track.album_id}`} className="hover:text-neutral-200 hover:underline">
                {track.album_title}
              </Link>
            </div>
            {details.length > 0 && (
              <div className="mt-4 text-xs text-neutral-500">{details.join(' · ')}</div>
            )}
            {track.has_lyrics && (
              <div className="mt-1 text-xs text-neutral-500">Paroles disponibles</div>
            )}
          </div>
        </div>

        {entries.length > 0 && <Queue entries={entries} upcoming={upcoming} />}
      </div>
    </div>
  )
}


/** Hauteur de la boite, en pixels : environ huit lignes de 48 px. */
const QUEUE_HEIGHT = 'h-96'

/**
 * La file, dans une boite a hauteur fixe qui defile toute seule.
 *
 * Une file de soixante titres etirait la page sur plusieurs ecrans, et le
 * titre en cours s'y perdait. Ici la boite ne bouge pas et c'est son contenu
 * qui se recale : le titre joue reste au centre, quelques titres passes
 * au-dessus, la suite en dessous.
 */
function Queue({ entries, upcoming }: { entries: Entry[]; upcoming: number }) {
  const resume = resumer(
    entries.map((e) => ({ played: e.played, current: e.current, duration_s: e.track.duration_s })),
  )
  const list = useRef<HTMLOListElement>(null)
  const current = useRef<HTMLLIElement>(null)
  // Le premier placement est instantane : arriver sur la page en voyant la
  // liste glisser depuis le haut donnerait l'impression d'un chargement.
  const placed = useRef(false)

  const currentKey = entries.find((entry) => entry.current)?.key

  const [dragKey, setDragKey] = useState<Entry['key'] | null>(null)
  /** Rang d'insertion visé, entre 0 et le nombre de titres. */
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const cancelDrop = () => {
    setDragKey(null)
    setDropIndex(null)
  }

  const commitDrop = () => {
    const from = entries.findIndex((entry) => entry.key === dragKey)
    if (from >= 0 && dropIndex !== null) {
      const to = dropTarget(from, dropIndex)
      if (to !== null) entries[from].move(to)
    }
    cancelDrop()
  }

  useEffect(() => {
    const box = list.current
    const item = current.current
    if (!box || !item) return
    // `offsetTop` est mesure depuis la boite (d'ou `relative` sur le <ol>) et
    // ne depend pas du defilement en cours : recentrer deux fois de suite ne
    // derive donc pas.
    const top = item.offsetTop - (box.clientHeight - item.clientHeight) / 2
    const smooth =
      placed.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    box.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    placed.current = true
  }, [currentKey])

  return (
    <section className="mt-12 max-w-5xl">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          File d'attente
          <span className="ml-2 font-normal normal-case tracking-normal text-neutral-500">
            {upcoming > 0 ? `${upcoming} titre${upcoming > 1 ? 's' : ''} à suivre` : 'fin de file'}
          </span>
        </h2>
        <p className="text-xs text-neutral-500">
          {resume.total} titre{resume.total > 1 ? 's' : ''}
          {' · '}
          {resume.joues} lu{resume.joues > 1 ? 's' : ''}
          {' · '}
          {/* Le total complet en survol : l'afficher en permanence ferait deux
              durées côte à côte, qu'on confondrait. */}
          <span
            title={`${formatSpan(resume.totalSecondes)} en tout`}
            className="cursor-help underline decoration-dotted underline-offset-2"
          >
            {formatSpan(resume.restantSecondes)} restantes
          </span>
        </p>
      </div>
      <ol
        ref={list}
        className={`${QUEUE_HEIGHT} relative overflow-y-auto rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-1 pr-2`}
      >
        {entries.map((entry, index) => (
          <li
            key={entry.key}
            ref={entry.current ? current : undefined}
            draggable
            onDragStart={(event) => {
              setDragKey(entry.key)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
              if (dragKey === null) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              // Moitié haute : on insère avant ; moitié basse : après.
              const box = event.currentTarget.getBoundingClientRect()
              const after = event.clientY - box.top > box.height / 2
              setDropIndex(after ? index + 1 : index)
            }}
            onDrop={(event) => {
              event.preventDefault()
              commitDrop()
            }}
            onDragEnd={cancelDrop}
            onDoubleClick={entry.play}
            className={[
              'group flex items-center gap-3 rounded border-y-2 px-2 py-1.5',
              // Repère d'insertion. Les bordures existent toujours, en
              // transparent : le trait apparaît sans décaler la liste.
              dropIndex === index ? 'border-t-sky-400' : 'border-t-transparent',
              dropIndex === entries.length && index === entries.length - 1
                ? 'border-b-sky-400'
                : 'border-b-transparent',
              entry.key === dragKey ? 'opacity-40' : '',
              entry.current ? 'bg-neutral-800/60' : 'hover:bg-neutral-800/30',
              entry.played && !entry.current ? 'opacity-50' : '',
            ].join(' ')}
          >
            <button onClick={entry.play} title="Lire ce titre" className="shrink-0">
              <Cover
                albumId={entry.track.album_id}
                hasCover={entry.track.has_cover}
                className="h-9 w-9 rounded"
              />
            </button>
            <div className="min-w-0 flex-1">
              <div
                className={`truncate text-sm ${
                  entry.current
                    ? 'text-emerald-400'
                    : entry.played
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
            {/*
              Le glisser-déposer natif est inaccessible au clavier : cette
              poignée le double par les flèches haut et bas.
            */}
            <button
              title="Déplacer (glisser, ou flèches haut et bas)"
              aria-label={`Déplacer ${entry.track.title}`}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' && index > 0) {
                  event.preventDefault()
                  entry.move(index - 1)
                }
                if (event.key === 'ArrowDown' && index < entries.length - 1) {
                  event.preventDefault()
                  entry.move(index + 1)
                }
              }}
              className="shrink-0 cursor-grab text-neutral-700 opacity-0 hover:text-neutral-200 focus:opacity-100 group-hover:opacity-100"
            >
              <Icon path={ICONS.dragHandle} className="h-4 w-4" />
            </button>
            <button
              onClick={entry.remove}
              title="Retirer de la file"
              aria-label={`Retirer ${entry.track.title} de la file`}
              className="shrink-0 text-neutral-700 opacity-0 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
