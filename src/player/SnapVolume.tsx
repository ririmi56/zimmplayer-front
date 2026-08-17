import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api, type SnapClient, type SnapcastStatus } from '../api/client'
import { browserClientId } from '../snapcast/client'
import { useSnapclient } from '../snapcast/useSnapclient'
import { useCurrentSession } from '../state/session'
import { ICONS, Icon } from './icons'

/**
 * Volumes du mode Snapcast : ce navigateur d'un côté, les appareils de la
 * session de l'autre.
 *
 * Deux questions distinctes se posent en écoute partagée — « est-ce que
 * j'entends ici, et à quel point ? » et « quel volume dans les pièces ? » — et
 * les confondre dans un seul curseur était le défaut de la barre précédente.
 * D'où le code couleur, qui porte du sens plutôt que de décorer :
 *
 *   ciel      → ce que tout le monde entend (les enceintes, le volume général)
 *   émeraude  → ce que j'entends ici (ce navigateur)
 *
 * **Snapcast n'a pas de volume de groupe** (`Group.SetVolume` n'existe pas) :
 * le volume général est donc calculé, en mettant les volumes individuels à
 * l'échelle et en conservant leur équilibre. La coupure générale, elle, est
 * native (`Group.SetMute`) — elle n'écrase donc aucun réglage.
 */
