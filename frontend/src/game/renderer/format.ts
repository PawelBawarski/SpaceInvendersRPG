/** Clamp a value into the inclusive [minimum, maximum] range. */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

const AU = 149_597_870_700
const LY = 9_460_730_472_580_800
const PC = 3.085_677_581_49e16

/** Up to two decimals, trailing zeros trimmed. */
function trim(value: string): string {
  return value.replace(/\.?0+$/, '')
}

/**
 * Format a metre distance with at most two decimals, stepping down units so
 * values never read as "0.00 km": m → km → au → ly → pc.
 */
export function formatDistance(distance: number): string {
  const value = Math.abs(distance)
  if (value >= PC) return `${trim((distance / PC).toFixed(2))} pc`
  if (value >= LY) return `${trim((distance / LY).toFixed(2))} ly`
  if (value >= AU) return `${trim((distance / AU).toFixed(2))} au`
  if (value >= 1000) return `${trim((distance / 1000).toFixed(2))} km`
  return `${Math.round(distance)} m`
}

/** Format a speed in m/s, switching to km/s above 1000 m/s (max two decimals). */
export function formatSpeed(metresPerSecond: number): string {
  const value = Math.abs(metresPerSecond)
  if (value >= 1000) return `${trim((metresPerSecond / 1000).toFixed(2))} km/s`
  return `${trim(metresPerSecond.toFixed(2))} m/s`
}