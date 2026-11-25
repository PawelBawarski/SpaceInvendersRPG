import type { DroneSite, PlanetSite, SectorPosition, StationSite, SunSite } from './exploration'
import { sampleFormationPosition, samplePatrolRoute } from './patrolFormation'
import { createWorldShip, type FactionId, type ShipArchetype } from './worldFactions'

const FACTIONS: readonly FactionId[] = ['meridian', 'nacre', 'null-cult', 'ashen-legion']
const CLASSES: readonly ShipArchetype[] = ['scout', 'interceptor', 'bomber', 'frigate']
const distance = (a: SectorPosition, b: SectorPosition) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

export function buildDeepSpacePopulation(planets: readonly PlanetSite[], stations: readonly StationSite[], sun: SunSite): DroneSite[] {
  let seed = 61483
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const eligible = planets.filter(planet => stations.every(station => distance(planet, station) > planet.radius + 14000)
    && distance(planet, sun) > planet.radius + sun.radius + sun.heatRange + 14000)
  const grouped = Array.from({ length: 2250 }, (_, index): DroneSite => {
    const group = Math.floor(index / 3)
    const planet = eligible[group % eligible.length]
    const formation = {
      id: `deep-squadron-${group + 1}`, slot: index % 3,
      anchor: { x: planet.x, y: planet.y + (group % 3 - 1) * 180, z: planet.z },
      radius: planet.radius + 1800 + Math.floor(group / eligible.length) * 360,
      phase: group * 2.399963229728653, speed: 9,
    }
    const route = samplePatrolRoute(formation, 0)
    return { ...createWorldShip(`deep-wing-${index + 1}`, FACTIONS[group % 4], CLASSES[(group + index % 3) % 4], sampleFormationPosition(route.center, route.forward, formation.slot)), formation }
  })
  const solos = Array.from({ length: 2024 }, (_, index) => {
    let position: SectorPosition
    do {
      if (index < 200) position = { x: (index % 2 ? -1 : 1) * (8000 + random() * 14000), y: (random() - 0.5) * 8000, z: 18000 + random() * 100000 }
      else {
        const planet = planets[Math.floor(random() * planets.length)]
        const angle = random() * Math.PI * 2
        const elevation = (random() - 0.5) * 1.8
        const radius = planet.radius + 1200 + random() * 7800
        position = { x: planet.x + Math.cos(angle) * Math.cos(elevation) * radius, y: planet.y + Math.sin(elevation) * radius, z: planet.z + Math.sin(angle) * Math.cos(elevation) * radius }
      }
    } while (stations.some(station => distance(position, station) < station.radius + 2500)
      || planets.some(planet => distance(position, planet) < planet.radius + 180)
      || distance(position, sun) < sun.radius + sun.heatRange + 1200)
    return createWorldShip(`deep-roamer-${index + 1}`, FACTIONS[index % 4], CLASSES[(index + Math.floor(index / 4)) % 4], position)
  })
  return [...grouped, ...solos]
}
