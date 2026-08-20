import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { formatDateTime } from '../components/format'
import { useAuth } from '../state/auth'

/** Une durée en heures, ou en minutes tant qu'elle reste courte. */
function duree(secondes: number): string {
  const heures = secondes / 3600
  if (heures >= 1) return `${heures.toFixed(heures < 10 ? 1 : 0)} h`
  return `${Math.round(secondes / 60)} min`
}

function poids(octets: number): string {
  const gio = octets / 1024 ** 3
  return gio >= 1 ? `${gio.toFixed(1)} Gio` : `${Math.round(octets / 1024 ** 2)} Mio`
}

function Chiffre({ label, valeur, note }: { label: string; valeur: string; note?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-100">{valeur}</div>
      {note && <div className="mt-0.5 text-xs text-neutral-600">{note}</div>}
    </div>
  )
}

/** Petite barre de répartition, sans dépendance de graphiques. */
function Repartition({ lignes }: { lignes: { label: string; count: number }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.count))
  return (
    <ul className="max-w-md space-y-1">
      {lignes.map((ligne) => (
        <li key={ligne.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-neutral-400">{ligne.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
            <span
              className="block h-full rounded-full bg-emerald-500/70"
              style={{ width: `${(ligne.count / max) * 100}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right tabular-nums text-neutral-500">
            {ligne.count}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Stats() {
  const auth = useAuth()
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats })

  if (stats.isLoading) return <p className="text-sm text-neutral-500">Chargement…</p>
  if (stats.error) return <p className="text-sm text-red-400">{(stats.error as Error).message}</p>

  const {
    catalogue,
    listening,
    top_tracks: top,
    top_artists: artistes,
    sessions,
  } = stats.data!
  const admin = !auth.oidc_enabled || auth.role === 'admin'

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold text-neutral-100">Statistiques</h1>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Catalogue
        </h2>
        <div className="grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Chiffre label="Titres" valeur={String(catalogue.tracks)} />
          <Chiffre label="Albums" valeur={String(catalogue.albums)} />
          <Chiffre label="Artistes" valeur={String(catalogue.artists)} />
          <Chiffre
            label="Durée totale"
            valeur={duree(catalogue.total_seconds)}
            note={
              catalogue.tracks_without_duration > 0
                ? `${catalogue.tracks_without_duration} titre(s) sans durée, non comptés`
                : undefined
            }
          />
        </div>
        <div className="mt-4 grid max-w-4xl gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Formats</h3>
            <Repartition lignes={catalogue.formats} />
            <p className="mt-2 text-xs text-neutral-600">{poids(catalogue.total_bytes)} au total</p>
          </div>
          {catalogue.genres.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Genres</h3>
              <Repartition lignes={catalogue.genres} />
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
          Écoute
        </h2>
        <p className="mb-3 max-w-2xl text-xs text-neutral-500">
          Comptée depuis la mise en service de cette page — rien n’était enregistré avant. Un
          titre compte au-delà de la moitié de sa durée, ou de quatre minutes. En session, le
          temps est compté <strong>pour chaque personne présente</strong> : une heure de musique
          écoutée à trois vaut trois heures.
        </p>
        <div className="grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Chiffre label="Écoutes" valeur={String(listening.listens)} />
          <Chiffre label="Temps cumulé" valeur={duree(listening.seconds)} />
          <Chiffre label="Titres différents" valeur={String(listening.distinct_tracks)} />
          <Chiffre label="Ajouts en file" valeur={String(listening.queue_additions)} />
        </div>

        {top.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Les plus écoutés
            </h3>
            <ol className="max-w-2xl divide-y divide-neutral-800/60 rounded-lg border border-neutral-800">
              {top.map((titre, rang) => (
                <li key={titre.track_id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-5 shrink-0 text-right tabular-nums text-neutral-600">
                    {rang + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-neutral-100">{titre.title}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                    {titre.artist_name}
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-400">{titre.listens}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {artistes.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Par artiste
          </h2>
          <p className="mb-3 max-w-2xl text-xs text-neutral-500">
            Classés sur le <strong>temps cumulé</strong>, et non sur le nombre d’écoutes : à
            nombre égal, un artiste de morceaux courts passerait devant. L’artiste est celui du
            titre, donc une compilation compte pour chacun de ses interprètes.
          </p>
          <ol className="max-w-3xl divide-y divide-neutral-800/60 rounded-lg border border-neutral-800">
            {artistes.map((artiste, rang) => (
              <li key={artiste.artist_id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-5 shrink-0 text-right tabular-nums text-neutral-600">
                  {rang + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/artists/${artiste.artist_id}`}
                    className="block truncate text-neutral-100 hover:underline"
                  >
                    {artiste.name}
                  </Link>
                  <div className="text-xs text-neutral-500">
                    {artiste.distinct_tracks} titre{artiste.distinct_tracks > 1 ? 's' : ''}{' '}
                    différent{artiste.distinct_tracks > 1 ? 's' : ''}
                  </div>
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums text-neutral-400">
                  {artiste.listens}
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums text-neutral-200">
                  {duree(artiste.seconds)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-neutral-600">
            Colonnes : nombre d’écoutes, temps cumulé.
          </p>
        </section>
      )}

      {sessions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
            Sessions
          </h2>
          <ul className="max-w-3xl divide-y divide-neutral-800/60 rounded-lg border border-neutral-800">
            {sessions.map((session) => (
              <li key={session.name} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-neutral-100">
                    {session.name}
                    {/* L'historique survit à la session : le dire évite de
                        chercher une session qui n'existe plus. */}
                    {!session.still_open && (
                      <span className="ml-2 text-xs text-neutral-600">(supprimée)</span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {session.listeners} auditeur{session.listeners > 1 ? 's' : ''} · dernière
                    écoute {formatDateTime(session.last_listen_at!)}
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-neutral-400">
                  {duree(session.seconds)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {admin && <ParUtilisateur />}
    </div>
  )
}

/**
 * Activité de chacun, réservée aux administrateurs.
 *
 * C'est le seul endroit où l'activité d'une personne est visible par une autre.
 * La route qui l'alimente est gardée côté serveur ; ce composant ne fait que
 * s'abstenir de la demander.
 */
function ParUtilisateur() {
  const users = useQuery({ queryKey: ['stats-users'], queryFn: api.userStats })
  if (users.isLoading || !users.data) return null

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-400">
        Par utilisateur
      </h2>
      <p className="mb-3 text-xs text-neutral-500">
        Visible des administrateurs seulement. Les plus actifs d’abord.
      </p>
      <ul className="max-w-3xl divide-y divide-neutral-800/60 rounded-lg border border-neutral-800">
        {users.data.map((personne) => (
          <li key={personne.user_id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate text-neutral-100">{personne.name}</div>
              <div className="text-xs text-neutral-500">
                {personne.last_listen_at
                  ? `dernière écoute ${formatDateTime(personne.last_listen_at)}`
                  : 'aucune écoute enregistrée'}
              </div>
            </div>
            <span className="w-24 shrink-0 text-right text-xs text-neutral-500">
              {personne.queue_additions} ajout{personne.queue_additions > 1 ? 's' : ''}
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums text-neutral-400">
              {personne.listens}
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums text-neutral-200">
              {duree(personne.seconds)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 max-w-2xl text-xs text-neutral-600">
        Colonnes : ajouts en file, nombre d’écoutes, temps cumulé.{' '}
        <Link to="/admin" className="text-neutral-500 hover:underline">
          Gérer les administrateurs
        </Link>
      </p>
    </section>
  )
}
