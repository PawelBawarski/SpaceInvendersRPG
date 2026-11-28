import { describe, expect, it } from 'vitest'
import { sampleIdleDrift } from './idleDrift'

describe('sampleIdleDrift', () => {
  it('produces small, bounded offsets that change over time', () => {
    const a = sampleIdleDrift(0)
    const b = sampleIdleDrift(4)
    expect(Math.abs(a.x)).toBeLessThan(0.5)
    expect(Math.abs(a.y)).toBeLessThan(0.5)
    expect(Math.abs(a.roll)).toBeLessThan(0.2)
    expect(a.y).not.toBe(b.y)
  })

  it('is safe for non-finite input', () => {
    expect(sampleIdleDrift(Number.NaN)).toEqual(sampleIdleDrift(0))
  })
})