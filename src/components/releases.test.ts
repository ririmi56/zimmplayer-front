import { describe, expect, it } from 'vitest'
import type { Album } from '../api/client'
import { splitReleases } from './releases'

function album(title: string, release_type?: string): Album {
  return {
    id: 1,
    title,
    year: null,
    artist_id: 1,
    artist_name: 'Artiste',
    release_type: release_type as Album['release_type'],
    has_cover: false,
    track_count: 1,
    genre: null,
    overrides: {},
  }
}

describe('splitReleases', () => {
  it('separe albums et singles en gardant l’ordre', () => {
    const { albums, singles } = splitReleases([
      album('Album A', 'album'),
      album('Single A', 'single'),
      album('Album B', 'album'),
    ])
    expect(albums.map((a) => a.title)).toEqual(['Album A', 'Album B'])
    expect(singles.map((a) => a.title)).toEqual(['Single A'])
  })

  it('classe en album un champ absent (API plus ancienne)', () => {
    const { albums, singles } = splitReleases([album('Sans type')])
    expect(albums.map((a) => a.title)).toEqual(['Sans type'])
    expect(singles).toEqual([])
  })
})
