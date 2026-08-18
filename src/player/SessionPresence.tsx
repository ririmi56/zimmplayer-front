import { useEffect, useRef } from 'react'
import { useCurrentSession } from '../state/session'

/** Duree du silence, en secondes. */
const SECONDES = 10
const TAUX = 8000

/**
 * Un WAV de silence, fabrique une fois.
 *
 * Sa duree compte : Chromium classe en `kTransient` tout media de 5 s ou moins
 * (media/base/media_content_type.cc), et un media transitoire n'obtient pas de
 * contrôles. D'ou les 10 s, bouclees.
 *
 * 8 kHz mono suffit — on n'y entend rien par construction — et garde le tampon
 * sous les 200 ko.
 */
let cache: string | null = null

/**
 * L'URL du silence, fabriquee une seule fois pour toute l'application.
 *
 * Volontairement hors du composant, et jamais revoquee. En mode strict, React
 * monte, demonte et remonte chaque composant : une revocation dans le nettoyage
 * d'un effet detruisait l'URL entre les deux, et l'element se retrouvait avec
 * une source morte — `duration` a NaN et lecture impossible. Un seul Blob vit
 * donc aussi longtemps que le document, ce qui ne coute rien.
 */
function silence(): string {
  if (cache !== null) return cache
  const echantillons = TAUX * SECONDES
  const buffer = new ArrayBuffer(44 + echantillons * 2)
  const vue = new DataView(buffer)
  const texte = (offset: number, valeur: string) =>
    [...valeur].forEach((c, i) => vue.setUint8(offset + i, c.charCodeAt(0)))

  texte(0, 'RIFF')
  vue.setUint32(4, 36 + echantillons * 2, true)
  texte(8, 'WAVEfmt ')
  vue.setUint32(16, 16, true)
  vue.setUint16(20, 1, true)
  vue.setUint16(22, 1, true)
  vue.setUint32(24, TAUX, true)
  vue.setUint32(28, TAUX * 2, true)
  vue.setUint16(32, 2, true)
  vue.setUint16(34, 16, true)
  texte(36, 'data')
  vue.setUint32(40, echantillons * 2, true)
  // Le reste du tampon vaut deja zero : c'est le silence.
  cache = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
  return cache
}

/**
 * Donne au navigateur un media a detecter pendant une session.
 *
 * En session, ce navigateur ne joue rien qu'un `<audio>` : avec « Ecouter
 * ici » le son sort de Web Audio, sans lui il sort des enceintes et le
 * navigateur n'est qu'une telecommande. Dans les deux cas Chrome ne voit aucun
 * media, donc n'affiche aucun controle et ignore les touches media du clavier.
 *
 * Cet element silencieux existe uniquement pour combler ce vide. Il ne porte
 * pas le son — le chemin audio de Snapcast n'est pas touche, sa latence etant
 * critique — seulement la presence.
 *
 * Il n'est volontairement PAS `muted` : Chrome ignore les elements muets. Le
 * contenu, lui, est du silence numerique, donc rien ne s'entend.
 */
export function SessionPresence() {
  const { data: session } = useCurrentSession()
  const audioRef = useRef<HTMLAudioElement>(null)
  const source = silence()

  const enLecture = session?.is_playing ?? false

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!enLecture) {
      audio.pause()
      return
    }

    // Rechargement de page pendant une session : il n'y a pas eu de geste
    // utilisateur, la lecture automatique est refusee. On reessaie au premier
    // geste venu plutot que d'abandonner les commandes jusqu'au prochain clic
    // sur un bouton de l'application.
    const lancer = () => audio.play().catch(() => undefined)
    void lancer()

    const surGeste = () => void lancer()
    document.addEventListener('pointerdown', surGeste, { once: true })
    document.addEventListener('keydown', surGeste, { once: true })
    return () => {
      document.removeEventListener('pointerdown', surGeste)
      document.removeEventListener('keydown', surGeste)
    }
  }, [enLecture, source])

  return <audio ref={audioRef} src={source} loop preload="auto" aria-hidden />
}
