import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type SessionSummary, type SnapClient, type SnapGroup } from '../api/client'
import { browserClientId, isBrowserClient } from '../snapcast/client'
import { useAuth } from '../state/auth'
import { apartStream, groupOf, planMove } from './snapMove'

type Member = { client: SnapClient; group: SnapGroup }

/**
 * Valeur du choix « à part » dans le selecteur.
 *
 * Une sentinelle, et non l'identifiant du flux ou l'on range ces appareils :
 * celui-ci depend des sessions existantes, alors que le choix, lui, est
 * toujours le meme.
 */
const APART = 'apart'

/**
 * De quoi proposer une destination sur chaque ligne.
 *
 * Rassemble en un objet ce que le selecteur reclame, plutot que de faire
 * descendre cinq props a travers `SessionCluster` : la liste des sessions, le
 * flux ou ranger un appareil qui n'en ecoute aucune, qui a le droit de
 * deplacer quoi, et l'appel lui-meme.
 */
type MoveUi = {
  sessions: SessionSummary[]
  apartStreamId: string | null
  /** On se deplace toujours soi-meme ; deplacer autrui demande le role. */
  allowed: (clientId: string) => boolean
  onMove: (clientId: string, streamId: string) => void
  pending: boolean
}

/**
 * Membres Snapcast, regroupes par session — n'importe laquelle, pas seulement
 * celle que ce navigateur a lui-meme rejointe : la liste doit rester correcte
 * meme pour un poste d'administration qui n'ecoute rien.
 *
 * Pas de notion de zone nommee ni de flux a choisir a la main : un groupe
 * Snapcast n'est qu'un detail d'implementation pour synchroniser des
 * appareils entre eux, ce qui compte ici est seulement d'etre avec une
 * session donnee ou pas.
 */
