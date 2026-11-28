import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GAME_SETTINGS,
  normalizeStarfieldDensity,
  STARFIELD_DENSITIES,
  STARFIELD_DENSITY_STARS,
} from './gameSettings'

describe('graphics settings', () => {
  it('normalizes starfield density and rejects unknown values', () => {
    expect(normalizeStarfieldDensity('low')).toBe('low')
    expect(normalizeStarfieldDensity('high')).toBe('high')
    expect(normalizeStarfieldDensity('medium')).toBe('medium')
    expect(normalizeStarfieldDensity('ultra')).toBe('medium')
    expect(normalizeStarfieldDensity(undefined)).toBe('medium')
    expect(normalizeStarfieldDensity(42)).toBe('medium')
  })

  it('maps each density to a rising star count', () => {
    expect(STARFIELD_DENSITY_STARS.low).toBeLessThan(STARFIELD_DENSITY_STARS.medium)
    expect(STARFIELD_DENSITY_STARS.medium).toBeLessThan(STARFIELD_DENSITY_STARS.high)
    for (const density of STARFIELD_DENSITIES) expect(STARFIELD_DENSITY_STARS[density]).toBeGreaterThan(0)
  })

  it('ships sensible defaults for the new options', () => {
    expect(DEFAULT_GAME_SETTINGS.starfieldDensity).toBe('medium')
    expect(DEFAULT_GAME_SETTINGS.damageVignette).toBe(true)
    expect(DEFAULT_GAME_SETTINGS.showFps).toBe(false)
  })
})