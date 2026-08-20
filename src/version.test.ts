import { describe, expect, it } from 'vitest'
import manifeste from '../package.json' with { type: 'json' }
import { VERSION } from './version'

describe('VERSION', () => {
  it('suit celle de package.json', () => {
    // Deux endroits a bouger lors d'une release ; ce test est ce qui rend
    // cette duplication sans danger.
    expect(VERSION).toBe(manifeste.version)
  })

  it('ressemble a une version semantique', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
