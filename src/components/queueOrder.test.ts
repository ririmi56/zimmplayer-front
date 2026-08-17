import { describe, expect, it } from 'vitest'
import { dropTarget } from './queueOrder'

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
