import { describe, expect, it } from 'vitest'
import { applyDamageResistance, DEFAULT_SHIP_RESISTANCES, getDamageResistance } from './damageTypes'

describe('typed damage resistance', () => {
  it('applies only the matching type and preserves continuous damage fractions', () => {
    const profile = { thermal: 0.4, ion: 0.2 }
    expect(applyDamageResistance(10, 'thermal', profile)).toBe(6)
    expect(applyDamageResistance(10, 'ion', profile)).toBe(8)
    expect(applyDamageResistance(10, 'kinetic', profile)).toBe(10)
    expect(applyDamageResistance(0.2, 'thermal', profile)).toBeCloseTo(0.12)
    expect(applyDamageResistance(10, 'radiation', DEFAULT_SHIP_RESISTANCES)).toBe(10)
  })

  it('clamps invalid resistance and damage inputs without granting immunity', () => {
    expect(getDamageResistance('thermal', { thermal: 1 })).toBe(0.85)
    expect(applyDamageResistance(100, 'thermal', { thermal: 5 })).toBeCloseTo(15)
    expect(getDamageResistance('thermal', { thermal: -1 })).toBe(0)
    expect(getDamageResistance('thermal', { thermal: NaN })).toBe(0)
    expect(applyDamageResistance(Infinity, 'ion', {})).toBe(0)
    expect(applyDamageResistance(-2, 'ion', {})).toBe(0)
  })
})
