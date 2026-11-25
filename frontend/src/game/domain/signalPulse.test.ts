import { describe, expect, it } from 'vitest'
import {
  getSignalPulseState,
  SIGNAL_PULSE_CYCLE_SECONDS,
} from './signalPulse'

describe('signal core pulse windows', () => {
  it('keeps the shield closed before the firing window', () => {
    expect(getSignalPulseState(0)).toEqual({ open: false, secondsToChange: 3 })
    expect(getSignalPulseState(2.5)).toEqual({ open: false, secondsToChange: 0.5 })
  })

  it('opens briefly, then repeats the cycle', () => {
    expect(getSignalPulseState(3).open).toBe(true)
    expect(getSignalPulseState(3).secondsToChange).toBeCloseTo(1.6)
    expect(getSignalPulseState(4.5).open).toBe(true)
    expect(getSignalPulseState(SIGNAL_PULSE_CYCLE_SECONDS).open).toBe(false)
  })
})
