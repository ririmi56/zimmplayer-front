/**
 * Ajoute ou retire un identifiant d'une liste, sans la modifier.
 *
 * Sert a la mise a jour optimiste des likes : le coeur doit repondre au clic
 * sans attendre le serveur. Ecrit a part parce que c'est exactement le genre
 * de ligne ou l'on finit par empiler deux fois le meme identifiant.
 */
export function toggleId(ids: readonly number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((autre) => autre !== id) : [...ids, id]
}
