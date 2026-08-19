import { describe, expect, it } from 'vitest'
import { ALBUM_SORTS, parseAlbumSort } from './albumSort'

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
