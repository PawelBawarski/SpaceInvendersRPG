import { createWorldShip, type DroneSite, type PlanetSite, type SectorPosition } from './exploration'

export const PLANET_CONTACT_RANGE = 2200
export const ORBIT_ALTITUDE = 1100
const ORBIT_ALTITUDE_LIMITS = { minimum: 420, radiusFraction: .045 } as const

export function getOrbitAltitude(planet: PlanetSite): number {
  return Math.min(ORBIT_ALTITUDE, Math.max(ORBIT_ALTITUDE_LIMITS.minimum, planet.radius * ORBIT_ALTITUDE_LIMITS.radiusFraction))
}

export function orbitEntryPosition(planet: PlanetSite): SectorPosition {
  const orbitRadius = planet.radius + getOrbitAltitude(planet)
  return { x: planet.x + Math.sin(0.1) * orbitRadius, y: planet.y, z: planet.z - Math.cos(0.1) * orbitRadius }
}

export function buildPlanetDefenders(planet: PlanetSite): DroneSite[] {
  if (!planet.orbitalFaction) return []
  const orbitAltitude = getOrbitAltitude(planet)
  return Array.from({ length: planet.hasHangar ? 8 : 12 }, (_, index) => {
    const radius = planet.radius + orbitAltitude + index % 3 * 90
    const angle = 0.1 + (450 + index * 125) / radius
    return createWorldShip(`orbit-${planet.id}-${index}`, planet.orbitalFaction!, index % 4 === 3 ? 'bomber' : index % 2 ? 'interceptor' : 'scout', {
      x: planet.x + Math.sin(angle) * radius, y: planet.y + (index % 3 - 1) * 100, z: planet.z - Math.cos(angle) * radius,
    })
  })
}
