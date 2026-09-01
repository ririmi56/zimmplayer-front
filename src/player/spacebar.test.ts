import { describe, expect, it } from 'vitest'
import { basculeSurEspace, type Frappe } from './spacebar'

/** Une frappe d'espace sur le corps de la page : le cas nominal. */
const frappe = (surcharge: Partial<Frappe> = {}): Frappe => ({
  key: ' ',
  modifie: false,
  balise: 'div',
  role: null,
  editable: false,
  ...surcharge,
})

describe('basculeSurEspace', () => {
  it('bascule sur une espace n’importe où dans la page', () => {
    expect(basculeSurEspace(frappe())).toBe(true)
    expect(basculeSurEspace(frappe({ balise: 'body' }))).toBe(true)
    expect(basculeSurEspace(frappe({ balise: 'li' }))).toBe(true)
  })

  it('accepte la forme `Spacebar` des vieux Edge', () => {
    expect(basculeSurEspace(frappe({ key: 'Spacebar' }))).toBe(true)
  })

  it('ignore les autres touches', () => {
    for (const key of ['a', 'Enter', 'ArrowRight', 'Escape', 'Space'])
      expect(basculeSurEspace(frappe({ key }))).toBe(false)
  })

  it('laisse écrire une espace dans un champ', () => {
    // Le défaut le plus probable si l'on oublie ce cas : la recherche
    // deviendrait inutilisable, chaque mot coupant la musique.
    expect(basculeSurEspace(frappe({ balise: 'input' }))).toBe(false)
    expect(basculeSurEspace(frappe({ balise: 'textarea' }))).toBe(false)
    expect(basculeSurEspace(frappe({ balise: 'div', editable: true }))).toBe(false)
    expect(basculeSurEspace(frappe({ balise: 'div', role: 'textbox' }))).toBe(false)
  })

  it('laisse un bouton qui a le focus garder l’espace', () => {
    // Sinon le raccourci et le bouton s'annuleraient sur le bouton lecture —
    // et plus aucun bouton ne serait activable au clavier.
    expect(basculeSurEspace(frappe({ balise: 'button' }))).toBe(false)
    expect(basculeSurEspace(frappe({ balise: 'a' }))).toBe(false)
    expect(basculeSurEspace(frappe({ balise: 'select' }))).toBe(false)
    expect(basculeSurEspace(frappe({ balise: 'div', role: 'button' }))).toBe(false)
  })

  it('laisse passer les raccourcis du système', () => {
    expect(basculeSurEspace(frappe({ modifie: true }))).toBe(false)
  })

  it('ne se laisse pas berner par un rôle inoffensif', () => {
    expect(basculeSurEspace(frappe({ role: 'presentation' }))).toBe(true)
  })
})
