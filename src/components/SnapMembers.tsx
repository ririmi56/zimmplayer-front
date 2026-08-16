import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type SessionSummary, type SnapClient, type SnapGroup } from '../api/client'
import { browserClientId, isBrowserClient } from '../snapcast/client'

type Member = { client: SnapClient; group: SnapGroup }

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

  const members: Member[] = status.data.groups.flatMap((group) =>
    group.clients.map((client) => ({ client, group })),
  )
  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">Aucun client Snapcast connecté.</p>
  }

  const sessionList = sessions.data ?? []
  const bySession = sessionList.map((session) => ({
    session,
    members: members.filter((m) => m.group.stream_id === session.snapcast_stream_id),
  }))
  const claimed = new Set(bySession.flatMap((b) => b.members.map((m) => m.client.id)))
  const apart = members.filter((m) => !claimed.has(m.client.id))

  return (
    <div className="space-y-6">
      {bySession.map(({ session, members: inSession }) => (
        <SessionCluster
          key={session.id}
          session={session}
          members={inSession}
          myClientId={myClientId}
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
                onChanged={refresh}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SessionCluster({
  session,
  members,
  myClientId,
  onChanged,
}: {
  session: SessionSummary
  members: Member[]
  myClientId: string | null
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
            <ClientRow key={m.client.id} member={m} isMe={m.client.id === myClientId} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ClientRow({
  member: { client },
  isMe,
  playing,
  onChanged,
}: {
  member: Member
  isMe: boolean
  /** Ce que joue cet appareil, affiche seulement quand ce n'est aucune session. */
  playing?: string | null
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
