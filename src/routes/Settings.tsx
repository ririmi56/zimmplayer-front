import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, type SnapcastConfig } from '../api/client'
import { SnapMembers } from '../components/SnapMembers'
import { useSnapclient } from '../snapcast/useSnapclient'
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

      <LocalListening />

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
        Réglage partagé par tous les utilisateurs. « Port HTTP » est celui du serveur web de
        snapserver (1780 par défaut) : il porte à la fois le contrôle et l'audio — le port de
        contrôle 1705 n'est plus utilisé. « Adresse annoncée » est celle par laquelle
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

        <label className="text-sm text-neutral-400">Port HTTP</label>
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

const STATE_LABELS: Record<string, string> = {
  idle: 'à l’arrêt',
  connecting: 'connexion…',
  syncing: 'synchronisation…',
  playing: 'en lecture',
  error: 'erreur',
}

/**
 * Synchronisation de ce navigateur en tant que snapclient.
 *
 * Sert à diagnostiquer une dérive : la dérive d'ancrage est corrigée toute
 * seule au-delà du seuil (voir `snapcast/player.ts`), et les morceaux en retard
 * en sont le témoin. Le bouton force une resynchronisation complète, horloge
 * serveur comprise, pour le cas où l'estimation elle-même est fausse.
 *
 * Ne concerne que ce navigateur : les enceintes physiques se recalent seules,
 * et l'API de snapserver n'offre aucune méthode pour les y forcer.
 */
function LocalListening() {
  const snap = useSnapclient()
  const { status } = snap

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
        Écoute sur ce navigateur
      </h2>
      {!snap.available ? (
        <p className="text-xs text-neutral-500">
          Rejoignez une session d'écoute pour que ce navigateur joue le flux, synchronisé avec
          les autres appareils.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-500">
            La dérive entre l'horloge du système et celle de la carte son est corrigée
            automatiquement. Si la lecture s'entend malgré tout décalée, forcez une
            resynchronisation : le son se coupe une seconde ou deux, le temps de reprendre les
            mesures.
          </p>
          <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-neutral-400">État</dt>
            <dd className="text-neutral-100">
              {STATE_LABELS[status.state] ?? status.state}
              {status.error && <span className="text-red-400"> — {status.error}</span>}
            </dd>

            <dt className="text-neutral-400">Décalage d'horloge serveur</dt>
            <dd className="tabular-nums text-neutral-100">
              {status.offsetMs.toFixed(1)} ms
              <span className="text-neutral-500"> ({status.samples} mesures)</span>
            </dd>

            <dt className="text-neutral-400">Dérive d'ancrage</dt>
            <dd className="tabular-nums text-neutral-100">{status.driftMs.toFixed(1)} ms</dd>

            <dt className="text-neutral-400">Morceaux</dt>
            <dd className="tabular-nums text-neutral-100">
              {status.played} joués
              <span className={status.late > 0 ? 'text-amber-400' : 'text-neutral-500'}>
                {' '}
                · {status.late} en retard
              </span>
            </dd>

            <dt className="text-neutral-400">Recalages</dt>
            <dd className="tabular-nums text-neutral-100">{status.resyncs}</dd>
          </dl>
          <button
            onClick={snap.resync}
            disabled={!snap.listening}
            className="mt-4 rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
          >
            Resynchroniser
          </button>
          {!snap.listening && (
            <span className="ml-3 text-xs text-neutral-500">
              Activez « Écouter ici » pour pouvoir resynchroniser.
            </span>
          )}
        </>
      )}
    </section>
  )
}
