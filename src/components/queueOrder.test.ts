import { describe, expect, it } from 'vitest'
import { dropTarget, moveItem, remapAfterMove, remapAfterRemove } from './queueOrder'

/**
 * Le serveur retire l'element avant de le reinserer : le rang d'insertion vu a
 * l'ecran n'est donc pas celui qu'il attend des qu'on descend un titre. Un
 * cran d'ecart ici se voit tout de suite a l'usage, mais pas a la relecture.
 */
describe('dropTarget', () => {
  it('descendre un titre compense le retrait prealable', () => {
    // [A B C D], A depose entre C et D -> insertAt 3, mais sans A la liste est
    // [B C D] : le rang attendu est 2.
    expect(dropTarget(0, 3)).toBe(2)
    expect(dropTarget(0, 2)).toBe(1)
  })

  it('remonter un titre garde le rang tel quel', () => {
    expect(dropTarget(3, 0)).toBe(0)
    expect(dropTarget(3, 2)).toBe(2)
  })

  it('deposer un titre sur lui-meme ne le deplace pas', () => {
    expect(dropTarget(2, 2)).toBeNull()
    // Juste apres lui-meme : la place est la meme, malgre un rang different.
    expect(dropTarget(2, 3)).toBeNull()
  })
})

describe('moveItem', () => {
  it('déplace vers le bas', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('déplace vers le haut', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('laisse le tableau d’origine intact', () => {
    const source = ['a', 'b', 'c']
    moveItem(source, 0, 2)
    expect(source).toEqual(['a', 'b', 'c'])
  })
})

describe('remapAfterMove', () => {
  /**
   * Le test qui a du mordant : pour chaque déplacement possible d'une liste de
   * six, on vérifie que `remapAfterMove` désigne bien, dans la liste déplacée,
   * l'élément qui occupait le rang de départ. Un décalage d'un cran quelque
   * part ferait échouer au moins un cas.
   */
  it('suit chaque élément, pour tous les déplacements d’une liste de six', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f']
    for (let from = 0; from < source.length; from++) {
      for (let to = 0; to < source.length; to++) {
        const moved = moveItem(source, from, to)
        for (let i = 0; i < source.length; i++) {
          expect(moved[remapAfterMove(from, to, i)]).toBe(source[i])
        }
      }
    }
  })

  it('une permutation reste une permutation', () => {
    const rangs = [0, 1, 2, 3, 4].map((i) => remapAfterMove(1, 3, i))
    expect([...rangs].sort()).toEqual([0, 1, 2, 3, 4])
  })
})

describe('remapAfterRemove', () => {
  it('decale les rangs situes apres le retrait', () => {
    expect(remapAfterRemove(1, 2)).toBe(1)
    expect(remapAfterRemove(1, 5)).toBe(4)
  })

  it('laisse en place les rangs situes avant', () => {
    expect(remapAfterRemove(3, 0)).toBe(0)
    expect(remapAfterRemove(3, 2)).toBe(2)
  })

  it("signale l'element retire lui-meme", () => {
    expect(remapAfterRemove(2, 2)).toBeNull()
  })

  it('reste coherent applique a tout un ordre aleatoire', () => {
    const ordre = [3, 0, 4, 1, 2]
    const apres = ordre.map((i) => remapAfterRemove(1, i)).filter((i) => i !== null)
    // Le rang 1 disparait, les rangs superieurs reculent d'un cran, et
    // l'ordre relatif des survivants ne bouge pas.
    expect(apres).toEqual([2, 0, 3, 1])
  })
})
