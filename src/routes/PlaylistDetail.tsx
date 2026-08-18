import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Person, type PlaylistDetail as Detail } from '../api/client'
import { Cover } from '../components/Cover'
import { formatDuration } from '../components/format'
import { usePlayer } from '../player/store'
import { useCurrentSession, useEnqueue, usePlayNowInSession } from '../state/session'

export function PlaylistDetail() {
  const { id } = useParams()
  const playlistId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const playlist = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => api.playlist(playlistId),
  })

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] })
    queryClient.invalidateQueries({ queryKey: ['playlists'] })
  }

  const retirer = useMutation({
    mutationFn: (itemId: number) => api.removeFromPlaylist(playlistId, itemId),
    onSuccess: rafraichir,
  })
  const supprimer = useMutation({
    mutationFn: () => api.deletePlaylist(playlistId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      navigate('/playlists')
    },
  })

  if (playlist.isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (playlist.error)
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-neutral-500">Cette playlist n’existe pas, ou ne vous est pas partagée.</p>
        <Link to="/playlists" className="mt-2 inline-block text-sm text-emerald-400 hover:underline">
          Revenir aux playlists
        </Link>
      </div>
    )

  const data = playlist.data!
  const tracks = data.items.map((item) => item.track)

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Titre playlist={data} onDone={rafraichir} />
          <p className="mt-1 text-sm text-neutral-500">
            {data.track_count} titre{data.track_count > 1 ? 's' : ''}
            {!data.is_owner && ` · de ${data.owner_name}`}
            {!data.is_owner && !data.can_edit && ' · lecture seule'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Lecture tracks={tracks} />
          {data.is_owner && (
            <button
              onClick={() => supprimer.mutate()}
              className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-red-500/60 hover:text-red-300"
            >
              Supprimer
            </button>
          )}
        </div>
      </header>

      {data.items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Playlist vide. Ajoutez-y des titres depuis un album, avec l’icône de playlist.
        </p>
      ) : (
        <ol className="max-w-3xl divide-y divide-neutral-800/60">
          {data.items.map((item) => (
            <li key={item.id} className="group flex items-center gap-3 px-2 py-2">
              <Cover
                albumId={item.track.album_id}
                hasCover={item.track.has_cover}
                className="h-9 w-9 shrink-0 rounded"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-neutral-100">{item.track.title}</div>
                <div className="truncate text-xs text-neutral-500">
                  {item.track.artist_name} · {item.track.album_title}
                  {/* Sur une playlist a plusieurs, savoir d'ou vient un titre
                      qu'on n'a pas mis soi-meme. */}
                  {item.added_by && !data.is_owner && ` · ajouté par ${item.added_by}`}
                </div>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-neutral-600">
                {formatDuration(item.track.duration_s)}
              </span>
              {data.can_edit && (
                <button
                  onClick={() => retirer.mutate(item.id)}
                  title="Retirer de la playlist"
                  aria-label={`Retirer ${item.track.title}`}
                  className="shrink-0 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {data.is_owner && <Partage playlist={data} onDone={rafraichir} />}
    </>
  )
}

function Titre({ playlist, onDone }: { playlist: Detail; onDone: () => void }) {
  const [edition, setEdition] = useState(false)
  const [nom, setNom] = useState(playlist.name)
  const renommer = useMutation({
    mutationFn: () => api.renamePlaylist(playlist.id, nom.trim()),
    onSuccess: () => {
      setEdition(false)
      onDone()
    },
  })

  if (!playlist.is_owner || !edition)
    return (
      <h1
        onDoubleClick={() => playlist.is_owner && setEdition(true)}
        title={playlist.is_owner ? 'Double-cliquer pour renommer' : undefined}
        className="truncate text-2xl font-semibold text-neutral-100"
      >
        {playlist.name}
      </h1>
    )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (nom.trim()) renommer.mutate()
      }}
      className="flex gap-2"
    >
      <input
        autoFocus
        value={nom}
        onChange={(event) => setNom(event.target.value)}
        onBlur={() => setEdition(false)}
        maxLength={120}
        className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-xl text-neutral-100 focus:border-neutral-500 focus:outline-none"
      />
    </form>
  )
}

/** Lire la playlist, ou l'envoyer dans la file — selon qu'on est en session. */
function Lecture({ tracks }: { tracks: Detail['items'][number]['track'][] }) {
  const playQueue = usePlayer((s) => s.playQueue)
  const { data: session } = useCurrentSession()
  const enqueue = useEnqueue()
  const playNowInSession = usePlayNowInSession()
  if (tracks.length === 0) return null

  return (
    <>
      <button
        onClick={() =>
          session
            ? playNowInSession.mutate({ trackIds: tracks.map((t) => t.id), startIndex: 0 })
            : playQueue(tracks, 0)
        }
        className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400"
      >
        Lire
      </button>
      {session && (
        <button
          onClick={() => enqueue.mutate({ track_ids: tracks.map((t) => t.id) })}
          className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500"
        >
          Ajouter à la file
        </button>
      )}
    </>
  )
}

/**
 * Partage, reserve au proprietaire.
 *
 * Partager en ecriture sert a composer a plusieurs, pas a se transmettre la
 * playlist : renommer, supprimer et partager restent au proprietaire.
 */
function Partage({ playlist, onDone }: { playlist: Detail; onDone: () => void }) {
  const people = useQuery({ queryKey: ['people'], queryFn: api.people })
  const partager = useMutation({
    mutationFn: ({ userId, canEdit }: { userId: number; canEdit: boolean }) =>
      api.sharePlaylist(playlist.id, userId, canEdit),
    onSuccess: onDone,
  })
  const retirer = useMutation({
    mutationFn: (userId: number) => api.unsharePlaylist(playlist.id, userId),
    onSuccess: onDone,
  })

  const partages = new Map(playlist.shares.map((share) => [share.user_id, share]))
  // On ne connait que les personnes deja passees : aucune API OIDC standard ne
  // permet de lister les comptes d'un fournisseur.
  const autres = (people.data ?? []).filter((personne: Person) => !partages.has(personne.id))

  return (
    <section className="mt-10 max-w-3xl">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
        Partage
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        En lecture seule, la personne voit la playlist. En lecture et écriture, elle peut aussi y
        ajouter et en retirer des titres — mais pas la renommer, la supprimer ni la repartager.
      </p>

      {playlist.shares.length > 0 && (
        <ul className="mb-3 divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {playlist.shares.map((share) => (
            <li key={share.user_id} className="flex items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">{share.name}</span>
              <select
                value={share.can_edit ? 'ecriture' : 'lecture'}
                onChange={(event) =>
                  partager.mutate({
                    userId: share.user_id,
                    canEdit: event.target.value === 'ecriture',
                  })
                }
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none"
              >
                <option value="lecture">Lecture seule</option>
                <option value="ecriture">Lecture et écriture</option>
              </select>
              <button
                onClick={() => retirer.mutate(share.user_id)}
                title="Ne plus partager"
                aria-label={`Ne plus partager avec ${share.name}`}
                className="shrink-0 text-neutral-600 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {autres.length > 0 ? (
        <select
          value=""
          onChange={(event) =>
            partager.mutate({ userId: Number(event.target.value), canEdit: false })
          }
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        >
          <option value="" disabled>
            Partager avec…
          </option>
          {autres.map((personne) => (
            <option key={personne.id} value={personne.id}>
              {personne.name}
              {personne.email && ` (${personne.email})`}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-neutral-500">
          Personne d’autre à qui partager. Seules les personnes déjà connectées au moins une fois
          apparaissent ici.
        </p>
      )}
    </section>
  )
}
