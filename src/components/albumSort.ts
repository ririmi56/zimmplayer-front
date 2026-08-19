import type { AlbumSort } from '../api/client'

/**
 * Chaque tri porte son sens naturel : on parcourt un catalogue de A a Z, mais
 * on veut voir les derniers ajouts EN PREMIER. Un menu unique suffit donc, sans
 * bouton croissant/decroissant — les libelles disent le sens.
 *
 * Module a part du composant : y exporter autre chose qu'un composant prive le
 * fichier du rafraichissement a chaud de Vite (regle react/only-export-components).
 */
export const ALBUM_SORTS: { value: AlbumSort; label: string }[] = [
  { value: 'artiste', label: 'Artiste' },
  { value: 'titre', label: 'Titre' },
  { value: 'annee', label: 'Année récente' },
  { value: 'ajout', label: 'Ajout récent' },
  { value: 'genre', label: 'Genre' },
]

const VALUES = new Set(ALBUM_SORTS.map((sort) => sort.value))

/** Retient une valeur venue de l'URL, ou le tri par defaut si elle est inconnue. */
export function parseAlbumSort(raw: string | null): AlbumSort {
  return raw !== null && VALUES.has(raw as AlbumSort) ? (raw as AlbumSort) : 'artiste'
}
