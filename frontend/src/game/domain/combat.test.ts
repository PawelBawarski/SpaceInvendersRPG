import { describe, expect, it } from 'vitest'
import { DODGE_TIMING, isPerfectDodge, resolveBossDamage, resolveDamage } from './combat'

describe('combat dodge resolution', () => {
  it('ignores damage during active i-frames', () => {
    const result = resolveDamage({
      amount: 16,
      shield: 100,
      dodgeElapsed: DODGE_TIMING.startup + 0.05,
      activeDodge: true,
    })

    expect(result.dodged).toBe(true)
    expect(result.perfect).toBe(true)
    expect(result.shieldDamage).toBe(0)
  })

  it('does not ignore damage outside i-frame window', () => {
    const result = resolveDamage({
      amount: 16,
      shield: 100,
      dodgeElapsed: DODGE_TIMING.startup + DODGE_TIMING.iframes + 0.01,
      activeDodge: true,
    })

    expect(result.dodged).toBe(false)
    expect(result.shieldDamage).toBe(16)
  })

  it('recognizes perfect dodge only in perfect window', () => {
    expect(isPerfectDodge(DODGE_TIMING.startup + 0.05, true)).toBe(true)
    expect(isPerfectDodge(DODGE_TIMING.startup + DODGE_TIMING.perfectWindow + 0.01, true)).toBe(false)
  })
})

describe('boss shield resolution', () => {
  it('absorbs hits before they reduce boss health', () => {
    expect(resolveBossDamage({ health: 300, shield: 30, amount: 20 })).toEqual({
      health: 300,
      shield: 10,
    })
  })

  it('spills damage into boss health when the shield breaks', () => {
    expect(resolveBossDamage({ health: 300, shield: 10, amount: 20 })).toEqual({
      health: 290,
      shield: 0,
    })
  })
})
