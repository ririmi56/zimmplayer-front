/**
 * Rang à transmettre au serveur pour déposer l'élément de `from` au rang
 * d'insertion `insertAt`, ou `null` si cela ne le déplace pas.
 *
 * `move_item` retire d'abord l'élément de la liste puis l'insère : au-delà de
 * sa propre position, le rang visé se décale donc d'un cran. Déposer un titre
 * juste après lui-même le laisse sur place — c'est le cas que l'oubli de ce
 * décalage transformerait en déplacement d'un cran.
 */
export function dropTarget(from: number, insertAt: number): number | null {
  const to = insertAt > from ? insertAt - 1 : insertAt
  return to === from ? null : to
}
