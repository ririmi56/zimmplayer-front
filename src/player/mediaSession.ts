import { useEffect } from 'react'
import { coverUrl } from '../api/client'
import { useCurrentSession, useSessionControl } from '../state/session'
import { useNowPlaying } from './nowPlaying'
import { usePlayer } from './store'

/**
 * Expose la lecture aux commandes media du navigateur et du systeme.
 *
 * C'est ce qui fait apparaitre le titre dans le centre multimedia de Chrome,
 * sur l'ecran de verrouillage, et qui rend les touches media du clavier
 * actives. Les commandes repartent vers la bonne sortie : le lecteur local
 * hors session, la file partagee en session — dans ce dernier cas, appuyer sur
 * « pause » met en pause POUR TOUT LE MONDE, ce qui est bien le sens d'une
 * ecoute partagee.
 *
 * Le volume n'y figure pas : l'API Media Session ne l'expose pas. Le clavier
 * et le systeme continuent d'agir sur le volume general de la sortie, et le
 * curseur de l'application sur celui de cette lecture-ci.
 */
export function useMediaSession() {
  const track = useNowPlaying()
  const { data: session } = useCurrentSession()
  const control = useSessionControl()

  const isPlayingLocal = usePlayer((s) => s.isPlaying)
  const inSession = session != null
  const isPlaying = inSession ? (session?.is_playing ?? false) : isPlayingLocal

  // --- Ce qui est affiche -------------------------------------------------
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist_name,
      album: track.album_title,
      // Plusieurs tailles : le systeme choisit selon l'endroit ou il affiche
      // la pochette, d'une vignette de notification a un ecran de verrouillage.
      artwork: track.has_cover
        ? [
            { src: coverUrl(track.album_id, 'thumb'), sizes: '256x256', type: 'image/jpeg' },
            { src: coverUrl(track.album_id, 'full'), sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    })
  }, [track])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = track ? (isPlaying ? 'playing' : 'paused') : 'none'
  }, [track, isPlaying])

  // --- Ce qui repart vers la lecture --------------------------------------
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const actions: [MediaSessionAction, MediaSessionActionHandler | null][] = inSession
      ? [
          ['play', () => void control.play()],
          ['pause', () => void control.pause()],
          ['previoustrack', () => void control.previous()],
          ['nexttrack', () => void control.next()],
          ['seekto', (details) => {
            if (details.seekTime != null) void control.seek(details.seekTime)
          }],
          ['stop', () => void control.pause()],
        ]
      : [
          ['play', () => usePlayer.setState({ isPlaying: true })],
          ['pause', () => usePlayer.setState({ isPlaying: false })],
          ['previoustrack', () => usePlayer.getState().previous()],
          ['nexttrack', () => usePlayer.getState().next()],
          ['seekto', (details) => {
            if (details.seekTime != null) usePlayer.getState().requestSeek(details.seekTime)
          }],
          ['stop', () => usePlayer.setState({ isPlaying: false })],
        ]

    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Toutes les actions ne sont pas connues de tous les navigateurs :
        // celles qui manquent sont simplement ignorees.
      }
    }
    return () => {
      for (const [action] of actions) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // idem
        }
      }
    }
  }, [inSession, control])
}

/**
 * Renseigne la barre de progression des commandes systeme.
 *
 * Separe du reste parce que la source differe : hors session elle vient de
 * l'element <audio>, en session du serveur. Les valeurs sont verifiees avant
 * d'etre transmises — `setPositionState` leve si la duree est absente, nulle
 * ou depassee par la position, ce qui arrive a chaque changement de piste.
 */
export function useMediaPosition(position: number, duration: number, isPlaying: boolean) {
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return
    if (!Number.isFinite(duration) || duration <= 0) {
      navigator.mediaSession.setPositionState()
      return
    }
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.max(0, Math.min(position, duration)),
        playbackRate: isPlaying ? 1 : 0,
      })
    } catch {
      // Valeurs incoherentes le temps d'un rendu : sans effet.
    }
  }, [position, duration, isPlaying])
}
