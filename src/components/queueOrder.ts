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


/** Deplace un element de `from` vers `to`, sans modifier le tableau d'origine. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Ou se retrouve l'element qui etait au rang `i`, apres avoir deplace celui de
 * `from` vers `to`.
 *
 * Indispensable des que d'autres etats designent la file PAR SON RANG : le
 * lecteur local garde le titre courant dans `index` et l'ordre aleatoire dans
 * `order`, tous deux exprimes en rangs. Sans ce remappage, deplacer un titre
 * ferait sauter la lecture sur un autre — et l'aleatoire rejouerait certains
 * titres en en sautant d'autres.
 */
export function remapAfterMove(from: number, to: number, i: number): number {
  if (i === from) return to
  // Rang apres le retrait, puis apres la reinsertion.
  const afterRemoval = i - (i > from ? 1 : 0)
  return afterRemoval + (afterRemoval >= to ? 1 : 0)
}


/**
 * Ou se retrouve l'element qui etait au rang `i`, apres avoir retire celui de
 * `removed`. `null` si c'est lui qu'on retire.
 *
 * Meme raison d'etre que `remapAfterMove` : le lecteur local garde le titre
 * courant dans `index` et l'ordre aleatoire dans `order`, tous deux exprimes
 * en rangs de `queue`. Sans ce remappage, retirer un titre place avant le
 * titre courant ferait sauter la lecture d'un cran.
 */
export function remapAfterRemove(removed: number, i: number): number | null {
  if (i === removed) return null
  return i > removed ? i - 1 : i
}
