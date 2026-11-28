import { describe, expect, it } from 'vitest'
import {
  BOSS_RAGE_HULL_FRACTION,
  RETREAT_HULL_FRACTION,
  getBossManeuver,
  getEnemyArmor,
  getEnemyManeuver,
  getEnemyShieldCapacity,
  getShipContactDamage,
  isPlayerTracked,
  PURSUIT,
  scaleEnemyCombatStats,
} from './enemyManeuvers'

describe('scaleEnemyCombatStats', () => {
  const base = { health: 100, damage: 10, attackInterval: 1, attackRange: 500, projectileSpeed: 300, speed: 40 }

  it('leaves level 1 unchanged', () => {
    expect(scaleEnemyCombatStats(base, 1)).toEqual(base)
  })

  it('grows hull and damage with threat level', () => {
    const scaled = scaleEnemyCombatStats(base, 5)
    expect(scaled.health).toBeGreaterThan(base.health)
    expect(scaled.damage).toBeGreaterThan(base.damage)
    expect(scaled.attackInterval).toBeLessThan(base.attackInterval)
  })

  it('never drops the attack interval below the floor', () => {
    const scaled = scaleEnemyCombatStats(base, 999)
    expect(scaled.attackInterval).toBeGreaterThanOrEqual(base.attackInterval * 0.62)
  })
})

describe('getEnemyShieldCapacity', () => {
  it('grants shields only to protected hulls', () => {
    expect(getEnemyShieldCapacity('frigate', 'meridian', 100)).toBeGreaterThan(0)
    expect(getEnemyShieldCapacity('scout', 'meridian', 100)).toBe(0)
    expect(getEnemyShieldCapacity('interceptor', 'null-cult', 100)).toBeGreaterThan(0)
  })
})

describe('getEnemyManeuver', () => {
  it('retreats when the hull is critically low', () => {
    const maneuver = getEnemyManeuver('interceptor', 100, 500, 0, false, RETREAT_HULL_FRACTION - 0.1)
    expect(maneuver.retreating).toBe(true)
    expect(maneuver.advance).toBe(-1)
  })

  it('advances toward a target that sits beyond the standoff distance', () => {
    const maneuver = getEnemyManeuver('bomber', 900, 500, 0, false, 1)
    expect(maneuver.advance).toBeGreaterThan(0)
    expect(maneuver.retreating).toBe(false)
  })

  it('produces a finite, normalised-ish heading for every archetype', () => {
    for (const archetype of ['scout', 'interceptor', 'bomber', 'frigate'] as const) {
      const maneuver = getEnemyManeuver(archetype, 400, 500, 1.3, true, 0.8)
      for (const value of [maneuver.advance, maneuver.strafe, maneuver.lift]) {
        expect(Number.isFinite(value)).toBe(true)
      }
    }
  })
})

describe('getBossManeuver', () => {
  it('enrages below the rage hull fraction', () => {
    const calm = getBossManeuver('aimed', 0, 100, 500, 1)
    const enraged = getBossManeuver('aimed', 0, 100, 500, BOSS_RAGE_HULL_FRACTION - 0.1)
    expect(enraged.pace).toBeGreaterThan(calm.pace)
  })

  it('returns a finite pace for every fire pattern', () => {
    for (const pattern of ['aimed', 'fan', 'burst', 'spiral'] as const) {
      expect(getBossManeuver(pattern, 2, 300, 500, 0.7).pace).toBeGreaterThan(0)
    }
  })
})

describe('getEnemyArmor', () => {
  it('gives larger hulls more armor', () => {
    expect(getEnemyArmor(1, 'frigate')).toBeGreaterThan(getEnemyArmor(1, 'scout'))
    expect(getEnemyArmor(5, 'scout')).toBeGreaterThan(getEnemyArmor(1, 'scout'))
  })
})

describe('getShipContactDamage', () => {
  it('scales player collision damage with impact speed', () => {
    const slow = getShipContactDamage(10, 'scout', false)
    const fast = getShipContactDamage(200, 'scout', false)
    expect(fast.player).toBeGreaterThan(slow.player)
  })

  it('clamps non-finite speed to a safe impact', () => {
    expect(getShipContactDamage(Number.NaN, 'bomber', false).player).toBe(getShipContactDamage(0, 'bomber', false).player)
  })
})

describe('isPlayerTracked', () => {
  const range = 5200

  it('tracks a pilot inside the extended sight range', () => {
    expect(isPlayerTracked(range * (PURSUIT.sightMultiplier - 0.1), 999, range)).toBe(true)
  })

  it('keeps tracking while the pilot is still remembered', () => {
    expect(isPlayerTracked(range * 5, PURSUIT.memorySeconds - 1, range)).toBe(true)
  })

  it('drops the pilot once they are far away and forgotten', () => {
    expect(isPlayerTracked(range * 5, PURSUIT.memorySeconds + 1, range)).toBe(false)
  })
})