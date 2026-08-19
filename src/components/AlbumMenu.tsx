import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { ICONS, Icon } from '../player/icons'
import { usePlayer } from '../player/store'
import { useCurrentSession, useEnqueue, usePlayNowInSession } from '../state/session'

/**
 * Les actions d'un album, sans avoir a ouvrir sa page.
 *
 * Les titres ne sont pas charges tant qu'on n'a rien demande : la grille en
 * affiche soixante d'un coup, les precharger reviendrait a soixante requetes
 * pour un menu qu'on n'ouvrira pas. « Ajouter à la file » et « Ajouter à une
 * playlist » n'en ont pas besoin du tout — l'API accepte un `album_id`.
 */
export function AlbumMenu({ albumId, albumTitle }: { albumId: number; albumTitle: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const boite = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: session } = useCurrentSession()
  const enqueue = useEnqueue()
  const playNowInSession = usePlayNowInSession()
  const playQueue = usePlayer((s) => s.playQueue)

  const lire = useMutation({
    mutationFn: async () => {
      const album = await api.album(albumId)
      if (album.tracks.length === 0) throw new Error('Album vide')
      if (session) {
        await playNowInSession.mutateAsync({
          trackIds: album.tracks.map((t) => t.id),
          startIndex: 0,
        })
      } else {
        playQueue(album.tracks, 0)
      }
    },
    onSuccess: () => setOuvert(false),
  })

  const ajouterALaFile = useMutation({
    mutationFn: () => enqueue.mutateAsync({ album_id: albumId }),
    onSuccess: () => {
      setOuvert(false)
      setMessage('Ajouté à la file')
    },
  })

  const ajouterAUnePlaylist = useMutation({
    mutationFn: (playlistId: number) => api.addToPlaylist(playlistId, { album_id: albumId }),
    onSuccess: (playlist) => {
      setOuvert(false)
      setMessage(`Ajouté à « ${playlist.name} »`)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      queryClient.invalidateQueries({ queryKey: ['playlist', playlist.id] })
    },
  })

  const [playlistsOuvertes, setPlaylistsOuvertes] = useState(false)
  // Chargees seulement quand on deplie : la grille pose ce menu sur chaque
  // vignette, en interroger soixante au chargement serait absurde.
  const playlists = useQuery({
    queryKey: ['playlists'],
    queryFn: api.playlists,
    enabled: playlistsOuvertes,
  })
  const modifiables = (playlists.data ?? []).filter((playlist) => playlist.can_edit)

  useEffect(() => {
    if (!ouvert) return setPlaylistsOuvertes(false)
    const fermer = (event: MouseEvent) => {
      if (!boite.current?.contains(event.target as Node)) setOuvert(false)
    }
    // `capture` : la vignette est un lien qui arrete la propagation, le menu
    // resterait ouvert derriere un clic ailleurs.
    document.addEventListener('mousedown', fermer, true)
    return () => document.removeEventListener('mousedown', fermer, true)
  }, [ouvert])

  useEffect(() => {
    if (!message) return
    const minuteur = window.setTimeout(() => setMessage(null), 2500)
    return () => window.clearTimeout(minuteur)
  }, [message])

  const erreur = (lire.error ?? ajouterALaFile.error ?? ajouterAUnePlaylist.error) as Error | null

  return (
    // Pas de conteneur positionne ici : le bouton et le menu se placent tous
    // deux par rapport a la VIGNETTE. Ancre au bouton, en haut a droite d'une
    // vignette large de 150 px, un menu de 176 px debordait a gauche et
    // passait sous la barre laterale.
    <div ref={boite} className="contents">
      <button
        onClick={(event) => {
          // La vignette entiere est un lien vers l'album : sans ceci, ouvrir
          // le menu y naviguerait aussitot.
          event.preventDefault()
          event.stopPropagation()
          setOuvert((etat) => !etat)
        }}
        title={message ?? `Actions sur ${albumTitle}`}
        aria-label={`Actions sur ${albumTitle}`}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className={`absolute right-3 top-3 z-10 rounded-full bg-neutral-950/70 p-1 backdrop-blur transition ${
          message ? 'text-emerald-400' : 'text-neutral-300 hover:text-neutral-50'
        } ${ouvert ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'}`}
      >
        <Icon path={ICONS.kebab} className="h-5 w-5" />
      </button>

      {ouvert && (
        <div
          role="menu"
          onClick={(event) => event.preventDefault()}
          // Centre sur la vignette : quelle que soit la colonne, le
          // debordement se partage entre les deux cotes et tient dans le
          // rembourrage de la page.
          className="absolute left-1/2 top-12 z-30 w-44 -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-900 py-1 text-left shadow-xl"
        >
          <Item onClick={() => lire.mutate()} disabled={lire.isPending}>
            Lire l’album
          </Item>
          {session && (
            <Item onClick={() => ajouterALaFile.mutate()} disabled={ajouterALaFile.isPending}>
              Ajouter à la file
            </Item>
          )}
          <Item onClick={() => setPlaylistsOuvertes((etat) => !etat)}>
            Ajouter à une playlist…
          </Item>

          {playlistsOuvertes && (
            <div className="max-h-48 overflow-y-auto border-t border-neutral-800">
              {playlists.isLoading && (
                <p className="px-3 py-2 text-xs text-neutral-500">Chargement…</p>
              )}
              {!playlists.isLoading && modifiables.length === 0 && (
                <p className="px-3 py-2 text-xs text-neutral-500">
                  Aucune playlist à éditer.
                </p>
              )}
              {modifiables.map((playlist) => (
                <Item
                  key={playlist.id}
                  onClick={() => ajouterAUnePlaylist.mutate(playlist.id)}
                  disabled={ajouterAUnePlaylist.isPending}
                >
                  <span className="truncate">{playlist.name}</span>
                </Item>
              ))}
            </div>
          )}

          {erreur && <p className="px-3 py-2 text-xs text-red-300">{erreur.message}</p>}
        </div>
      )}
    </div>
  )
}

function Item({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      className="block w-full truncate px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
