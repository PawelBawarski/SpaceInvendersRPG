import { describe, expect, it } from 'vitest'
import { GALAXIES, getGalaxy, getLevelBand, getZoneLevel, type Galaxy } from './galaxyChart'
import type { SectorPosition } from './exploration'

const orion: Galaxy = { id: 'orion-7', name: 'Orion–7', x: 24, y: 67, color: '#87dfff', sunColor: '#ffc278', seedSalt: 0, level: 1 }

describe('galaxies', () => {
  it('has unique galaxies with rising levels and a safe fallback', () => {
    expect(GALAXIES.length).toBeGreaterThanOrEqual(4)
    expect(new Set(GALAXIES.map(galaxy => galaxy.id)).size).toBe(GALAXIES.length)
    for (let index = 1; index < GALAXIES.length; index++) {
      expect(GALAXIES[index].level).toBeGreaterThan(GALAXIES[index - 1].level)
    }
    expect(getGalaxy('does-not-exist').id).toBe(GALAXIES[0].id)
    expect(getGalaxy(GALAXIES[3].id).id).toBe(GALAXIES[3].id)
  })
})

describe('getLevelBand', () => {
  it('classifies levels into ordered bands', () => {
    expect(getLevelBand(1)).toBe('entry')
    expect(getLevelBand(5)).toBe('entry')
    expect(getLevelBand(6)).toBe('frontier')
    expect(getLevelBand(15)).toBe('frontier')
    expect(getLevelBand(16)).toBe('veteran')
    expect(getLevelBand(28)).toBe('veteran')
    expect(getLevelBand(29)).toBe('elite')
    expect(getLevelBand(40)).toBe('elite')
  })
})

describe('getZoneLevel', () => {
  it('rises with distance from the core and is capped', () => {
    const core: SectorPosition = { x: 0, y: 0, z: 0 }
    const mid: SectorPosition = { x: 0, y: 0, z: 1_200_000 }
    const far: SectorPosition = { x: 0, y: 0, z: 999_000_000 }
    expect(getZoneLevel(orion, core)).toBe(orion.level)
    expect(getZoneLevel(orion, mid)).toBe(orion.level + 1)
    expect(getZoneLevel(orion, far)).toBeLessThanOrEqual(40)
  })
})