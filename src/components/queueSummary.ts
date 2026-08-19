/**
 * Ce qu'on annonce en tete de la file : combien de titres, combien de joues,
 * et combien de temps il reste.
 *
 * Fonction pure, sur la forme minimale d'une entree : la file de la session
 * et celle du lecteur local n'ont pas la meme, et ce calcul n'a pas a le
 * savoir.
 */
export type Compte = {
  played: boolean
  current: boolean
  /**
   * Obligatoire, et jamais optionnel : rendre ce champ facultatif laisserait
   * passer un objet qui porte sa duree ailleurs — c'est arrive, et le total
   * affichait alors « 0 min » sans que rien ne proteste.
   */
  duration_s: number | null
}

export type Resume = {
  total: number
  /** Deja joues, le titre en cours non compris : il n'est pas fini. */
  joues: number
  /** Le titre en cours et tout ce qui suit. */
  restantSecondes: number
  totalSecondes: number
}

export function resumer(entrees: Compte[]): Resume {
  let joues = 0
  let restantSecondes = 0
  let totalSecondes = 0

  for (const entree of entrees) {
    // Une duree inconnue vaut zero plutot que NaN : mieux vaut un total un
    // peu court qu'un « NaN min » a l'ecran.
    const duree = entree.duration_s ?? 0
    totalSecondes += duree
    if (entree.played && !entree.current) joues += 1
    else restantSecondes += duree
  }

  return { total: entrees.length, joues, restantSecondes, totalSecondes }
}