export function SnapVolume() {
  const snap = useSnapclient()
  const queryClient = useQueryClient()
  const { data: session } = useCurrentSession()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const myClientId = browserClientId()

  // Ouvert, il faut suivre les changements des autres postes de près ; fermé,
  // il s'agit seulement de garder l'icône honnête sur l'état « muet ».
  const status = useQuery({
    queryKey: ['snapcast-status'],
    queryFn: api.snapcastStatus,
    refetchInterval: open ? 2000 : 15000,
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  // Les appareils de CETTE session : ceux des groupes qui jouent son flux. Un
  // même flux peut être réparti sur plusieurs groupes, d'où le regroupement.
  const streamId = session?.snapcast_stream_id ?? null
  const groups = (status.data?.groups ?? []).filter(
    (group) => streamId != null && group.stream_id === streamId,
  )
  const members = groups.flatMap((group) => group.clients)
  const master = members.length > 0 ? Math.max(...members.map((c) => c.volume)) : 0
  const allMuted = groups.length > 0 && groups.every((group) => group.muted)

  /**
   * Envois différés : chaque appel REST ouvre une connexion vers snapserver, et
   * un curseur que l'on déplace en produirait des dizaines par seconde. On
   * garde la dernière valeur de chaque appareil et on ne l'envoie qu'au repos.
   */
  const pending = useRef(new Map<string, { percent: number; muted: boolean }>())
  const flushTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current)
    },
    [],
  )

  const send = (clientId: string, percent: number, muted: boolean) => {
    // Pour ce navigateur, passer par son propre client : le gain est local et
    // s'applique tout de suite, et snapserver en est informé dans la foulée.
    if (clientId === myClientId && snap.listening) snap.setVolume(percent / 100, muted)
    else void api.setClientVolume(clientId, percent, muted).catch(() => {})
  }

  const queueVolume = (changes: { id: string; percent: number; muted: boolean }[]) => {
    // Optimiste : l'affichage suit le curseur sans attendre le prochain sondage.
    const byId = new Map(changes.map((c) => [c.id, c]))
    queryClient.setQueryData<SnapcastStatus>(['snapcast-status'], (old) =>
      old
        ? {
            ...old,
            groups: old.groups.map((group) => ({
              ...group,
              clients: group.clients.map((client) => {
                const change = byId.get(client.id)
                return change
                  ? { ...client, volume: change.percent, muted: change.muted }
                  : client
              }),
            })),
          }
        : old,
    )

    for (const change of changes) pending.current.set(change.id, change)
    if (flushTimer.current === null) {
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null
        const entries = [...pending.current]
        pending.current.clear()
        for (const [id, value] of entries) send(id, value.percent, value.muted)
      }, 200)
    }
  }

  /** Équilibre relatif au moment où l'on saisit le curseur général. */
  const ratios = useRef(new Map<string, number>())
  const captureRatios = () => {
    ratios.current = new Map(
      members.map((client) => [client.id, master > 0 ? client.volume / master : 1]),
    )
  }

  const setMaster = (value: number) => {
    queueVolume(
      members.map((client) => ({
        id: client.id,
        percent: Math.round((ratios.current.get(client.id) ?? 1) * value),
        muted: client.muted,
      })),
    )
  }

  const toggleGroupMute = () => {
    for (const group of groups) {
      void api.setGroupMute(group.id, !allMuted).catch(() => {})
    }
    queryClient.setQueryData<SnapcastStatus>(['snapcast-status'], (old) =>
      old
        ? {
            ...old,
            groups: old.groups.map((group) =>
              groups.some((g) => g.id === group.id) ? { ...group, muted: !allMuted } : group,
            ),
          }
        : old,
    )
  }

  const unreachable = status.data != null && !status.data.connected

  return (
    <div ref={wrapper} className="relative flex items-center gap-3">
      <button
        onClick={() => (snap.listening ? snap.mute() : snap.listen())}
        title={
          snap.listening
            ? 'Ne plus jouer le flux sur ce navigateur'
            : 'Jouer le flux sur ce navigateur, synchronisé avec les enceintes'
        }
        aria-label="Écouter sur ce navigateur"
        aria-pressed={snap.listening}
        className={snap.listening ? 'text-emerald-400' : 'text-neutral-400 hover:text-neutral-100'}
      >
        <Icon path={ICONS.headphones} />
      </button>

      <button
        onClick={() => setOpen((value) => !value)}
        title="Volumes"
        aria-label="Volumes"
        aria-expanded={open}
        className={open ? 'text-sky-300' : 'text-neutral-400 hover:text-neutral-100'}
      >
        <Icon path={allMuted || master === 0 ? ICONS.mute : ICONS.volume} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-4 w-80 rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-2xl shadow-black/60">
          {unreachable || members.length === 0 ? (
            <p className="text-sm text-neutral-400">
              {unreachable
                ? 'Snapserver est injoignable.'
                : "Aucun appareil n'écoute cette session pour l'instant."}
            </p>
          ) : (
            <>
              {/* Le général porte la hiérarchie : encadré, curseur plus épais. */}
              <div className="rounded-lg bg-neutral-800/50 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-300">
                    Volume général
                  </span>
                  <span className="text-sm tabular-nums text-neutral-100">
                    {allMuted ? 'muet' : `${master}%`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleGroupMute}
                    title={allMuted ? 'Réactiver le son' : 'Couper le son partout'}
                    className={
                      allMuted ? 'text-amber-300' : 'text-neutral-400 hover:text-neutral-100'
                    }
                  >
                    <Icon path={allMuted ? ICONS.mute : ICONS.volume} className="h-4 w-4" />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={master}
                    onPointerDown={captureRatios}
                    onKeyDown={captureRatios}
                    onChange={(e) => setMaster(Number(e.target.value))}
                    aria-label="Volume général"
                    className={`h-1.5 flex-1 cursor-pointer appearance-none rounded bg-neutral-700 accent-sky-400 ${
                      allMuted ? 'opacity-40' : ''
                    }`}
                  />
                </div>
                <p className="mt-2 text-[11px] text-neutral-500">
                  Conserve l'équilibre entre les appareils.
                </p>
              </div>

              <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Appareils ({members.length})
              </div>
              <ul className="space-y-2">
                {members.map((client) => (
                  <DeviceRow
                    key={client.id}
                    client={client}
                    isMe={client.id === myClientId}
                    onChange={(percent, muted) =>
                      queueVolume([{ id: client.id, percent, muted }])
                    }
                  />
                ))}
              </ul>
            </>
          )}

          <label className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-3 text-sm text-neutral-300">
            <span className="flex items-center gap-2">
              <Icon path={ICONS.headphones} className="h-4 w-4" />
              Écouter sur ce navigateur
            </span>
            <input
              type="checkbox"
              checked={snap.listening}
              onChange={() => (snap.listening ? snap.mute() : snap.listen())}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function DeviceRow({
  client,
  isMe,
  onChange,
}: {
  client: SnapClient
  isMe: boolean
  onChange: (percent: number, muted: boolean) => void
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        title={client.connected ? 'Connecté' : 'Hors ligne'}
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          client.connected ? 'bg-emerald-400' : 'bg-neutral-600'
        }`}
      />
      <span
        title={isMe ? `${client.name} (ce navigateur)` : client.name}
        className={`w-24 shrink-0 truncate text-sm ${
          isMe ? 'text-emerald-400' : 'text-neutral-100'
        }`}
      >
        {client.name}
      </span>
      <button
        onClick={() => onChange(client.volume, !client.muted)}
        title={client.muted ? 'Réactiver' : 'Couper'}
        className={
          client.muted
            ? 'shrink-0 text-amber-300'
            : 'shrink-0 text-neutral-500 hover:text-neutral-200'
        }
      >
        <Icon path={client.muted ? ICONS.mute : ICONS.volume} className="h-4 w-4" />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={client.volume}
        onChange={(e) => onChange(Number(e.target.value), client.muted)}
        aria-label={`Volume de ${client.name}`}
        className={`h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded bg-neutral-700 ${
          isMe ? 'accent-emerald-400' : 'accent-sky-400'
        } ${client.muted ? 'opacity-40' : ''}`}
      />
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-neutral-500">
        {client.volume}
      </span>
    </li>
  )
}
