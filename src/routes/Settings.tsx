import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type SnapcastConfig } from '../api/client'
import { SnapMembers } from '../components/SnapMembers'
import { useIdentity } from '../state/identity'

export function Settings() {
  const { name, setName } = useIdentity()
  const [draftName, setDraftName] = useState(name)
  useEffect(() => setDraftName(name), [name])

  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="text-2xl font-semibold text-neutral-100">Configuration</h1>

      <section>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Mon identité
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Ce pseudo apparaît à côté des titres que vous ajoutez à une file partagée. Il est
          conservé dans ce navigateur.
        </p>
        <div className="flex gap-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => setName(draftName.trim())}
            placeholder="Votre pseudo"
            maxLength={60}
            className="w-64 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <button
            onClick={() => setName(draftName.trim())}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400"
          >
            Enregistrer
          </button>
        </div>
      </section>

      <SnapcastServer />

      <section>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Appareils
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Chaque appareil est regroupé sous la session qu'il écoute, synchronisé avec les autres
          qui l'écoutent aussi — ou « à part » s'il n'en écoute aucune. Cliquez sur un nom pour le
          renommer.
        </p>
        <SnapMembers />
      </section>
    </div>
  )
}

function SnapcastServer() {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['snapcast-config'], queryFn: api.snapcastConfig })
  const [draft, setDraft] = useState<SnapcastConfig | null>(null)

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const save = useMutation({
    mutationFn: (config: SnapcastConfig) => api.saveSnapcastConfig(config),
    onSuccess: (config) => {
      queryClient.setQueryData(['snapcast-config'], config)
      queryClient.invalidateQueries({ queryKey: ['snapcast-status'] })
    },
  })

  if (!draft) return null

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
        Serveur Snapcast
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        Réglage partagé par tous les utilisateurs. « Adresse annoncée » est celle par laquelle
        snapserver joint cette API pour venir chercher l'audio : elle doit être joignable
        depuis le serveur Snapcast.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(draft)
        }}
        className="grid grid-cols-[auto_1fr] items-center gap-3"
      >
        <label className="text-sm text-neutral-400">Activé</label>
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          className="h-4 w-4 justify-self-start accent-emerald-500"
        />

        <label className="text-sm text-neutral-400">Hôte</label>
        <input
          value={draft.host}
          onChange={(e) => setDraft({ ...draft, host: e.target.value })}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />

        <label className="text-sm text-neutral-400">Port de contrôle</label>
        <input
          type="number"
          value={draft.port}
          onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) })}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />

        <label className="text-sm text-neutral-400">Port HTTP (audio)</label>
        <input
          type="number"
          value={draft.http_port}
          onChange={(e) => setDraft({ ...draft, http_port: Number(e.target.value) })}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />

        <label className="text-sm text-neutral-400">Adresse annoncée</label>
        <input
          value={draft.advertise_host}
          onChange={(e) => setDraft({ ...draft, advertise_host: e.target.value })}
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />

        <div />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="justify-self-start rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            Enregistrer
          </button>
          {save.isSuccess && <span className="text-xs text-emerald-400">Enregistré</span>}
          {save.error && (
            <span className="text-xs text-red-400">{(save.error as Error).message}</span>
          )}
        </div>
      </form>
    </section>
  )
}
