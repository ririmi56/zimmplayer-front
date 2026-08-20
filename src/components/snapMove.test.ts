import { describe, expect, it } from 'vitest'
import type { SnapClient, SnapGroup } from '../api/client'
import { apartStream, groupOf, planMove } from './snapMove'

const client = (id: string): SnapClient => ({
  id,
  name: id,
  connected: true,
  volume: 100,
  muted: false,
  latency: 0,
  host_name: id,
  ip: '172.18.0.6',
  os: 'Alpine Linux v3.21',
})

const group = (id: string, stream: string | null, ...ids: string[]): SnapGroup => ({
  id,
  name: '',
  muted: false,
  stream_id: stream,
  clients: ids.map(client),
})

/**
 * Chaque cas correspond a un comportement de snapserver 0.29 releve sur le
 * serveur de developpement. Le piege est le dernier : un detachement laisse
 * l'appareil sur le flux qu'il vient de quitter, donc un plan qui s'arreterait
 * la aurait l'air de marcher tout en ne deplacant personne.
 */
describe('planMove', () => {
  it('entre dans le groupe qui ecoute deja le flux vise', () => {
    const groups = [group('g1', 'silence', 'salon'), group('g2', '212', 'cuisine')]
    expect(planMove(groups, 'salon', '212')).toEqual({
      kind: 'join',
      groupId: 'g2',
      // Les occupants sont conserves : SetClients remplace la liste entiere,
      // les omettre les expulserait.
      clientIds: ['cuisine', 'salon'],
    })
  })

  it('emmene le groupe entier quand l’appareil y est seul', () => {
    const groups = [group('g1', 'silence', 'salon')]
    expect(planMove(groups, 'salon', '212')).toEqual({
      kind: 'retarget',
      groupId: 'g1',
      streamId: '212',
    })
  })

  it('detache puis pose le flux quand l’appareil est accompagne', () => {
    const groups = [group('g1', 'silence', 'salon', 'cuisine')]
    // Sans la seconde etape, `salon` resterait sur `silence` : le groupe neuf
    // herite du flux de celui qu'il quitte.
    expect(planMove(groups, 'salon', '212')).toEqual({
      kind: 'detach',
      groupId: 'g1',
      keep: ['cuisine'],
      streamId: '212',
    })
  })

  it('ne fait rien si le flux est deja le bon', () => {
    const groups = [group('g1', '212', 'salon')]
    expect(planMove(groups, 'salon', '212')).toEqual({ kind: 'none' })
  })

  it('ne fait rien pour un appareil que le serveur ne connait pas', () => {
    expect(planMove([group('g1', '212', 'salon')], 'fantome', 'silence')).toEqual({
      kind: 'none',
    })
  })
})

describe('groupOf', () => {
  it('retrouve le groupe neuf cree par un detachement', () => {
    const result = {
      server: {
        groups: [
          { id: 'g1', stream_id: 'silence', clients: [{ id: 'cuisine' }] },
          { id: 'neuf', stream_id: 'silence', clients: [{ id: 'salon' }] },
        ],
      },
    }
    expect(groupOf(result, 'salon')).toBe('neuf')
  })

  it('rend null quand l’appareil ne figure nulle part', () => {
    expect(groupOf({ server: { groups: [] } }, 'salon')).toBeNull()
  })
})

describe('apartStream', () => {
  it('prend un flux qu’aucune session ne revendique', () => {
    const streams = [{ id: 'silence' }, { id: '212' }]
    expect(apartStream(streams, ['212'])).toBe('silence')
  })

  it('rend null quand toutes les sessions occupent tous les flux', () => {
    expect(apartStream([{ id: '212' }], ['212'])).toBeNull()
  })

  it('ignore les sessions sans flux enregistre', () => {
    expect(apartStream([{ id: 'silence' }], [null, undefined])).toBe('silence')
  })
})
