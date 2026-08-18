import { useEffect, useRef } from 'react'
import { useCurrentSession } from '../state/session'

/** Duree du tampon, en secondes. */
const SECONDES = 10
const TAUX = 8000
/**
 * Frequence du ton, en hertz. Sous la bande audible (l'oreille commence vers
 * 20 Hz) et sous ce que reproduit n'importe quel haut-parleur : rien ne
 * s'entend, quel que soit le volume.
 *
 * 3 Hz sur 10 s a 8 kHz fait exactement 30 periodes : la boucle se referme
 * sans discontinuite, donc sans clic a chaque tour.
 */
const HERTZ = 3
/**
 * Amplitude. Chromium declare silencieux tout flux sous -72,25 dBFS
 * (`kSilenceThresholdDBFS`, services/audio/output_stream.cc), soit une
 * amplitude de 0,000244. On se place seize fois au-dessus, ce qui reste 130
 * pas de quantification sur 32768.
 */
const AMPLITUDE = 0.004

let cache: string | null = null

/**
 * Un WAV inaudible, fabrique une seule fois pour toute l'application.
 *
 * Ce n'est PAS du silence, et c'est tout l'enjeu : Chrome ne se fie pas au fait
 * qu'un media joue, il mesure la puissance du flux. Un tampon de zeros est a
 * -infini dBFS, l'onglet est declare silencieux, et aucun controle n'apparait.
 * Il faut donc emettre quelque chose — d'ou un ton subsonique, au-dessus du
 * seuil de mesure et au-dessous de l'audition.
 *
 * Volontairement hors du composant et jamais revoquee. En mode strict, React
 * monte, demonte et remonte : revoquer dans le nettoyage d'un effet detruisait
 * la source entre les deux, `duration` restait a NaN et la lecture etait
 * refusee.
 */
function tonInaudible(): string {
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

  for (let i = 0; i < echantillons; i++) {
    const valeur = Math.sin((2 * Math.PI * HERTZ * i) / TAUX) * AMPLITUDE
    vue.setInt16(44 + i * 2, Math.round(valeur * 32767), true)
  }

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
 * Cet element existe uniquement pour combler ce vide. Il ne porte pas le son —
 * le chemin audio de Snapcast n'est pas touche, sa latence etant critique —
 * seulement la presence.
 *
 * Il n'est volontairement ni `muted` ni silencieux : Chrome ignore les elements
 * muets, et mesure la puissance des autres. Voir `tonInaudible`.
 */
export function SessionPresence() {
  const { data: session } = useCurrentSession()
  const audioRef = useRef<HTMLAudioElement>(null)
  const source = tonInaudible()

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
