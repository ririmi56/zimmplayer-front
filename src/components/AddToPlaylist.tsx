import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { ICONS, Icon } from '../player/icons'

/**
 * Ajoute des titres — ou tout un album — a une playlist.
 *
 * Le menu ne propose que les playlists ou l'on a le droit d'editer : les
 * afficher toutes pour repondre 403 au clic ne rendrait service a personne.
 */
export function AddToPlaylist({
  trackIds,
  albumId,
  className = '',
}: {
  trackIds?: number[]
  albumId?: number
  className?: string
}) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const boite = useRef<HTMLDivElement>(null)

  // Charge la liste seulement quand on ouvre : ce bouton est repete sur chaque
  // ligne d'un album, en interroger autant au chargement serait absurde.
  const playlists = useQuery({
    queryKey: ['playlists'],
    queryFn: api.playlists,
    enabled: ouvert,
  })

  const ajouter = useMutation({
    mutationFn: (id: number) => api.addToPlaylist(id, albumId != null ? { album_id: albumId } : { track_ids: trackIds }),
    onSuccess: (playlist) => {
      setOuvert(false)
      setMessage(`Ajouté à « ${playlist.name} »`)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['playlist', playlist.id] })
    },
  })

  useEffect(() => {
    if (!ouvert) return
    const fermer = (event: MouseEvent) => {
      if (!boite.current?.contains(event.target as Node)) setOuvert(false)
    }
    // `capture` : certaines lignes arretent la propagation, le menu resterait
    // alors ouvert derriere un clic ailleurs.
    document.addEventListener('mousedown', fermer, true)
    return () => document.removeEventListener('mousedown', fermer, true)
  }, [ouvert])

  useEffect(() => {
    if (!message) return
    const minuteur = window.setTimeout(() => setMessage(null), 2500)
    return () => window.clearTimeout(minuteur)
  }, [message])

  const modifiables = (playlists.data ?? []).filter((playlist) => playlist.can_edit)

  return (
    <div ref={boite} className="relative shrink-0">
      <button
        onClick={() => setOuvert((etat) => !etat)}
        title={message ?? 'Ajouter à une playlist'}
        aria-label="Ajouter à une playlist"
        className={`${className} ${message ? 'text-emerald-400' : ''}`}
      >
        <Icon path={ICONS.playlistAdd} className="h-4 w-4" />
      </button>

      {ouvert && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
          {playlists.isLoading && (
            <p className="px-3 py-2 text-xs text-neutral-500">Chargement…</p>
          )}
          {!playlists.isLoading && modifiables.length === 0 && (
            <p className="px-3 py-2 text-xs text-neutral-500">
              Aucune playlist à éditer. Créez-en une depuis l’onglet Playlists.
            </p>
          )}
          {modifiables.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => ajouter.mutate(playlist.id)}
              disabled={ajouter.isPending}
              className="block w-full truncate px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
            >
              {playlist.name}
              {!playlist.is_owner && (
                <span className="ml-2 text-xs text-neutral-500">de {playlist.owner_name}</span>
              )}
            </button>
          ))}
          {ajouter.error && (
            <p className="px-3 py-2 text-xs text-red-300">{(ajouter.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  )
}
