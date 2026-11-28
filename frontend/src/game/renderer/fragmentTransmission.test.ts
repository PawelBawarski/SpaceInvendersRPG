import { describe, expect, it } from 'vitest'
import { getFragmentTransmission } from './fragmentTransmission'

describe('fragment transmission', () => {
  it('returns the localized radio line for a valid fragment index', () => {
    expect(typeof getFragmentTransmission(0, 'pl')).toBe('string')
    expect(getFragmentTransmission(0, 'pl')).toBe(getFragmentTransmission(0, 'pl'))
  })

  it('returns undefined past the last fragment', () => {
    expect(getFragmentTransmission(999, 'en')).toBeUndefined()
  })
})