export function SnapMembers() {
  const queryClient = useQueryClient()
  /**
   * Snapserver n'oublie jamais un client : une enceinte debranchee, un
   * navigateur ferme, un poste renomme y restent indefiniment. La liste
   * accumule donc des fantomes, et c'est presque toujours l'etat present qui
   * interesse — d'ou ce filtre, actif par defaut.
   */
  const [enLigneSeulement, setEnLigneSeulement] = useState(true)
  // Le navigateur est lui-meme un snapclient : il se reconnait par son
  // identifiant, sans que personne ait a le declarer.
  const myClientId = browserClientId()

  const status = useQuery({
    queryKey: ['snapcast-status'],
    queryFn: api.snapcastStatus,
    refetchInterval: 3000,
  })
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: api.sessions, refetchInterval: 5000 })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['snapcast-status'] })

  // Sans OIDC, personne n'est distingue : tout le monde est administrateur.
  const auth = useAuth()
  const estAdmin = !auth.oidc_enabled || auth.role === 'admin'

  const deplacer = useMutation({
    mutationFn: async ({ clientId, streamId }: { clientId: string; streamId: string }) => {
      const plan = planMove(status.data?.groups ?? [], clientId, streamId)
      switch (plan.kind) {
        case 'none':
          return
        case 'join':
          await api.setGroupClients(plan.groupId, plan.clientIds)
          return
        case 'retarget':
          await api.setGroupStream(plan.groupId, plan.streamId)
          return
        case 'detach': {
          // Le groupe neuf n'existe qu'apres cet appel : son identifiant se lit
          // dans la reponse, pas avant.
          const apres = await api.setGroupClients(plan.groupId, plan.keep)
          const neuf = groupOf(apres, clientId)
          if (!neuf) throw new Error("Snapserver n'a pas dit où il a placé cet appareil.")
          await api.setGroupStream(neuf, plan.streamId)
        }
      }
    },
    onSuccess: refresh,
  })

  if (status.isLoading || sessions.isLoading) {
    return <p className="text-sm text-neutral-500">Chargement…</p>
  }

  if (!status.data?.connected) {
    return (
      <p className="rounded-lg border border-neutral-800 px-4 py-3 text-sm text-neutral-400">
        {status.data?.error
          ? `Snapserver injoignable — ${status.data.error}`
          : 'Snapcast est désactivé.'}
      </p>
    )
  }

  const tous: Member[] = status.data.groups.flatMap((group) =>
    group.clients.map((client) => ({ client, group })),
  )
  const horsLigne = tous.filter((m) => !m.client.connected).length
  const members = enLigneSeulement ? tous.filter((m) => m.client.connected) : tous

  if (tous.length === 0) {
    return <p className="text-sm text-neutral-500">Aucun client Snapcast connu.</p>
  }

  const sessionList = sessions.data ?? []
  const bySession = sessionList.map((session) => ({
    session,
    members: members.filter((m) => m.group.stream_id === session.snapcast_stream_id),
  }))
  const claimed = new Set(bySession.flatMap((b) => b.members.map((m) => m.client.id)))
  const apart = members.filter((m) => !claimed.has(m.client.id))

  const move: MoveUi = {
    sessions: sessionList,
    apartStreamId: apartStream(
      status.data.streams,
      sessionList.map((s) => s.snapcast_stream_id),
    ),
    allowed: (clientId) => estAdmin || clientId === myClientId,
    onMove: (clientId, streamId) => deplacer.mutate({ clientId, streamId }),
    pending: deplacer.isPending,
  }

  return (
    <div className="space-y-6">
      {deplacer.error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {(deplacer.error as Error).message}
        </p>
      )}

      <Filtre
        enLigneSeulement={enLigneSeulement}
        onChange={setEnLigneSeulement}
        horsLigne={horsLigne}
        total={tous.length}
      />

      {members.length === 0 && (
        <p className="text-sm text-neutral-500">
          Aucun client en ligne. {horsLigne} connu{horsLigne > 1 ? 's' : ''} de snapserver, tous
          hors ligne.
        </p>
      )}

      {bySession.map(({ session, members: inSession }) => (
        <SessionCluster
          key={session.id}
          session={session}
          members={inSession}
          myClientId={myClientId}
          move={move}
          onChanged={refresh}
        />
      ))}

      {apart.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            À part ({apart.length})
          </h3>
          <ul className="divide-y divide-neutral-800/60 rounded-lg border border-neutral-800 bg-neutral-950">
            {apart.map((m) => (
              <ClientRow
                key={m.client.id}
                member={m}
                isMe={m.client.id === myClientId}
                playing={m.group.stream_id}
                move={move}
                onChanged={refresh}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Bascule entre tous les clients et les seuls presents.
 *
 * Le nombre de clients masques est affiche : sans lui, un filtre actif par
 * defaut donnerait l'impression qu'une enceinte a disparu de la configuration
 * alors qu'elle est seulement eteinte.
 */
function Filtre({
  enLigneSeulement,
  onChange,
  horsLigne,
  total,
}: {
  enLigneSeulement: boolean
  onChange: (valeur: boolean) => void
  horsLigne: number
  total: number
}) {
  const options: [boolean, string][] = [
    [true, `En ligne (${total - horsLigne})`],
    [false, `Tous (${total})`],
  ]
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex rounded-full border border-neutral-700 p-0.5">
        {options.map(([valeur, libelle]) => (
          <button
            key={String(valeur)}
            onClick={() => onChange(valeur)}
            aria-pressed={enLigneSeulement === valeur}
            className={`rounded-full px-3 py-1 text-xs ${
              enLigneSeulement === valeur
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>
      {enLigneSeulement && horsLigne > 0 && (
        <span className="text-xs text-neutral-500">
          {horsLigne} hors ligne masqué{horsLigne > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

function SessionCluster({
  session,
  members,
  myClientId,
  move,
  onChanged,
}: {
  session: SessionSummary
  members: Member[]
  myClientId: string | null
  move: MoveUi
  onChanged: () => void
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        Session « {session.name} » {members.length > 0 && `(${members.length})`}
      </h3>
      {members.length === 0 ? (
        <p className="text-sm text-neutral-500">Personne n'écoute encore ici.</p>
      ) : (
        <ul className="divide-y divide-neutral-800/60 rounded-lg border border-neutral-800 bg-neutral-950">
          {members.map((m) => (
            <ClientRow
              key={m.client.id}
              member={m}
              isMe={m.client.id === myClientId}
              move={move}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ClientRow({
  member: { client, group },
  isMe,
  playing,
  move,
  onChanged,
}: {
  member: Member
  isMe: boolean
  /** Ce que joue cet appareil, affiche seulement quand ce n'est aucune session. */
  playing?: string | null
  move: MoveUi
  onChanged: () => void
}) {
  // Le curseur doit rester fluide : on l'affiche localement et on n'envoie la
  // valeur au serveur qu'au relachement.
  const [volume, setVolume] = useState(client.volume)
  const [name, setName] = useState(client.name)
  const [editing, setEditing] = useState(false)

  useEffect(() => setVolume(client.volume), [client.volume])
  useEffect(() => {
    if (!editing) setName(client.name)
  }, [client.name, editing])

  const commitVolume = useMutation({
    mutationFn: (percent: number) => api.setClientVolume(client.id, percent, client.muted),
    onSuccess: onChanged,
  })
  const commitName = useMutation({
    mutationFn: (value: string) => api.setClientName(client.id, value),
    onSuccess: onChanged,
  })
  const toggleMute = useMutation({
    mutationFn: () => api.setClientVolume(client.id, client.volume, !client.muted),
    onSuccess: onChanged,
  })

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span
        title={client.connected ? 'Connecté' : 'Hors ligne'}
        className={`h-2 w-2 shrink-0 rounded-full ${
          client.connected ? 'bg-emerald-400' : 'bg-neutral-600'
        }`}
      />

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (name !== client.name) commitName.mutate(name)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 focus:outline-none"
          />
        ) : isBrowserClient(client.id) ? (
          // Le nom d'un navigateur vient du pseudo choisi en Configuration
          // (demain, d'OIDC) : le renommer ici creerait une seconde source de
          // verite, divergente de celle-la.
          <span
            title="Nom fixé par le pseudo choisi en Configuration"
            className="block max-w-full truncate text-sm text-neutral-100"
          >
            {client.name}
            {isMe && (
              <span className="ml-2 text-xs text-emerald-400">(ce navigateur)</span>
            )}
          </span>
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Renommer cet appareil"
            className="block max-w-full truncate text-left text-sm text-neutral-100 hover:underline"
          >
            {client.name}
          </button>
        )}
        <div className="truncate text-xs text-neutral-500">
          {client.ip}
          {client.os ? ` · ${client.os}` : ''}
          {playing && ` · joue ${playing}`}
        </div>
      </div>

      <Destination client={client} group={group} move={move} />

      <button
        onClick={() => toggleMute.mutate()}
        title={client.muted ? 'Réactiver' : 'Couper'}
        className={`shrink-0 text-xs ${
          client.muted ? 'text-amber-300' : 'text-neutral-500 hover:text-neutral-200'
        }`}
      >
        {client.muted ? 'muet' : 'son'}
      </button>

      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        onMouseUp={() => commitVolume.mutate(volume)}
        onTouchEnd={() => commitVolume.mutate(volume)}
        onKeyUp={() => commitVolume.mutate(volume)}
        aria-label={`Volume de ${client.name}`}
        className="h-1 w-32 shrink-0 cursor-pointer appearance-none rounded bg-neutral-700 accent-emerald-400"
      />
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-500">
        {volume}%
      </span>
    </li>
  )
}

/**
 * Ce que cet appareil doit ecouter : une session, ou aucune.
 *
 * Un selecteur plutot qu'un glisser-deposer : l'action est bien de choisir une
 * destination, et elle reste utilisable au clavier comme au doigt.
 *
 * Chacun deplace le navigateur qu'il a sous la main sans rien demander ;
 * deplacer un autre appareil est reserve aux administrateurs. Le serveur ne
 * peut pas trancher a notre place — il ne sait pas quel snapclient est quel
 * navigateur — donc la regle ne vaut que dans cette interface.
 */
function Destination({
  client,
  group,
  move,
}: {
  client: SnapClient
  group: SnapGroup
  move: MoveUi
}) {
  // Un groupe sans flux n'est la session de personne : sans cette garde, il
  // s'apparierait avec une session dont le flux n'est pas encore enregistre.
  const courante = group.stream_id
    ? move.sessions.find((s) => s.snapcast_stream_id === group.stream_id)
    : undefined
  const autorise = move.allowed(client.id)

  return (
    <select
      value={courante ? String(courante.id) : APART}
      disabled={!autorise || move.pending}
      aria-label={`Session de ${client.name}`}
      title={autorise ? undefined : "Seul un administrateur déplace un autre appareil"}
      onChange={(event) => {
        const choix = event.target.value
        const streamId =
          choix === APART
            ? move.apartStreamId
            : move.sessions.find((s) => String(s.id) === choix)?.snapcast_stream_id
        if (streamId) move.onMove(client.id, streamId)
      }}
      className="shrink-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 focus:border-neutral-500 focus:outline-none disabled:opacity-40"
    >
      {move.sessions.map((session) => (
        <option
          key={session.id}
          value={String(session.id)}
          // Une session dont le flux n'est pas enregistre aupres de snapserver
          // n'a rien a faire ecouter.
          disabled={!session.snapcast_stream_id}
        >
          {session.name}
        </option>
      ))}
      {/* Sans flux libre ou ranger l'appareil, « à part » n'est pas atteignable. */}
      <option value={APART} disabled={!move.apartStreamId}>
        À part
      </option>
    </select>
  )
}
