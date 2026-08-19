import { beforeEach, describe, expect, it } from 'vitest'
import type { Track } from '../api/client'
import { usePlayer } from './store'

const piste = (title: string) => ({ id: title.charCodeAt(0), title }) as unknown as Track
const TITRES = ['a', 'b', 'c', 'd', 'e', 'f']

/** Les titres joués si l'on enchaîne jusqu'au bout, sans toucher à l'état final. */
function sequence(): string[] {
  const depart = usePlayer.getState()
  const vus = [depart.queue[depart.index].title]
  for (let i = 0; i < TITRES.length; i++) {
    usePlayer.getState().next()
    const { queue, index, isPlaying } = usePlayer.getState()
    if (!isPlaying) break
    vus.push(queue[index].title)
  }
  usePlayer.setState(depart)
  return vus
}

describe('usePlayer.move', () => {
  beforeEach(() => {
    usePlayer.setState({ shuffle: false, repeat: 'off', order: [] })
    usePlayer.getState().playQueue(TITRES.map(piste), 2)
  })

  it('réordonne la file', () => {
    usePlayer.getState().move(0, 3)
    expect(usePlayer.getState().queue.map((t) => t.title)).toEqual(['b', 'c', 'd', 'a', 'e', 'f'])
  })

  it('garde le titre en cours, même déplacé', () => {
    expect(usePlayer.getState().queue[usePlayer.getState().index].title).toBe('c')
    usePlayer.getState().move(2, 5)
    expect(usePlayer.getState().queue[usePlayer.getState().index].title).toBe('c')
  })

  it('garde le titre en cours quand un AUTRE titre passe par-dessus lui', () => {
    usePlayer.getState().move(5, 0)
    expect(usePlayer.getState().queue[usePlayer.getState().index].title).toBe('c')
  })

  it('ne change pas la suite en lecture aléatoire', () => {
    usePlayer.setState({ shuffle: true, repeat: 'all' })
    usePlayer.getState().playQueue(TITRES.map(piste), 2)
    const avant = sequence()

    usePlayer.getState().move(4, 1)
    // C'est toute la raison d'etre du remappage de `order` : deplacer un titre
    // dans la liste ne doit pas rebattre l'ordre de lecture tire au sort.
    expect(sequence()).toEqual(avant)
  })

  it('ignore un déplacement sans effet ou hors de la file', () => {
    const avant = usePlayer.getState().queue
    for (const [from, to] of [[2, 2], [-1, 0], [0, 9], [9, 0]]) {
      usePlayer.getState().move(from, to)
    }
    expect(usePlayer.getState().queue).toBe(avant)
  })
})

describe('usePlayer.remove', () => {
  const titres = () => usePlayer.getState().queue.map((t) => t.title)
  const courant = () => usePlayer.getState().queue[usePlayer.getState().index].title

  beforeEach(() => {
    usePlayer.setState({ shuffle: false, repeat: 'off', order: [] })
    usePlayer.getState().playQueue(TITRES.map(piste), 2) // 'c' en cours
  })

  it('retire le titre de la file', () => {
    usePlayer.getState().remove(0)
    expect(titres()).toEqual(['b', 'c', 'd', 'e', 'f'])
  })

  it('ne fait pas sauter la lecture en retirant un titre situé avant', () => {
    usePlayer.getState().remove(0)
    expect(courant()).toBe('c')
  })

  it('laisse la lecture en place en retirant un titre situé après', () => {
    usePlayer.getState().remove(4)
    expect(courant()).toBe('c')
  })

  it('enchaîne sur le suivant si l’on retire le titre en cours', () => {
    usePlayer.getState().remove(2)
    expect(courant()).toBe('d')
    expect(usePlayer.getState().isPlaying).toBe(true)
  })

  it('s’arrête si l’on retire le dernier titre en cours de lecture', () => {
    usePlayer.getState().playQueue(TITRES.map(piste), TITRES.length - 1)
    usePlayer.getState().remove(TITRES.length - 1)
    expect(usePlayer.getState().isPlaying).toBe(false)
  })

  it('vide tout proprement en retirant le dernier titre restant', () => {
    usePlayer.getState().playQueue([piste('a')], 0)
    usePlayer.getState().remove(0)
    expect(usePlayer.getState().queue).toEqual([])
    expect(usePlayer.getState().index).toBe(0)
    expect(usePlayer.getState().isPlaying).toBe(false)
  })

  it('ignore un rang hors limites', () => {
    usePlayer.getState().remove(99)
    usePlayer.getState().remove(-1)
    expect(titres()).toEqual(TITRES)
  })

  it('préserve la séquence aléatoire restante', () => {
    // Ordre de lecture impose : c, e, a, f, b, d.
    usePlayer.setState({ shuffle: true, order: [2, 4, 0, 5, 1, 3], index: 2 })
    usePlayer.getState().remove(0) // on retire 'a', ni courant ni joue
    expect(titres()).toEqual(['b', 'c', 'd', 'e', 'f'])
    // Les rangs ont recule d'un cran, 'a' a disparu, la suite est intacte.
    expect(sequence()).toEqual(['c', 'e', 'f', 'b', 'd'])
  })

  it('enchaîne sur le suivant de l’ordre aléatoire, pas sur le voisin de la file', () => {
    usePlayer.setState({ shuffle: true, order: [2, 4, 0, 5, 1, 3], index: 2 })
    usePlayer.getState().remove(2) // on retire 'c', en cours
    expect(courant()).toBe('e')
  })
})
