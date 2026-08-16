import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browserClientId } from './client'

describe('browserClientId', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("n'exige pas de contexte sécurisé", () => {
    // Ouverte sur `http://<ip>`, l'application n'a pas `crypto.randomUUID` :
    // s'en servir rendait l'écran Configuration inutilisable hors localhost.
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(browserClientId()).toMatch(/^web-[0-9a-f]{8}$/)
  })

  it('reste stable entre deux appels', () => {
    expect(browserClientId()).toBe(browserClientId())
  })
})
