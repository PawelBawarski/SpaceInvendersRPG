import { describe, expect, it } from 'vitest'
import type { PlanetSite } from '../domain/exploration'
import { ATMOSPHERE, applyAtmosphericDrag, getAtmosphereHeight, sampleAtmosphereEntry } from './AtmosphereEntry'

const text = { en: 'Test', pl: 'Test' }
const planet: PlanetSite = { id: 'p', name: text, description: text, color: '#789abc', radius: 5000, x: 0, y: 0, z: 0 }

describe('getAtmosphereHeight', () => {
  it('derives a proportional shell when none is set', () => {
    const height = getAtmosphereHeight(planet)
    expect(height).toBeGreaterThanOrEqual(ATMOSPHERE.minEntryHeight)
    expect(height).toBeLessThanOrEqual(ATMOSPHERE.maxEntryHeight)
  })

  it('honours an explicit atmosphere height', () => {
    expect(getAtmosphereHeight({ ...planet, atmosphere: 4200 })).toBe(4200)
  })
})

describe('sampleAtmosphereEntry', () => {
  it('reports clear space far above the planet', () => {
    const entry = sampleAtmosphereEntry(planet, { x: 0, y: 0, z: planet.radius + 50000 })
    expect(entry.inAtmosphere).toBe(false)
    expect(entry.intensity).toBe(0)
    expect(entry.drag).toBe(0)
  })

  it('ramps intensity from the edge down to the surface', () => {
    const height = getAtmosphereHeight(planet)
    const edge = sampleAtmosphereEntry(planet, { x: 0, y: 0, z: planet.radius + height })
    const middle = sampleAtmosphereEntry(planet, { x: 0, y: 0, z: planet.radius + height / 2 })
    const surface = sampleAtmosphereEntry(planet, { x: 0, y: 0, z: planet.radius })
    expect(edge.intensity).toBeCloseTo(0)
    expect(middle.intensity).toBeCloseTo(0.5)
    expect(surface.intensity).toBeCloseTo(1)
    expect(surface.drag).toBeGreaterThan(middle.drag)
  })

  it('never reports a negative altitude', () => {
    expect(sampleAtmosphereEntry(planet, { x: 0, y: 0, z: 0 }).altitude).toBe(0)
  })
})

describe('applyAtmosphericDrag', () => {
  it('bleeds speed inside the atmosphere and preserves it outside', () => {
    const inside = sampleAtmosphereEntry(planet, { x: 0, y: 0, z: planet.radius + 100 })
    expect(applyAtmosphericDrag(200, inside, 1)).toBeLessThan(200)
    const outside = sampleAtmosphereEntry(planet, { x: 0, y: 0, z: planet.radius + 50000 })
    expect(applyAtmosphericDrag(200, outside, 1)).toBe(200)
  })
})