import { describe, expect, it } from 'vitest'
import { resumer } from './queueSummary'
import { formatSpan } from './format'

const e = (played: boolean, current: boolean, duration_s: number | null = 60) =>
  ({ played, current, duration_s })

describe('resumer', () => {
  it('compte les titres et ceux deja joues', () => {
    const r = resumer([e(true, false), e(false, true), e(false, false)])
    expect(r.total).toBe(3)
    expect(r.joues).toBe(1)
  })

  it("ne compte pas le titre en cours comme joue : il n'est pas fini", () => {
    // En session, le titre courant porte aussi `played` selon la source.
    expect(resumer([e(true, true)]).joues).toBe(0)
  })

  it('fait rentrer le titre en cours dans le temps restant', () => {
    const r = resumer([e(true, false, 100), e(false, true, 200), e(false, false, 300)])
    expect(r.restantSecondes).toBe(500)
    expect(r.totalSecondes).toBe(600)
  })

  it('traite une duree inconnue comme zero, jamais comme NaN', () => {
    // Ecrit en clair : passer `undefined` au helper reveillerait sa valeur
    // par defaut, et le test ne prouverait plus rien.
    const r = resumer([
      { played: false, current: true, duration_s: null },
      { played: false, current: false, duration_s: null },
    ])
    expect(Number.isNaN(r.restantSecondes)).toBe(false)
    expect(r.restantSecondes).toBe(0)
  })

  it('gere la file vide', () => {
    expect(resumer([])).toEqual({ total: 0, joues: 0, restantSecondes: 0, totalSecondes: 0 })
  })

  it('gere une file entierement jouee', () => {
    const r = resumer([e(true, false, 60), e(true, false, 60)])
    expect(r.joues).toBe(2)
    expect(r.restantSecondes).toBe(0)
  })
})

describe('formatSpan', () => {
  it('reste en minutes sous une heure', () => {
    expect(formatSpan(0)).toBe('0 min')
    expect(formatSpan(240)).toBe('4 min')
    expect(formatSpan(3540)).toBe('59 min')
  })

  it('passe aux heures au-dela', () => {
    expect(formatSpan(3600)).toBe('1 h')
    expect(formatSpan(4380)).toBe('1 h 13')
    expect(formatSpan(7200)).toBe('2 h')
  })

  it('rembourre les minutes, pour ne pas lire « 1 h 5 » comme 1 h 50', () => {
    expect(formatSpan(3900)).toBe('1 h 05')
  })
})
