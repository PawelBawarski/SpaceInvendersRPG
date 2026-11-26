import { describe, expect, it } from 'vitest'
import { createEmptyMissionProgress, equipShipPart } from './missionProgress'
import { getShipStatistics } from './shipStatistics'
import { PLAYER_WEAPON, resolveWeaponHit } from '../domain/weapon'
import type { ShipPart } from './shipParts'

describe('ship statistics', () => {
  const weapon: ShipPart = { id: 'weapon', slot: 'weapon', rarity: 'prototype', stats: { damagePercent: 20, hullPoints: 5, shieldPoints: 0, enginePercent: 0 } }
  const engine: ShipPart = { id: 'engine', slot: 'engine', rarity: 'refined', stats: { damagePercent: 0, hullPoints: 0, shieldPoints: 0, enginePercent: 10 }, resistances: { thermal: 0.16 } }

  it('shows factory defaults without counting parts that are only in the backpack', () => {
    const stats = getShipStatistics({ ...createEmptyMissionProgress(), shipParts: [weapon, engine] })
    expect(stats.weapon.minimum).toBe(18)
    expect(stats.weapon.maximum).toBe(24)
    expect(stats.maximumSpeed).toBe(234)
    expect(stats.halfSpeed).toBe(117)
    expect(stats.reverseSpeed).toBeCloseTo(193.44)
    expect(stats.maximumHull).toBe(100)
    expect(stats.resistances.thermal).toBe(0)
    expect(stats.rarities).toEqual({})
  })

  it('uses installed equipment, pilot bonuses and the actual weapon damage rolls', () => {
    const progress = equipShipPart(equipShipPart({ ...createEmptyMissionProgress(), experience: 1000, shipParts: [weapon, engine] }, weapon.id), engine.id)
    const stats = getShipStatistics(progress)
    expect(stats.rarities).toEqual({ weapon: 'prototype', engine: 'refined' })
    const hit = (damageRoll: number) => {
      const rolls = [0.5, damageRoll]
      return resolveWeaponHit(stats.bonuses, () => rolls.shift()!, false, 'prototype').damage
    }
    expect(stats.weapon.minimum).toBe(hit(0))
    expect(stats.weapon.maximum).toBe(hit(0.999999))
    expect(stats.weapon.expectedDps).toBeGreaterThan(stats.weapon.minimum * PLAYER_WEAPON.projectilesPerVolley / PLAYER_WEAPON.fireCooldown)
    expect(stats.maximumSpeed).toBeCloseTo(234 * 1.1 * 1.05)
    expect(stats.halfSpeed).toBeCloseTo(stats.maximumSpeed / 2)
    expect(stats.maximumHull).toBe(120)
    expect(stats.resistances.thermal).toBe(0.16)
  })

  it('retains current combat damage and speed in the sheet instead of healing the ship', () => {
    const stats = getShipStatistics(createEmptyMissionProgress(), { hull: 42, shield: 17, speed: 134, dodgeRemaining: 0.3, burningIntensity: 0.5 })
    expect(stats.hull).toBe(42)
    expect(stats.shield).toBe(17)
    expect(stats.speed).toBe(134)
    expect(stats.dodgeRemaining).toBe(0.3)
    expect(stats.burningIntensity).toBe(0.5)
    expect(stats.maximumHull).toBe(100)
  })
})
