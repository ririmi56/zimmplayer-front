import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { formatDateTime } from '../components/format'
import { useSnapclient } from '../snapcast/useSnapclient'
import { useIdentity } from '../state/identity'
import { useDisplayName } from '../state/auth'

export function Sessions() {
  const queryClient = useQueryClient()
  const { sessionId, setSessionId } = useIdentity()
  const name = useDisplayName()
  const [newName, setNewName] = useState('')
  const snap = useSnapclient()

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: api.sessions, refetchInterval: 5000 })
  const snapStatus = useQuery({
    queryKey: ['snapcast-status'],
    queryFn: api.snapcastStatus,
    refetchInterval: 5000,
  })

  // Appareils dont le groupe Snapcast joue le flux de cette session, quel que
  // soit le groupe exact — un meme flux peut etre reparti sur plusieurs zones.
  const listenerCount = (streamId: string | null) => {
    if (!streamId || !snapStatus.data?.connected) return 0
    return snapStatus.data.groups
      .filter((g) => g.stream_id === streamId)
      .reduce((sum, g) => sum + g.clients.length, 0)
  }

  const create = useMutation({
    mutationFn: (value: string) => api.createSession(value),
    onSuccess: (session) => {
      setSessionId(session.id)
      setNewName('')
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      // Creer une session, c'est la rejoindre : autant ecouter tout de suite,
      // plutot que d'exiger un second clic separe sur « Ecouter ici ».
      void snap.listen()
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteSession(id),
    onSuccess: (_, id) => {
      if (sessionId === id) setSessionId(null)
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return (
    <>
      <header className="mb-2 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-100">Sessions d'écoute</h1>
        {sessionId != null && (
          <button
            onClick={() => setSessionId(null)}
            className="text-sm text-neutral-400 hover:text-neutral-100"
          >
            Quitter la session
          </button>
        )}
      </header>
      <p className="mb-6 text-sm text-neutral-500">
        Une session porte une file d'attente commune : chacun y ajoute ce qu'il veut, et le
        serveur la diffuse en synchronisation dans les pièces via Snapcast. Sans session,
        l'écoute reste solo, sur ce navigateur.
      </p>

      {!name && (
        <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Choisissez d'abord un pseudo dans <strong>Configuration</strong> : c'est lui qui
          apparaîtra à côté des titres que vous ajoutez.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newName.trim()) create.mutate(newName.trim())
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom de la nouvelle session…"
          maxLength={100}
          className="w-72 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newName.trim() || create.isPending}
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          Créer
        </button>
      </form>

      {create.error && (
        <p className="mb-4 text-sm text-red-400">{(create.error as Error).message}</p>
      )}

      {sessions.data?.length === 0 && (
        <p className="text-sm text-neutral-500">Aucune session pour l'instant.</p>
      )}

      <ul className="space-y-2">
        {sessions.data?.map((session) => {
          const active = session.id === sessionId
          return (
            <li
              key={session.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                active ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-neutral-800'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-100">{session.name}</span>
                </div>
                <div className="text-xs text-neutral-500">
                  {session.item_count} titre{session.item_count > 1 ? 's' : ''} ·{' '}
                  {listenerCount(session.snapcast_stream_id)} appareil
                  {listenerCount(session.snapcast_stream_id) > 1 ? 's' : ''} à l'écoute · créée
                  par {session.created_by} le {formatDateTime(session.created_at)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => {
                    setSessionId(active ? null : session.id)
                    // Rejoindre une session, c'est vouloir entendre son flux :
                    // ce clic sert aussi de geste utilisateur pour l'ouvrir.
                    if (!active) void snap.listen()
                  }}
                  className={`rounded-full px-4 py-1.5 text-sm ${
                    active
                      ? 'border border-neutral-700 text-neutral-300 hover:border-neutral-500'
                      : 'bg-emerald-500 font-medium text-neutral-950 hover:bg-emerald-400'
                  }`}
                >
                  {active ? 'Quitter' : 'Rejoindre'}
                </button>
                <button
                  onClick={() => remove.mutate(session.id)}
                  title="Supprimer la session"
                  className="text-sm text-neutral-500 hover:text-red-400"
                >
                  Supprimer
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
