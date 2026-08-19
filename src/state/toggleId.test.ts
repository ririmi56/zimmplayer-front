import { describe, expect, it } from 'vitest'
import { toggleId } from './toggleId'

describe('toggleId', () => {
  it('ajoute ce qui est absent', () => {
    expect(toggleId([1, 2], 3)).toEqual([1, 2, 3])
  })

  it('retire ce qui est present', () => {
    expect(toggleId([1, 2, 3], 2)).toEqual([1, 3])
  })

  it('ne cree jamais de doublon', () => {
    // Deux clics rapides : sans le test d'appartenance, le second empilerait
    // l'identifiant une seconde fois et le coeur ne s'eteindrait plus.
    expect(toggleId(toggleId([1], 2), 2)).toEqual([1])
  })

  it('ne modifie pas la liste d’origine', () => {
    const depart = [1, 2]
    toggleId(depart, 3)
    expect(depart).toEqual([1, 2])
  })

  it('part d’une liste vide sans broncher', () => {
    expect(toggleId([], 7)).toEqual([7])
    expect(toggleId([], 7)).not.toBe(undefined)
  })
})
