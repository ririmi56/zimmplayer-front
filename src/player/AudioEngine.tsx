import { useEffect, useRef } from 'react'
import { streamUrl } from '../api/client'
import { useMediaPosition } from './mediaSession'
import { currentTrack, usePlayer } from './store'

/**
 * L'unique element <audio> de l'application, monte a la racine.
 *
 * Il doit imperativement vivre hors des composants de route : s'il etait rendu
 * dans une page, changer de page le demonterait et couperait la lecture. Toute
 * l'interface ne fait que piloter le store, ce composant se contente de
 * refleter l'etat du store sur l'element audio.
 *
 * N'existe que pour l'ecoute solo, hors session : rejoindre une session, c'est
 * se synchroniser via Snapcast, dont le lecteur vit dans `RemoteBar`.
 */
export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const track = usePlayer(currentTrack)
  const { isPlaying, volume, muted, seekTo } = usePlayer()
  const next = usePlayer((s) => s.next)
  const setProgress = usePlayer((s) => s.setProgress)
  const clearSeek = usePlayer((s) => s.clearSeek)
  const currentTime = usePlayer((s) => s.currentTime)
  const duration = usePlayer((s) => s.duration)

  useMediaPosition(currentTime, duration, isPlaying)

  // Changement de piste : on ne recharge la source que si elle change vraiment,
  // sinon chaque rendu redemarrerait le morceau depuis le debut.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    const url = streamUrl(track.id)
    if (audio.getAttribute('data-track') !== String(track.id)) {
      audio.setAttribute('data-track', String(track.id))
      audio.src = url
      audio.load()
    }
  }, [track])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track) return
    if (isPlaying) {
      audio.play().catch(() => usePlayer.setState({ isPlaying: false }))
    } else {
      audio.pause()
    }
  }, [isPlaying, track])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = volume
      audio.muted = muted
    }
  }, [volume, muted])

  useEffect(() => {
    const audio = audioRef.current
    if (audio && seekTo !== null) {
      audio.currentTime = seekTo
      clearSeek()
    }
  }, [seekTo, clearSeek])

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime, e.currentTarget.duration || 0)}
      onLoadedMetadata={(e) => setProgress(e.currentTarget.currentTime, e.currentTarget.duration || 0)}
      onEnded={() => next(true)}
      onError={() => usePlayer.setState({ isPlaying: false })}
    />
  )
}
