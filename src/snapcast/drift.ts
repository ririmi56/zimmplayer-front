/**
 * Estimation de la dérive entre l'horloge locale et celle de l'AudioContext.
 *
 * Le problème que ce module résout : `AudioContext.currentTime` n'est PAS une
 * horloge lisse. Elle rend l'instant du dernier bloc rendu, et sous charge ce
 * rendu se met en retard — mesuré sur cette machine : un pas médian de 2,7 ms,
 * mais des pauses allant jusqu'à 64 ms. Comparer `performance.now()` à
 * `currentTime` à un instant quelconque donne donc une valeur bruitée de
 * plusieurs dizaines de millisecondes, alors que la dérive réelle entre deux
 * quartz est de l'ordre de quelques millisecondes par dizaine de minutes.
 *
 * Une mesure isolée ne peut pas servir à décider d'un recalage : c'est le
 * défaut du 2026-08-20, où le seuil de 15 ms était franchi 211 fois en 45
 * secondes, chaque franchissement produisant un trou ou un recouvrement de
 * 15 à 20 ms dans un morceau qui en dure 20.
 *
 * **Le bruit ne va que dans un sens.** `currentTime` ne peut que RETARDER sur
 * le temps réel : elle ne rend jamais un bloc qui n'a pas encore été rendu.
 * Une mesure contaminée est donc toujours trop GRANDE, jamais trop petite. La
 * mesure la moins contaminée d'une fenêtre est celle qui est la plus basse —
 * d'où le minimum, et non la médiane que l'on prendrait pour un bruit
 * symétrique (voir `ServerClock`, dont le bruit réseau, lui, l'est).
 */

/**
 * Nombre de mesures conservées. Un morceau dure 20 ms, donc une fenêtre de 50
 * couvre environ une seconde : assez long pour contenir une pause de rendu et
 * les mesures propres qui l'encadrent, assez court pour qu'une dérive réelle
 * — qui met des minutes à s'installer — ne soit pas retardée pour autant.
 */
export const DRIFT_WINDOW = 50

/**
 * Dérive retenue pour une fenêtre de mesures : la moins contaminée, donc la
 * plus basse. Rend `null` tant que la fenêtre n'est pas pleine — décider sur
 * trois mesures reviendrait à décider sur du bruit.
 */
export function estimatedDrift(samples: number[]): number | null {
  if (samples.length < DRIFT_WINDOW) return null
  return Math.min(...samples)
}
