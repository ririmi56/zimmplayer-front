import type { Album } from '../api/client'

/**
 * Separe les sorties completes des singles.
 *
 * L'API renvoie les deux dans `albums` : un single est un album a part entiere.
 * Le test porte sur `release_type === 'single'` et non sur l'inverse, pour
 * qu'une reponse d'une API plus ancienne (champ absent) reste classee en album.
 */
export function splitReleases(albums: Album[]): { albums: Album[]; singles: Album[] } {
  return {
    albums: albums.filter((album) => album.release_type !== 'single'),
    singles: albums.filter((album) => album.release_type === 'single'),
  }
}
