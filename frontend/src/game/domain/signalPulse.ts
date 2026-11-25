export const SIGNAL_PULSE_CLOSED_SECONDS = 3
export const SIGNAL_PULSE_OPEN_SECONDS = 1.6
export const SIGNAL_PULSE_CYCLE_SECONDS =
  SIGNAL_PULSE_CLOSED_SECONDS + SIGNAL_PULSE_OPEN_SECONDS

export interface SignalPulseState {
  open: boolean
  secondsToChange: number
}

export function getSignalPulseState(elapsed: number): SignalPulseState {
  const phase = Math.max(0, elapsed) % SIGNAL_PULSE_CYCLE_SECONDS
  const open = phase >= SIGNAL_PULSE_CLOSED_SECONDS
  return {
    open,
    secondsToChange: open
      ? SIGNAL_PULSE_CYCLE_SECONDS - phase
      : SIGNAL_PULSE_CLOSED_SECONDS - phase,
  }
}
