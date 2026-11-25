import type { SectorPosition } from '../domain/exploration'

export interface SolarHeatSource extends SectorPosition {
  radius: number
  /** Game meters from the stellar surface. */
  heatRange: number
}

export interface SolarExposureState {
  distanceToSurface: number
  inZone: boolean
  exposure: number
  heatingSeconds: number
  lingerRemaining: number
  lastHeatIntensity: number
  burningIntensity: number
  /** Raw thermal damage this update, before ship resistances. */
  thermalDamage: number
}

export const SOLAR_IGNITION_SECONDS = 1.5
export const BURN_LINGER_SECONDS = 2.5
export const SOLAR_DAMAGE_PER_SECOND = 24

export function createSolarExposureState(): SolarExposureState {
  return {
    distanceToSurface: Infinity, inZone: false, exposure: 0, heatingSeconds: 0,
    lingerRemaining: 0, lastHeatIntensity: 0, burningIntensity: 0, thermalDamage: 0,
  }
}

/** Pure continuous hazard: dodging cannot cancel stellar heat. */
export function advanceSolarExposure(
  previous: SolarExposureState,
  seconds: number,
  position: SectorPosition,
  star: SolarHeatSource,
): SolarExposureState {
  const dt = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const distance = Math.hypot(position.x - star.x, position.y - star.y, position.z - star.z)
  const distanceToSurface = Math.max(0, distance - star.radius)
  const validRange = Number.isFinite(star.heatRange) && star.heatRange > 0
  const inZone = validRange && Number.isFinite(distance) && distanceToSurface <= star.heatRange
  const exposure = inZone ? 0.15 + 0.85 * Math.max(0, 1 - distanceToSurface / star.heatRange) : 0
  const heatingSeconds = inZone ? previous.heatingSeconds + dt : 0
  const lingerRemaining = inZone ? BURN_LINGER_SECONDS : Math.max(0, previous.lingerRemaining - dt)
  const lastHeatIntensity = inZone
    ? exposure * Math.min(1, heatingSeconds / SOLAR_IGNITION_SECONDS)
    : previous.lastHeatIntensity
  const burningIntensity = inZone ? lastHeatIntensity : lastHeatIntensity * lingerRemaining / BURN_LINGER_SECONDS
  const rampArea = (time: number) => time < SOLAR_IGNITION_SECONDS
    ? time * time / (2 * SOLAR_IGNITION_SECONDS)
    : time - SOLAR_IGNITION_SECONDS / 2
  const damageArea = inZone
    ? exposure * (rampArea(heatingSeconds) - rampArea(previous.heatingSeconds))
    : previous.lastHeatIntensity * (previous.lingerRemaining + lingerRemaining)
      / (2 * BURN_LINGER_SECONDS) * Math.min(dt, previous.lingerRemaining)
  return {
    distanceToSurface, inZone, exposure, heatingSeconds, lingerRemaining,
    lastHeatIntensity, burningIntensity,
    thermalDamage: damageArea * SOLAR_DAMAGE_PER_SECOND,
  }
}
