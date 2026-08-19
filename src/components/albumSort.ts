import type { AlbumSort } from '../api/client'

/**
 * Chaque tri porte son sens naturel : on parcourt un catalogue de A a Z, mais
 * on veut voir les derniers ajouts EN PREMIER. Les libelles disent donc le
 * sens, et le bouton d'inversion RETOURNE ce sens-la — il ne le remplace pas :
 * « Ajout récent » inverse donne les plus anciens, pas un tri croissant sur
 * une autre colonne.
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
  // Tous comptes confondus : ce qui plait dans la maison, pas ce que j'aime
  // moi — pour ca il y a l'onglet « Mes likes ».
  { value: 'likes', label: 'Les plus aimés' },
]

const VALUES = new Set(ALBUM_SORTS.map((sort) => sort.value))

/** Retient une valeur venue de l'URL, ou le tri par defaut si elle est inconnue. */
export function parseAlbumSort(raw: string | null): AlbumSort {
  return raw !== null && VALUES.has(raw as AlbumSort) ? (raw as AlbumSort) : 'artiste'
}


/** Retient le sens venu de l'URL. Absent = le sens naturel du tri. */
export function parseReverse(raw: string | null): boolean {
  return raw === 'inverse'
}

/**
 * Ce qu'il faut mettre dans l'URL pour ce tri et ce sens.
 *
 * L'etat par defaut ne s'ecrit pas : `/` doit rester `/`, sans `?tri=artiste`
 * accroche derriere. D'ou une fonction plutot qu'un objet monte a la main a
 * chaque appelant, qui finirait par oublier un des deux cas.
 */
export function albumSearchParams(sort: AlbumSort, reverse: boolean): Record<string, string> {
  const params: Record<string, string> = {}
  if (sort !== 'artiste') params.tri = sort
  if (reverse) params.sens = 'inverse'
  return params
}
