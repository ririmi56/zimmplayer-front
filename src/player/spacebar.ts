import { useEffect } from 'react'
import { useCurrentSession, useSessionControl } from '../state/session'
import { usePlayer } from './store'

/**
 * Éléments pour lesquels la barre d'espace garde son sens propre.
 *
 * Un bouton qui a le focus doit rester activable au clavier : c'est la seule
 * façon de s'en servir sans souris. Détourner l'espace partout casserait ça,
 * et rendrait en prime le raccourci imprévisible — sur le bouton lecture, les
 * deux effets s'annuleraient et il ne se passerait rien.
 */
const CIBLES_PROPRES = new Set(['input', 'textarea', 'select', 'button', 'a'])
const ROLES_PROPRES = new Set(['button', 'link', 'textbox', 'checkbox', 'switch'])

export type Frappe = {
  key: string
  /** Une touche de modification est enfoncée (Ctrl, Alt, Meta). */
  modifie: boolean
  /** Nom de balise de l'élément visé, en minuscules. */
  balise: string
  role: string | null
  editable: boolean
}

/**
 * La barre d'espace doit-elle basculer la lecture ?
 *
 * Isolé du hook parce que c'est ici que sont toutes les décisions, et qu'un
 * hook qui écoute la fenêtre ne se teste pas sans DOM.
 */
export function basculeSurEspace(frappe: Frappe): boolean {
  // `Spacebar` est la forme des vieux Edge ; les navigateurs actuels rendent
  // une espace toute simple.
  if (frappe.key !== ' ' && frappe.key !== 'Spacebar') return false
  // Ctrl+espace, Alt+espace : ce sont des raccourcis du système ou du
  // navigateur, on ne les prend pas.
  if (frappe.modifie) return false
  // Écrire une espace dans la recherche ne doit pas couper la musique.
  if (frappe.editable) return false
  if (CIBLES_PROPRES.has(frappe.balise)) return false
  return frappe.role !== null && ROLES_PROPRES.has(frappe.role) ? false : true
}

/**
 * Espace = lecture/pause, où qu'on soit dans l'application.
 *
 * Avant, la touche ne marchait que si le bouton lecture avait le focus — ce
 * n'était pas un raccourci, mais le comportement natif d'un bouton activé au
 * clavier. Monté une seule fois dans `App`, hors des routes : le raccourci
 * doit survivre à la navigation, comme la lecture.
 */
export function useEspaceLecture(): void {
  const control = useSessionControl()
  const { data: session } = useCurrentSession()
  const togglePlay = usePlayer((s) => s.togglePlay)
  const enSession = control.sessionId != null
  const joue = session?.is_playing ?? false

  useEffect(() => {
    const surTouche = (event: KeyboardEvent) => {
      const cible = event.target as HTMLElement | null
      if (
        !basculeSurEspace({
          key: event.key,
          modifie: event.ctrlKey || event.altKey || event.metaKey,
          balise: cible?.tagName.toLowerCase() ?? '',
          role: cible?.getAttribute?.('role') ?? null,
          editable: cible?.isContentEditable ?? false,
        })
      ) {
        return
      }
      // Sans cela, l'espace fait aussi défiler la page.
      event.preventDefault()
      if (enSession) {
        void (joue ? control.pause() : control.play())
      } else {
        togglePlay()
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [enSession, joue, control, togglePlay])
}
