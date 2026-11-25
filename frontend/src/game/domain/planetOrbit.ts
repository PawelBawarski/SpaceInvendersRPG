import { createWorldShip, type DroneSite, type PlanetSite, type SectorPosition } from './exploration'

export const PLANET_CONTACT_RANGE = 2200
export const ORBIT_ALTITUDE = 1100
export function orbitEntryPosition(planet: PlanetSite): SectorPosition {
  return { x: planet.x + Math.sin(0.1) * (planet.radius + ORBIT_ALTITUDE), y: planet.y, z: planet.z - Math.cos(0.1) * (planet.radius + ORBIT_ALTITUDE) }
}

export function buildPlanetDefenders(planet: PlanetSite): DroneSite[] {
  if (!planet.orbitalFaction) return []
  return Array.from({ length: planet.hasHangar ? 8 : 12 }, (_, index) => {
    const radius = planet.radius + ORBIT_ALTITUDE + index % 3 * 90
    const angle = 0.1 + (450 + index * 125) / radius
    return createWorldShip(`orbit-${planet.id}-${index}`, planet.orbitalFaction!, index % 4 === 3 ? 'bomber' : index % 2 ? 'interceptor' : 'scout', {
      x: planet.x + Math.sin(angle) * radius, y: planet.y + (index % 3 - 1) * 100, z: planet.z - Math.cos(angle) * radius,
    })
  })
}
