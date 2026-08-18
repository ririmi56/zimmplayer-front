import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

/**
 * Mes playlists, et celles qu'on m'a partagees.
 *
 * Une playlist n'est pas une file : la file est ce qui joue maintenant et se
 * vide en avancant, une playlist se garde. Elles ne se rejoignent qu'au moment
 * ou l'on envoie l'une dans l'autre.
 */
export function Playlists() {
  const queryClient = useQueryClient()
  const [nom, setNom] = useState('')

  const playlists = useQuery({ queryKey: ['playlists'], queryFn: api.playlists })
  const creer = useMutation({
    mutationFn: api.createPlaylist,
    onSuccess: () => {
      setNom('')
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
    },
  })

  const liste = playlists.data ?? []
  const miennes = liste.filter((p) => p.is_owner)
  const partagees = liste.filter((p) => !p.is_owner)

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-100">Playlists</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (nom.trim()) creer.mutate(nom.trim())
          }}
          className="flex gap-2"
        >
          <input
            value={nom}
            onChange={(event) => setNom(event.target.value)}
            placeholder="Nom de la playlist"
            maxLength={120}
            className="w-64 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!nom.trim() || creer.isPending}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            Créer
          </button>
        </form>
      </header>

      {playlists.isLoading && <p className="text-sm text-neutral-500">Chargement…</p>}

      {!playlists.isLoading && liste.length === 0 && (
        <p className="text-sm text-neutral-500">
          Aucune playlist. Créez-en une, puis ajoutez-y des titres depuis un album.
        </p>
      )}

      <Groupe titre="Les miennes" playlists={miennes} />
      <Groupe titre="Partagées avec moi" playlists={partagees} />
    </>
  )
}

function Groupe({
  titre,
  playlists,
}: {
  titre: string
  playlists: { id: number; name: string; owner_name: string; is_owner: boolean; can_edit: boolean; track_count: number }[]
}) {
  if (playlists.length === 0) return null
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
        {titre}
      </h2>
      <ul className="max-w-3xl divide-y divide-neutral-800 rounded-lg border border-neutral-800">
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <Link
              to={`/playlists/${playlist.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-800/40"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-neutral-100">{playlist.name}</div>
                <div className="truncate text-xs text-neutral-500">
                  {playlist.track_count} titre{playlist.track_count > 1 ? 's' : ''}
                  {!playlist.is_owner && ` · de ${playlist.owner_name}`}
                </div>
              </div>
              {!playlist.is_owner && (
                <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
                  {playlist.can_edit ? 'lecture et écriture' : 'lecture seule'}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
