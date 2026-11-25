import { describe, expect, it } from 'vitest'
import { advanceSolarExposure, BURN_LINGER_SECONDS, createSolarExposureState } from './SolarExposure'

const star = { x: 28000, y: 12000, z: 190000, radius: 3200, heatRange: 20000 }
const atDistance = (surfaceDistance: number) => ({ x: star.x, y: star.y, z: star.z - star.radius - surfaceDistance })

describe('solar thermal exposure', () => {
  it('starts its burning zone at twenty kilometers from the stellar surface', () => {
    const safe = advanceSolarExposure(createSolarExposureState(), 10, atDistance(20001), star)
    expect(safe.inZone).toBe(false)
    expect(safe.thermalDamage).toBe(0)
    const edge = advanceSolarExposure(createSolarExposureState(), 1.5, atDistance(20000), star)
    expect(edge.inZone).toBe(true)
    expect(edge.distanceToSurface).toBe(20000)
    expect(edge.burningIntensity).toBeCloseTo(0.15)
    expect(edge.thermalDamage).toBeGreaterThan(0)
    const surface = advanceSolarExposure(createSolarExposureState(), 1.5, atDistance(0), star)
    expect(surface.burningIntensity).toBe(1)
    expect(surface.thermalDamage).toBeGreaterThan(edge.thermalDamage)
  })

  it('warms up, continues briefly after escape, then fully extinguishes', () => {
    const warm = advanceSolarExposure(createSolarExposureState(), 0.5, atDistance(0), star)
    expect(warm.burningIntensity).toBeCloseTo(1 / 3)
    const burning = advanceSolarExposure(warm, 1, atDistance(0), star)
    expect(burning.burningIntensity).toBe(1)
    const escaping = advanceSolarExposure(burning, 1, atDistance(30000), star)
    expect(escaping.inZone).toBe(false)
    expect(escaping.burningIntensity).toBeCloseTo(0.6)
    expect(escaping.thermalDamage).toBeGreaterThan(0)
    const safe = advanceSolarExposure(escaping, BURN_LINGER_SECONDS, atDistance(30000), star)
    expect(safe.burningIntensity).toBe(0)
    const resting = advanceSolarExposure(safe, 5, atDistance(30000), star)
    expect(resting.thermalDamage).toBe(0)
  })

  it('integrates warmup and lingering damage equally across frame rates', () => {
    let state = createSolarExposureState()
    let fineDamage = 0
    for (let step = 0; step < 30; step++) {
      state = advanceSolarExposure(state, 0.1, atDistance(0), star)
      fineDamage += state.thermalDamage
    }
    for (let step = 0; step < 30; step++) {
      state = advanceSolarExposure(state, 0.1, atDistance(30000), star)
      fineDamage += state.thermalDamage
    }
    const hot = advanceSolarExposure(createSolarExposureState(), 3, atDistance(0), star)
    const cold = advanceSolarExposure(hot, 3, atDistance(30000), star)
    expect(fineDamage).toBeCloseTo(hot.thermalDamage + cold.thermalDamage, 8)
  })

  it('can be reset at recovery and does not advance for invalid time', () => {
    const fresh = createSolarExposureState()
    const state = advanceSolarExposure(fresh, NaN, atDistance(0), star)
    expect(state.burningIntensity).toBe(0)
    expect(state.thermalDamage).toBe(0)
    expect(createSolarExposureState().lingerRemaining).toBe(0)
  })
})
