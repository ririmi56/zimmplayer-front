import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Person, type PlaylistDetail as Detail } from '../api/client'
import { Cover } from '../components/Cover'
import { LikeButton } from '../components/LikeButton'
import { formatDuration } from '../components/format'
import { dropTarget } from '../components/queueOrder'
import { ICONS, Icon } from '../player/icons'
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

  const deplacer = useMutation({
    mutationFn: ({ itemId, to }: { itemId: number; to: number }) =>
      api.movePlaylistTrack(playlistId, itemId, to),
    onSuccess: rafraichir,
  })
  const [saisi, setSaisi] = useState<number | null>(null)
  /** Rang d'insertion visé, entre 0 et le nombre de titres. */
  const [depot, setDepot] = useState<number | null>(null)

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

  const tracks = playlist.data?.items.map((item) => item.track) ?? []
  // Avant les retours anticipes : `useLire` appelle des hooks, qui ne
  // supportent pas d'etre sautes selon l'etat du chargement.
  const lire = useLire(tracks)

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

  const annulerDepot = () => {
    setSaisi(null)
    setDepot(null)
  }

  const validerDepot = () => {
    const depart = data.items.findIndex((item) => item.id === saisi)
    if (depart >= 0 && depot !== null) {
      // `dropTarget` compense le retrait prealable : deposer un titre juste
      // apres lui-meme doit le laisser sur place.
      const cible = dropTarget(depart, depot)
      if (cible !== null) deplacer.mutate({ itemId: saisi!, to: cible })
    }
    annulerDepot()
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Titre playlist={data} onDone={rafraichir} />
          <p className="mt-1 text-sm text-neutral-500">
            {data.track_count} titre{data.track_count > 1 ? 's' : ''}
            {!data.is_owner && ` · de ${data.owner_name}`}
            {!data.is_owner && !data.can_edit && ' · consultation'}
            {data.is_public && ' · publique'}
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
          {data.items.map((item, rang) => (
            <li
              key={item.id}
              draggable={data.can_edit}
              onDragStart={(event) => {
                setSaisi(item.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                if (saisi === null) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                // Moitié haute : on insère avant ; moitié basse : après.
                const boite = event.currentTarget.getBoundingClientRect()
                const apres = event.clientY - boite.top > boite.height / 2
                setDepot(apres ? rang + 1 : rang)
              }}
              onDrop={(event) => {
                event.preventDefault()
                validerDepot()
              }}
              onDragEnd={annulerDepot}
              onDoubleClick={() => lire(rang)}
              className={[
                'group flex items-center gap-3 rounded border-y-2 px-2 py-2',
                // Repère d'insertion. Les bordures existent toujours, en
                // transparent : le trait apparaît sans décaler la liste.
                depot === rang ? 'border-t-sky-400' : 'border-t-transparent',
                depot === data.items.length && rang === data.items.length - 1
                  ? 'border-b-sky-400'
                  : 'border-b-transparent',
                item.id === saisi ? 'opacity-40' : '',
              ].join(' ')}
            >
              {/* La pochette fait bouton : c'est l'equivalent du numero de
                  piste d'un album, qui devient ▶ au survol. Double-cliquer la
                  ligne marche aussi, la ou le glisser-deposer n'attend qu'un
                  simple clic. */}
              <button
                onClick={() => lire(rang)}
                title="Lire à partir de ce titre"
                aria-label={`Lire à partir de ${item.track.title}`}
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded"
              >
                <Cover
                  albumId={item.track.album_id}
                  hasCover={item.track.has_cover}
                  className="h-9 w-9"
                />
                <span className="absolute inset-0 hidden items-center justify-center bg-neutral-950/60 text-neutral-100 group-hover:flex">
                  ▶
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-neutral-100">{item.track.title}</div>
                <div className="truncate text-xs text-neutral-500">
                  {item.track.artist_name} · {item.track.album_title}
                  {/* Sur une playlist a plusieurs, savoir d'ou vient un titre
                      qu'on n'a pas mis soi-meme. */}
                  {item.added_by && !data.is_owner && ` · ajouté par ${item.added_by}`}
                </div>
              </div>
              <LikeButton trackId={item.track.id} />
              <span className="shrink-0 text-xs tabular-nums text-neutral-600">
                {formatDuration(item.track.duration_s)}
              </span>
              {data.can_edit && (
                <button
                  title="Déplacer (glisser, ou flèches haut et bas)"
                  aria-label={`Déplacer ${item.track.title}`}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' && rang > 0) {
                      event.preventDefault()
                      deplacer.mutate({ itemId: item.id, to: rang - 1 })
                    }
                    if (event.key === 'ArrowDown' && rang < data.items.length - 1) {
                      event.preventDefault()
                      deplacer.mutate({ itemId: item.id, to: rang + 1 })
                    }
                  }}
                  className="shrink-0 cursor-grab text-neutral-700 opacity-0 hover:text-neutral-200 focus:opacity-100 group-hover:opacity-100"
                >
                  <Icon path={ICONS.dragHandle} className="h-4 w-4" />
                </button>
              )}
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

type Piste = Detail['items'][number]['track']

/**
 * Lancer la playlist a partir d'un titre donne, en session ou en solo.
 *
 * Le meme geste que sur un album : le reste de la playlist suit, dans son
 * ordre. Le bouton « Lire » de l'en-tete n'est que le cas `position = 0`.
 */
function useLire(tracks: Piste[]) {
  const playQueue = usePlayer((s) => s.playQueue)
  const { data: session } = useCurrentSession()
  const playNowInSession = usePlayNowInSession()
  return (position: number) =>
    session
      ? playNowInSession.mutate({ trackIds: tracks.map((t) => t.id), startIndex: position })
      : playQueue(tracks, position)
}

/** Lire la playlist, ou l'envoyer dans la file — selon qu'on est en session. */
function Lecture({ tracks }: { tracks: Piste[] }) {
  const { data: session } = useCurrentSession()
  const enqueue = useEnqueue()
  const lire = useLire(tracks)
  if (tracks.length === 0) return null

  return (
    <>
      <button
        onClick={() => lire(0)}
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
 * Partager en edition sert a composer a plusieurs, pas a se transmettre la
 * playlist : renommer, supprimer et partager restent au proprietaire. Et
 * publier ne partage qu'en consultation — ouvrir l'edition a tout le monde
 * laisserait n'importe qui vider la playlist sans qu'on sache d'ou ca vient.
 */
function Partage({ playlist, onDone }: { playlist: Detail; onDone: () => void }) {
  const people = useQuery({ queryKey: ['people'], queryFn: api.people })
  const publier = useMutation({
    mutationFn: (isPublic: boolean) => api.setPlaylistPublic(playlist.id, isPublic),
    onSuccess: onDone,
  })
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
        En consultation, la personne voit la playlist et l’écoute. En édition, elle peut aussi y
        ajouter et en retirer des titres — mais pas la renommer, la supprimer ni la repartager.
      </p>

      <label className="mb-4 flex max-w-xl cursor-pointer items-start gap-3 rounded-lg border border-neutral-800 px-4 py-3 hover:border-neutral-700">
        <input
          type="checkbox"
          checked={playlist.is_public}
          disabled={publier.isPending}
          onChange={(event) => publier.mutate(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
        />
        <span className="min-w-0">
          <span className="block text-sm text-neutral-100">Playlist publique</span>
          <span className="block text-xs text-neutral-500">
            Tout le monde la trouve dans l’onglet Playlists et peut l’écouter, en consultation
            seulement. Les partages ci-dessous restent les seuls à donner l’édition.
          </span>
        </span>
      </label>

      {playlist.shares.length > 0 && (
        <ul className="mb-3 divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {playlist.shares.map((share) => (
            <li key={share.user_id} className="flex items-center gap-3 px-4 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">{share.name}</span>
              <select
                value={share.can_edit ? 'editer' : 'consulter'}
                onChange={(event) =>
                  partager.mutate({
                    userId: share.user_id,
                    canEdit: event.target.value === 'editer',
                  })
                }
                className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none"
              >
                <option value="consulter">Consulter</option>
                <option value="editer">Éditer</option>
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
