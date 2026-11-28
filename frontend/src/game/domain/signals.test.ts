import { describe, expect, it } from 'vitest'
import { getSignal, SIGNALS } from './signals'

describe('signals', () => {
  it('lists unique, finite signals near the start', () => {
    expect(SIGNALS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(SIGNALS.map(signal => signal.id)).size).toBe(SIGNALS.length)
    for (const signal of SIGNALS) {
      expect(Number.isFinite(signal.x)).toBe(true)
      expect(Number.isFinite(signal.y)).toBe(true)
      expect(Number.isFinite(signal.z)).toBe(true)
      expect(Math.hypot(signal.x, signal.y, signal.z)).toBeLessThan(20000)
    }
  })

  it('looks up a signal by id', () => {
    expect(getSignal(SIGNALS[0].id)?.id).toBe(SIGNALS[0].id)
    expect(getSignal('missing')).toBeUndefined()
  })
})