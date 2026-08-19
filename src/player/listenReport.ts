import { useEffect, useRef } from 'react'
import { api, type Track } from '../api/client'

/** Plafond, en secondes. Doit rester aligne sur PLAFOND_S cote API. */
const PLAFOND_S = 240

/**
 * Secondes d'ecoute a partir desquelles un titre compte : la moitie, ou quatre
 * minutes. Regle de Last.fm.
 */
function seuil(duration: number | null | undefined): number {
  if (!duration || duration <= 0) return PLAFOND_S
  return Math.min(duration / 2, PLAFOND_S)
}

/**
 * Annonce au serveur les ecoutes solo, une fois le seuil franchi.
 *
 * Necessaire parce que l'API ne voit rien de cette lecture : hors session, elle
 * ne sert qu'une redirection vers le stockage, et le navigateur telecharge
 * ensuite directement. Lui seul sait ce qui a ete ecoute, et combien de temps.
 *
 * En session c'est l'inverse : le son sort du serveur, qui compte lui-meme —
 * ce hook n'a donc rien a y faire.
 *
 * Une annonce par passage sur un titre : `compte` est remis a zero au
 * changement de piste, pas a chaque rendu.
 */
export function useListenReport(track: Track | null, currentTime: number) {
  const compte = useRef<number | null>(null)

  useEffect(() => {
    if (!track) return
    if (compte.current === track.id) return
    if (currentTime < seuil(track.duration_s)) return

    compte.current = track.id
    // Une annonce perdue ne doit pas casser la lecture : c'est un compteur,
    // pas une transaction.
    void api.reportListen(track.id, currentTime).catch(() => undefined)
  }, [track, currentTime])

  // Rejouer le meme titre doit compter une seconde fois : on n'oublie le
  // marqueur qu'en revenant au debut.
  useEffect(() => {
    if (track && compte.current === track.id && currentTime < 1) {
      compte.current = null
    }
  }, [track, currentTime])
}
