import { describe, expect, it } from 'vitest'
import { ALBUM_SORTS, albumSearchParams, parseAlbumSort, parseReverse } from './albumSort'

describe('parseAlbumSort', () => {
  it('retient les tris proposes', () => {
    for (const sort of ALBUM_SORTS) {
      expect(parseAlbumSort(sort.value)).toBe(sort.value)
    }
  })

  it('retombe sur le tri par defaut quand l’URL est absente ou fantaisiste', () => {
    // `?tri=` vient de l'utilisateur : une valeur inconnue partirait telle
    // quelle vers l'API, qui repondrait 422 et casserait la page.
    expect(parseAlbumSort(null)).toBe('artiste')
    expect(parseAlbumSort('')).toBe('artiste')
    expect(parseAlbumSort('Artiste')).toBe('artiste')
    expect(parseAlbumSort('duree')).toBe('artiste')
  })
})

describe('parseReverse', () => {
  it('ne retourne que sur la valeur attendue', () => {
    expect(parseReverse('inverse')).toBe(true)
    expect(parseReverse(null)).toBe(false)
    expect(parseReverse('')).toBe(false)
    expect(parseReverse('true')).toBe(false)
    expect(parseReverse('Inverse')).toBe(false)
  })
})

describe('albumSearchParams', () => {
  it('n’écrit rien pour l’état par défaut', () => {
    // Sinon « / » deviendrait « /?tri=artiste » au premier affichage.
    expect(albumSearchParams('artiste', false)).toEqual({})
  })

  it('n’écrit que ce qui s’écarte du défaut', () => {
    expect(albumSearchParams('titre', false)).toEqual({ tri: 'titre' })
    expect(albumSearchParams('artiste', true)).toEqual({ sens: 'inverse' })
    expect(albumSearchParams('annee', true)).toEqual({ tri: 'annee', sens: 'inverse' })
  })

  it('fait l’aller-retour avec les analyseurs', () => {
    for (const sort of ALBUM_SORTS) {
      for (const reverse of [false, true]) {
        const params = albumSearchParams(sort.value, reverse)
        expect(parseAlbumSort(params.tri ?? null)).toBe(sort.value)
        expect(parseReverse(params.sens ?? null)).toBe(reverse)
      }
    }
  })
})
