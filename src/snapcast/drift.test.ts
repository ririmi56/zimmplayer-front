import { describe, expect, it } from 'vitest'
import { DRIFT_WINDOW, estimatedDrift } from './drift'

/** Une fenêtre pleine, toutes les mesures à la même valeur. */
const plate = (valeur: number) => new Array(DRIFT_WINDOW).fill(valeur)

/**
 * Le défaut reproduit ici est celui du 2026-08-20 : sur 45 secondes de
 * lecture, 211 recalages se sont déclenchés, un pour chaque pic de mesure —
 * et chacun a produit un trou de 15 à 20 ms dans un morceau qui en dure 20.
 */
describe('estimatedDrift', () => {
  it('ne décide rien tant que la fenêtre n’est pas pleine', () => {
    // Trois mesures, c'est du bruit : agir dessus est exactement le défaut.
    expect(estimatedDrift([18, 20, 19])).toBeNull()
    expect(estimatedDrift(new Array(DRIFT_WINDOW - 1).fill(30))).toBeNull()
  })

  it('ignore les pics isolés de retard de rendu', () => {
    // Une seconde de mesures propres, avec trois blocages du rendu audio.
    const mesures = plate(2)
    mesures[7] = 19
    mesures[23] = 64
    mesures[41] = 21
    // Sans fenêtre, chacun de ces trois pics aurait déclenché un recalage.
    expect(estimatedDrift(mesures)).toBe(2)
  })

  it('retient une dérive réelle, qui elle est présente partout', () => {
    // Une vraie dérive décale TOUTES les mesures, pics compris.
    const mesures = plate(17)
    mesures[10] = 55
    expect(estimatedDrift(mesures)).toBe(17)
  })

  it('retient une dérive négative telle quelle', () => {
    // L'horloge de la carte son peut avancer plus vite que celle du système.
    expect(estimatedDrift(plate(-18))).toBe(-18)
  })

  it('prend la plus basse, jamais la médiane', () => {
    // La contamination ne va que dans un sens : `currentTime` ne rend jamais
    // un bloc pas encore rendu, donc une mesure fausse est toujours TROP
    // GRANDE. La médiane d'une fenêtre à moitié contaminée resterait haute.
    const mesures = plate(40)
    for (let i = 0; i < DRIFT_WINDOW / 2; i++) mesures[i] = 3
    expect(estimatedDrift(mesures)).toBe(3)
  })

  it('supporte une fenêtre longue sans déborder la pile', () => {
    // `Math.min(...tableau)` s'écroule sur des dizaines de milliers d'éléments ;
    // la fenêtre est bornée, ce test le rappelle si elle grandissait.
    expect(DRIFT_WINDOW).toBeLessThanOrEqual(1000)
    expect(estimatedDrift(plate(5))).toBe(5)
  })
})
