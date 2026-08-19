/**
 * Avatar de repli, dessine a partir du nom.
 *
 * Le fournisseur n'emet pas toujours de photo, et l'application tourne aussi
 * sans OIDC du tout : il faut donc toujours savoir quoi afficher. Deux
 * fonctions pures, pour qu'elles se testent sans monter de composant.
 */

/** Premiere lettre affichable du nom, en majuscule. « ? » si rien d'utilisable. */
export function initiale(nom: string): string {
  // `trim` puis recherche du premier caractere qui n'est pas un separateur :
  // un nom comme « _adrien » doit donner « A », pas « _ ».
  const lettre = [...nom.trim()].find((c) => /\p{L}|\p{N}/u.test(c))
  return lettre ? lettre.toLocaleUpperCase() : '?'
}

/**
 * Teinte stable pour un nom donne, en degres.
 *
 * Stable : la meme personne garde sa couleur d'une session a l'autre, sans
 * qu'on ait rien a stocker. Le hachage n'a pas a etre solide, seulement a
 * disperser — deux prenoms proches ne doivent pas se ressembler.
 */
export function teinte(graine: string): number {
  let hash = 0
  for (const caractere of graine) {
    hash = (hash * 31 + caractere.codePointAt(0)!) % 360000
  }
  return hash % 360
}
