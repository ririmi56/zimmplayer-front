import { describe, expect, it } from 'vitest'
import { ServerClock } from './clock'

describe('ServerClock', () => {
  it('annule une latence réseau symétrique', () => {
    const clock = new ServerClock()
    // Serveur en avance de 500 ms, 20 ms de trajet dans chaque sens :
    // c2s = 20 + 500, s2c = 20 − 500.
    for (let i = 0; i < 5; i++) clock.addSample(520, -480)
    expect(clock.offsetMs).toBeCloseTo(500, 6)
  })

  it('retient la médiane, donc résiste aux mesures aberrantes', () => {
    const clock = new ServerClock()
    for (const c2s of [520, 519, 521, 520, 9999]) clock.addSample(c2s, -480)
    // Une moyenne serait tirée à ~2400 ms par le pic.
    expect(clock.offsetMs).toBeCloseTo(500, 0)
  })

  it('ne garde que les dernières mesures', () => {
    const clock = new ServerClock(3)
    clock.addSample(0, 0)
    clock.addSample(0, 0)
    for (let i = 0; i < 3; i++) clock.addSample(200, 0)
    expect(clock.sampleCount).toBe(3)
    expect(clock.offsetMs).toBe(100)
  })

  it('attend quelques mesures avant de se déclarer fiable', () => {
    const clock = new ServerClock()
    expect(clock.isSettled).toBe(false)
    clock.addSample(0, 0)
    clock.addSample(0, 0)
    expect(clock.isSettled).toBe(false)
    clock.addSample(0, 0)
    expect(clock.isSettled).toBe(true)
  })

  it('convertit un horodatage serveur vers l horloge locale', () => {
    const clock = new ServerClock()
    for (let i = 0; i < 3; i++) clock.addSample(700, -300) // décalage 500 ms
    expect(clock.toLocalMs(10_000)).toBe(9_500)
  })

  it('sans mesure, suppose les horloges alignées', () => {
    expect(new ServerClock().offsetMs).toBe(0)
  })
})
