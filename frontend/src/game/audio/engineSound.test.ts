import { describe, expect, it } from 'vitest'
import { getEngineSoundProfile } from './engineSound'

describe('engine sound tuning', () => {
  it('stays silent while stopped and gives coasting a quieter lower motor tone', () => {
    expect(getEngineSoundProfile(0, 0).gain).toBe(0)
    const coast = getEngineSoundProfile(0.5, 0)
    const boost = getEngineSoundProfile(0.5, 1)
    expect(coast.mode).toBe('cruise')
    expect(boost.mode).toBe('acceleration')
    expect(boost.frequency).toBeGreaterThan(coast.frequency)
    expect(boost.cutoff).toBeGreaterThan(coast.cutoff)
    expect(boost.gain).toBeGreaterThan(coast.gain)
  })

  it('responds to both throttle levels, keeps reverse audible and bounds volume', () => {
    expect(getEngineSoundProfile(1, 1).frequency).toBeGreaterThan(getEngineSoundProfile(1, 0.5).frequency)
    expect(getEngineSoundProfile(-0.5, -1).gain).toBeGreaterThan(0)
    expect(getEngineSoundProfile(100, 100).gain).toBeLessThan(0.03)
    expect(getEngineSoundProfile(NaN, NaN).gain).toBe(0)
  })
})
