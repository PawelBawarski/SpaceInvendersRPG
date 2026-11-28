import { describe, expect, it } from 'vitest'
import { createRecoveryChallenge, RECOVERY_IGNITION } from './ShipRecovery'

describe('recovery challenge', () => {
  it('gives the reactor an exact target with a tight tolerance instead of a band', () => {
    const challenge = createRecoveryChallenge(12345)
    for (const control of [challenge.voltage, challenge.frequency]) {
      expect(control.target).toBeGreaterThanOrEqual(0)
      expect(control.target).toBeLessThanOrEqual(100)
      expect(control.tolerance).toBeLessThanOrEqual(7)
      expect(Math.abs(control.initial - control.target)).toBeGreaterThan(control.tolerance)
    }
  })

  it('gives the ignition a generous window so the needle is easy to land', () => {
    expect(RECOVERY_IGNITION.toleranceRadians).toBeGreaterThan(0.3)
  })
})