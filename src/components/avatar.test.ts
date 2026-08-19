import { describe, expect, it } from 'vitest'
import { initiale, teinte } from './avatar'

describe('initiale', () => {
  it('prend la premiere lettre, en majuscule', () => {
    expect(initiale('adrien')).toBe('A')
    expect(initiale('Béatrice')).toBe('B')
  })

  it('ignore les espaces et la ponctuation de tete', () => {
    expect(initiale('  adrien')).toBe('A')
    expect(initiale('_adrien')).toBe('A')
  })

  it('accepte un chiffre', () => {
    expect(initiale('4chan')).toBe('4')
  })

  it('garde les alphabets non latins', () => {
    expect(initiale('祖堅')).toBe('祖')
  })

  it('ne rend jamais rien : « ? » plutot que du vide', () => {
    expect(initiale('')).toBe('?')
    expect(initiale('   ')).toBe('?')
    expect(initiale('!!!')).toBe('?')
  })
})

describe('teinte', () => {
  it('est stable pour un meme nom', () => {
    expect(teinte('Adrien')).toBe(teinte('Adrien'))
  })

  it('separe deux noms proches', () => {
    expect(teinte('Adrien')).not.toBe(teinte('Adrien2'))
    expect(teinte('Bea')).not.toBe(teinte('Bee'))
  })

  it('reste un angle valide', () => {
    for (const nom of ['', 'a', 'Adrien', 'x'.repeat(200), '祖堅 正慶']) {
      const t = teinte(nom)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThan(360)
    }
  })
})
