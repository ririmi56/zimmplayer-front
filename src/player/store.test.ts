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
