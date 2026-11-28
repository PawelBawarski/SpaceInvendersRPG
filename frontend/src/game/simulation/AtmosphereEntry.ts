import type { PlanetSite, SectorPosition } from '../domain/exploration'

/**
 * Atmosphere model shared by flight, the approach cinematic and the renderer so
 * "entering a planet" feels like one continuous descent instead of a hard cut.
 */
export const ATMOSPHERE = {
  minEntryHeight: 900,
  radiusFraction: 0.08,
  maxEntryHeight: 9000,
  /** Fraction of forward speed bled off per second at full entry intensity. */
  entryDrag: 0.55,
} as const

export interface AtmosphereEntryState {
  /** Metres from the solid surface (0 once landed/at the surface). */
  altitude: number
  atmosphereHeight: number
  inAtmosphere: boolean
  /** 0 at the atmosphere edge, 1 at the surface. */
  intensity: number
  /** 0..1 fraction of speed shed per second due to atmospheric drag. */
  drag: number
}

export function getAtmosphereHeight(planet: PlanetSite): number {
  if (Number.isFinite(planet.atmosphere) && (planet.atmosphere ?? 0) > 0) return planet.atmosphere!
  return Math.min(ATMOSPHERE.maxEntryHeight, Math.max(ATMOSPHERE.minEntryHeight, planet.radius * ATMOSPHERE.radiusFraction))
}

export function sampleAtmosphereEntry(planet: PlanetSite, position: SectorPosition): AtmosphereEntryState {
  const distance = Math.hypot(position.x - planet.x, position.y - planet.y, position.z - planet.z)
  const altitude = Math.max(0, distance - planet.radius)
  const atmosphereHeight = getAtmosphereHeight(planet)
  const inAtmosphere = altitude <= atmosphereHeight
  const intensity = inAtmosphere ? Math.max(0, Math.min(1, 1 - altitude / Math.max(1, atmosphereHeight))) : 0
  return { altitude, atmosphereHeight, inAtmosphere, intensity, drag: inAtmosphere ? ATMOSPHERE.entryDrag * intensity : 0 }
}

/** Continuous speed multiplier after one entry step (1 = no drag). */
export function applyAtmosphericDrag(speed: number, entry: AtmosphereEntryState, seconds: number): number {
  const dt = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  if (entry.drag <= 0 || speed <= 0) return speed
  return speed * Math.max(0, 1 - entry.drag * dt)
}