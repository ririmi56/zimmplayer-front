import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type AppUser } from '../api/client'
import { formatDateTime } from '../components/format'
import { useAuth } from '../state/auth'

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-100">{value}</div>
    </div>
  )
}

export function Admin() {
  const auth = useAuth()

  // Le serveur refuse deja ces routes par un 403 : ce garde-fou n'ajoute pas
  // de securite, il evite d'afficher une page entierement en erreur.
  if (!auth.oidc_enabled ? false : auth.role !== 'admin') {
    return (
      <div className="py-16 text-center">
        <h1 className="text-lg font-medium text-neutral-200">Administration</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Cette page est réservée aux administrateurs.
        </p>
      </div>
    )
  }
  return <AdminContenu />
}

function AdminContenu() {
  const queryClient = useQueryClient()

  const status = useQuery({
    queryKey: ['scan-status'],
    queryFn: api.scanStatus,
    // Pendant un scan on suit la progression ; sinon on laisse le serveur tranquille.
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 1000 : false),
  })

  const errors = useQuery({
    queryKey: ['scan-errors', status.data?.id],
    queryFn: api.scanErrors,
    enabled: status.data != null && status.data.status !== 'running',
  })

  const startScan = useMutation({
    mutationFn: (force: boolean) => api.startScan(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scan-status'] })
      queryClient.invalidateQueries({ queryKey: ['albums'] })
      queryClient.invalidateQueries({ queryKey: ['artists'] })
    },
  })

  const run = status.data
  const running = run?.status === 'running'

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-100">Administration</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startScan.mutate(true)}
            disabled={running || startScan.isPending}
            title="Relit tous les fichiers, y compris ceux qui n'ont pas changé"
            className="rounded-full border border-neutral-700 px-5 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-40"
          >
            Scan complet
          </button>
          <button
            onClick={() => startScan.mutate(false)}
            disabled={running || startScan.isPending}
            title="Ne traite que les fichiers ajoutés ou modifiés"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            {running ? 'Scan en cours…' : 'Lancer un scan'}
          </button>
        </div>
      </header>

      <p className="-mt-4 text-xs text-neutral-500">
        Un scan normal ne relit que les fichiers dont l'ETag ou la taille a changé. Le scan
        complet force la relecture de toute la bibliothèque : à réserver aux cas où
        l'extraction des métadonnées a évolué.
      </p>

      {startScan.error && (
        <p className="text-sm text-red-400">{(startScan.error as Error).message}</p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Dernier scan
        </h2>
        {!run ? (
          <p className="text-sm text-neutral-500">
            Aucun scan n'a encore été lancé. Le catalogue est vide tant que le bucket n'a pas
            été indexé.
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Fichiers vus" value={run.files_seen} />
              <Stat label="Indexés" value={run.files_indexed} />
              <Stat label="Retirés" value={run.files_removed} />
              <Stat label="En échec" value={run.files_failed} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-neutral-500">État</dt>
              <dd
                className={
                  run.status === 'failed'
                    ? 'text-red-400'
                    : run.status === 'running'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }
              >
                {run.status}
              </dd>
              <dt className="text-neutral-500">Démarré</dt>
              <dd className="text-neutral-300">{formatDateTime(run.started_at)}</dd>
              <dt className="text-neutral-500">Terminé</dt>
              <dd className="text-neutral-300">{formatDateTime(run.finished_at)}</dd>
              {run.error && (
                <>
                  <dt className="text-neutral-500">Erreur</dt>
                  <dd className="text-red-400">{run.error}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </section>

      {errors.data && errors.data.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Fichiers en échec ({errors.data.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-950 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Objet</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {errors.data.map((error) => (
                  <tr key={error.id}>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                      {error.object_key}
                    </td>
                    <td className="px-3 py-2 text-neutral-400">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <Utilisateurs />
    </div>
  )
}


/**
 * Qui est administrateur.
 *
 * On ne peut proposer que des personnes deja connectees au moins une fois :
 * aucune API OIDC standard ne permet de lister les comptes d'un fournisseur,
 * et l'application n'en tient pas d'annuaire.
 */
function Utilisateurs() {
  const queryClient = useQueryClient()
  const moi = useAuth()
  const users = useQuery({ queryKey: ['users'], queryFn: api.users })
  const changer = useMutation({
    mutationFn: ({ id, isAdmin }: { id: number; isAdmin: boolean }) =>
      api.setUserAdmin(id, isAdmin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
  const supprimer = useMutation({
    mutationFn: (id: number) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      // Les playlists de la personne sont parties avec elle, et le detail par
      // personne des statistiques perd sa ligne.
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['userStats'] })
    },
  })

  if (users.isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (users.error) return <p className="text-sm text-red-400">{(users.error as Error).message}</p>

  const liste = users.data ?? []

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
        Utilisateurs
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        Un administrateur peut nommer d’autres administrateurs. Seules les personnes déjà
        connectées au moins une fois apparaissent ici. Supprimer un compte fait le ménage
        dans cette liste : ses écoutes sont conservées, détachées de lui, mais ses playlists
        partent avec lui — et il réapparaîtra s’il se reconnecte.
      </p>

      {(changer.error || supprimer.error) && (
        <p className="mb-3 max-w-2xl rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {((changer.error ?? supprimer.error) as Error).message}
        </p>
      )}

      <ul className="max-w-2xl divide-y divide-neutral-800 rounded-lg border border-neutral-800">
        {liste.map((utilisateur) => (
          <LigneUtilisateur
            key={utilisateur.id}
            utilisateur={utilisateur}
            cestMoi={utilisateur.subject === moi.subject}
            enCours={changer.isPending}
            onChange={(isAdmin) => changer.mutate({ id: utilisateur.id, isAdmin })}
            onSupprimer={() => supprimer.mutate(utilisateur.id)}
            suppressionEnCours={supprimer.isPending}
          />
        ))}
      </ul>
    </section>
  )
}

function LigneUtilisateur({
  utilisateur,
  cestMoi,
  enCours,
  onChange,
  onSupprimer,
  suppressionEnCours,
}: {
  utilisateur: AppUser
  cestMoi: boolean
  enCours: boolean
  onChange: (isAdmin: boolean) => void
  onSupprimer: () => void
  suppressionEnCours: boolean
}) {
  const [confirme, setConfirme] = useState(false)
  // Deux cas ou la bascule n'a pas de sens, et ou la desactiver vaut mieux que
  // de laisser cliquer pour un refus du serveur : un compte nomme dans la
  // configuration, et soi-meme — se retirer le role fermerait la porte
  // derriere soi.
  const fige = utilisateur.is_super_admin || (cestMoi && utilisateur.is_admin)
  const raison = utilisateur.is_super_admin
    ? 'Administrateur par la configuration du serveur'
    : 'Vous ne pouvez pas retirer votre propre rôle'

  // Memes deux cas que le serveur refuse par un 409 : desactiver ici vaut
  // mieux que de laisser cliquer pour un refus.
  // Les deux phrases de l'avertissement accordent noms ET adjectifs : « 1
  // playlist supprimée, même publique » et non « … même publiques ».
  const pl = utilisateur.playlist_count > 1 ? 's' : ''
  const ec = utilisateur.listen_count > 1 ? 's' : ''

  const figeSuppression = cestMoi || utilisateur.is_super_admin
  const raisonSuppression = cestMoi
    ? 'Vous ne pouvez pas supprimer votre propre compte'
    : 'Nommé dans la configuration : il reviendrait à sa prochaine connexion'

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-neutral-100">
          {utilisateur.name}
          {cestMoi && <span className="ml-2 text-xs text-neutral-500">(vous)</span>}
        </div>
        <div className="truncate text-xs text-neutral-500">
          {utilisateur.email || utilisateur.subject} · vu le{' '}
          {formatDateTime(utilisateur.last_seen_at)}
        </div>
      </div>

      {utilisateur.is_super_admin && (
        <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
          configuration
        </span>
      )}

      <label
        className={`flex shrink-0 items-center gap-2 text-sm ${fige ? 'opacity-50' : ''}`}
        title={fige ? raison : undefined}
      >
        <input
          type="checkbox"
          checked={utilisateur.is_admin}
          disabled={fige || enCours}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        Administrateur
      </label>

      <button
        onClick={() => setConfirme(true)}
        disabled={figeSuppression || confirme}
        title={figeSuppression ? raisonSuppression : 'Supprimer ce compte'}
        aria-label={`Supprimer ${utilisateur.name}`}
        className="shrink-0 text-sm text-neutral-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-neutral-500"
      >
        Supprimer
      </button>
      </div>

      {/* Une confirmation en ligne plutot qu'un dialogue : elle peut dire ce
          qui part et ce qui reste, ce qu'un « Êtes-vous sûr ? » ne fait pas. */}
      {confirme && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-neutral-200">
            Supprimer « {utilisateur.name} » ?
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-neutral-400">
            <li>
              {utilisateur.playlist_count === 0
                ? 'Aucune playlist à perdre.'
                : `${utilisateur.playlist_count} playlist${pl} supprimée${pl}, même publique${pl} ou partagée${pl}.`}
            </li>
            <li>
              {utilisateur.listen_count === 0
                ? 'Aucune écoute enregistrée.'
                : `${utilisateur.listen_count} écoute${ec} conservée${ec}, détachée${ec} du compte : les totaux ne bougent pas.`}
            </li>
            <li>Ses likes et ses favoris sont supprimés.</li>
            <li>Il réapparaîtra s’il se reconnecte.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setConfirme(false)}
              className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
            >
              Annuler
            </button>
            <button
              onClick={onSupprimer}
              disabled={suppressionEnCours}
              className="rounded-full bg-red-500/90 px-4 py-1.5 text-sm font-medium text-neutral-950 hover:bg-red-400 disabled:opacity-40"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
