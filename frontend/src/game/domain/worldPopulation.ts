import type { DroneSite, PlanetSite, SectorPosition, StationSite, SunSite } from './exploration'
import { sampleFormationPosition, samplePatrolRoute } from './patrolFormation'
import { createWorldShip, type FactionId, type ShipArchetype } from './worldFactions'

const POPULATION = {
  formationShips: 2400, roamingShips: 2500, nearbyRoamers: 320, seedFallback: 61483,
  stationClearance: 14000, solarClearance: 14000, formationOffsetY: 180,
  shipsPerFormation: 3,
  hostileWingsPerPlanet: 3, hostileShipsPerWing: 4, hostilePatrolClearance: 5200, hostilePatrolStep: 740,
  formationOrbitRadius: 1800, formationOrbitStep: 360, formationLayers: 3,
  formationSpeed: { minimum: 18, variation: 8 },
  nearbySpawn: { xMinimum: 2600, xVariation: 19000, halfHeight: 4000, zMinimum: 6500, zVariation: 100000 },
  planetaryOrbit: { clearance: 1200, thickness: 7800, elevationRange: 1.8 },
  planetClearance: 180, roamingStationClearance: 2500, solarSpawnClearance: 1200,
} as const
const SEEDED_RANDOM = { multiplier: 1664525, increment: 1013904223, unitRange: 4294967296 } as const

const FACTIONS: readonly FactionId[] = ['meridian', 'nacre', 'null-cult', 'ashen-legion']
const HOSTILE_FACTIONS: readonly FactionId[] = ['nacre', 'null-cult', 'ashen-legion']
const CLASSES: readonly ShipArchetype[] = ['scout', 'interceptor', 'bomber', 'frigate']
const distance = (a: SectorPosition, b: SectorPosition) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

export function buildDeepSpacePopulation(planets: readonly PlanetSite[], stations: readonly StationSite[], sun: SunSite, campaignSeed: number = POPULATION.seedFallback): DroneSite[] {
  let seed = campaignSeed >>> 0 || POPULATION.seedFallback
  const random = () => { seed = (seed * SEEDED_RANDOM.multiplier + SEEDED_RANDOM.increment) >>> 0; return seed / SEEDED_RANDOM.unitRange }
  const eligible = planets.filter(planet => stations.every(station => distance(planet, station) > planet.radius + POPULATION.stationClearance)
    && distance(planet, sun) > planet.radius + sun.radius + sun.heatRange + POPULATION.solarClearance)
  const formationPlanets = eligible.length ? eligible : planets
  const grouped = Array.from({ length: POPULATION.formationShips }, (_, index): DroneSite => {
    const group = Math.floor(index / POPULATION.shipsPerFormation)
    const planet = formationPlanets[group % formationPlanets.length]
    const faction = FACTIONS[group % FACTIONS.length]
    const formation = {
      id: `deep-squadron-${group + 1}`, slot: index % POPULATION.shipsPerFormation,
      anchor: { x: planet.x, y: planet.y + (group % POPULATION.formationLayers - 1) * POPULATION.formationOffsetY, z: planet.z },
      radius: planet.radius + POPULATION.formationOrbitRadius + Math.floor(group / formationPlanets.length) * POPULATION.formationOrbitStep,
      phase: group * (Math.PI * (3 - Math.sqrt(5))) + random() * Math.PI * 2,
      speed: POPULATION.formationSpeed.minimum + random() * POPULATION.formationSpeed.variation,
    }
    const route = samplePatrolRoute(formation, 0)
    return { ...createWorldShip(`deep-wing-${index + 1}`, faction, CLASSES[Math.floor(random() * CLASSES.length)], sampleFormationPosition(route.center, route.forward, formation.slot)), formation }
  })
  // These wings are intentionally denser than background traffic. They make every inhabited orbit a live combat space.
  const hostileWings = formationPlanets.flatMap((planet, planetIndex) => Array.from({ length: POPULATION.hostileWingsPerPlanet * POPULATION.hostileShipsPerWing }, (_, index): DroneSite => {
    const wing = Math.floor(index / POPULATION.hostileShipsPerWing)
    const slot = index % POPULATION.hostileShipsPerWing
    const formation = {
      id: `hostile-wing-${planetIndex + 1}-${wing + 1}`, slot,
      anchor: { x: planet.x, y: planet.y + (wing - 1) * POPULATION.formationOffsetY, z: planet.z },
      radius: planet.radius + POPULATION.hostilePatrolClearance + wing * POPULATION.hostilePatrolStep,
      phase: planetIndex * 1.87 + wing * .73 + random() * Math.PI * 2,
      speed: POPULATION.formationSpeed.minimum + 4 + random() * POPULATION.formationSpeed.variation,
    }
    const route = samplePatrolRoute(formation, 0)
    const archetype: ShipArchetype = slot === POPULATION.hostileShipsPerWing - 1 && wing % 2 === 0 ? 'bomber'
      : slot === 0 ? 'interceptor' : slot === 1 ? 'scout' : 'frigate'
    const ship = createWorldShip(`hostile-wing-${planetIndex + 1}-${wing + 1}-${slot + 1}`,
      HOSTILE_FACTIONS[(planetIndex + wing) % HOSTILE_FACTIONS.length], archetype, sampleFormationPosition(route.center, route.forward, slot))
    return { ...ship, attackRange: Math.round(ship.attackRange! * 1.7), speed: Math.round(ship.speed! * 1.12), formation }
  }))
  const solos = Array.from({ length: POPULATION.roamingShips }, (_, index) => {
    let position: SectorPosition
    do {
      if (index < POPULATION.nearbyRoamers) position = {
        x: (index % 2 ? -1 : 1) * (POPULATION.nearbySpawn.xMinimum + random() * POPULATION.nearbySpawn.xVariation),
        y: (random() - 0.5) * POPULATION.nearbySpawn.halfHeight * 2,
        z: POPULATION.nearbySpawn.zMinimum + random() * POPULATION.nearbySpawn.zVariation,
      }
      else {
        const planet = planets[Math.floor(random() * planets.length)]
        const angle = random() * Math.PI * 2
        const elevation = (random() - 0.5) * POPULATION.planetaryOrbit.elevationRange
        const radius = planet.radius + POPULATION.planetaryOrbit.clearance + random() * POPULATION.planetaryOrbit.thickness
        position = { x: planet.x + Math.cos(angle) * Math.cos(elevation) * radius, y: planet.y + Math.sin(elevation) * radius, z: planet.z + Math.sin(angle) * Math.cos(elevation) * radius }
      }
    } while (stations.some(station => distance(position, station) < station.radius + POPULATION.roamingStationClearance)
      || planets.some(planet => distance(position, planet) < planet.radius + POPULATION.planetClearance)
      || distance(position, sun) < sun.radius + sun.heatRange + POPULATION.solarSpawnClearance)
    return createWorldShip(`deep-roamer-${index + 1}`, FACTIONS[Math.floor(random() * FACTIONS.length)], CLASSES[Math.floor(random() * CLASSES.length)], position)
  })
  return [...grouped, ...hostileWings, ...solos]
}
