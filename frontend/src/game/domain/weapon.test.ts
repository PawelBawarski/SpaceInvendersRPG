import { describe, expect, it } from 'vitest'
import { applyArmorDamage, resolveWeaponHit } from './weapon'

describe('shared ship weapon', () => {
  it('rolls within the equipped weapon rarity range and applies part bonuses', () => {
    expect(resolveWeaponHit({ damagePercent: 0 }, () => 1)).toEqual({ damage: 24, critical: false })
    expect(resolveWeaponHit({ damagePercent: 25 }, () => 1)).toEqual({ damage: 30, critical: false })
    expect(resolveWeaponHit({ damagePercent: 0 }, () => 1, false, 'refined').damage).toBe(30)
    expect(resolveWeaponHit({ damagePercent: 0 }, () => 1, false, 'prototype').damage).toBe(36)
  })

  it('marks critical hits and increases their damage by half', () => {
    expect(resolveWeaponHit({ damagePercent: 0 }, () => 0)).toEqual({ damage: 27, critical: true })
  })

  it('treats a perfect-dodge bonus shot as a critical hit', () => {
    expect(resolveWeaponHit({ damagePercent: 0 }, () => 1, true)).toEqual({ damage: 36, critical: true })
  })

  it('subtracts ordinary and boss armor without allowing zero damage', () => {
    expect(applyArmorDamage(24, 2)).toBe(22)
    expect(applyArmorDamage(24, 5)).toBe(19)
    expect(applyArmorDamage(3, 5)).toBe(1)
  })
})
