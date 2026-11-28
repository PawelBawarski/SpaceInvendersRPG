import { describe, expect, it } from 'vitest'
import { clamp, formatDistance, formatSpeed } from './format'

describe('format helpers', () => {
  it('clamps into the inclusive range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })

  it('formats metres, kilometres and astronomical units with max two decimals', () => {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(12.4)).toBe('12 m')
    expect(formatDistance(999)).toBe('999 m')
    expect(formatDistance(1000)).toBe('1 km')
    expect(formatDistance(2500)).toBe('2.5 km')
    expect(formatDistance(149_597_870_700)).toBe('1 au')
    expect(formatDistance(9.460_730_472_580_8e15)).toBe('1 ly')
    expect(formatDistance(3.085_677_581_49e16)).toBe('1 pc')
  })

  it('formats speed in m/s or km/s', () => {
    expect(formatSpeed(0)).toBe('0 m/s')
    expect(formatSpeed(12.345)).toBe('12.35 m/s')
    expect(formatSpeed(1500)).toBe('1.5 km/s')
  })
})