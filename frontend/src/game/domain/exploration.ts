import { formatText, localizedText, type LocalizedText } from '../i18n'
import { resolveWeaponHit } from './weapon'
import { createWorldShip, type FactionId, type ShipArchetype } from './worldFactions'
import type { MissionId } from '../missions/definitions'
import { sampleFormationPosition, samplePatrolRoute, type PatrolFormation } from './patrolFormation'
import { buildDeepSpacePopulation } from './worldPopulation'
import { buildGalaxyLayout, buildPlanetHangars, GALAXY_BOUNDS, type GalaxyBounds } from './galaxyLayout'
import { getGalaxy, ORION_SECTOR_ID, type Galaxy, type GalaxyId } from './galaxyChart'
import { buildAsteroidBelts, type AsteroidBeltSite } from './asteroidBelt'
export { createWorldShip, FACTIONS, SHIP_ARCHETYPES } from './worldFactions'
export type { FactionId, ShipArchetype, CombatShipProfile } from './worldFactions'
export { ORION_SECTOR_ID } from './galaxyChart'

export interface SectorPosition {
  x: number
  y: number
  z: number
}

/** A natural satellite orbiting a planet; distances are in metres, period in seconds. */
export interface PlanetMoon {
  radius: number
  /** Orbit radius measured from the planet centre. */
  distance: number
  color: string
  /** Seconds for one full orbit. */
  period: number
  /** Starting angle in radians so moons are not all aligned. */
  phase: number
  /** Orbit tilt in radians around the planet's local X axis. */
  inclination: number
}

export interface PlanetSite extends SectorPosition {
  orbitalFaction?: FactionId
  hasHangar?: boolean
  id: string
  name: LocalizedText
  description: LocalizedText
  color: string
  radius: number
  /** Optional atmosphere shell height in metres above the surface. */
  atmosphere?: number
  /** Natural satellites rendered and animated by the planet field. */
  moons?: readonly PlanetMoon[]
}

export interface DroneSite extends SectorPosition {
  id: string
  health: number
  faction?: FactionId
  archetype?: ShipArchetype
  damage?: number
  attackInterval?: number
  attackRange?: number
  projectileSpeed?: number
  speed?: number
  level?: number
  missionId?: MissionId
  formation?: PatrolFormation
}

export interface StationSite extends SectorPosition {
  planetId?: string
  id: string
  name: LocalizedText
  radius: number
  dockingRange: number
  launchPosition: SectorPosition
  faction: FactionId
  color: string
}

export interface SunSite extends SectorPosition {
  id: string
  name: LocalizedText
  radius: number
  /** Distance from the photosphere at which thermal exposure begins. */
  heatRange: number
}

export interface MerchantSite extends SectorPosition {
  name: LocalizedText
  radius: number
  tradeRange: number
}

export const MERCHANT_COURSE_ID = 'exchange-ark'

export interface GalaxyWorld {
  galaxy: Galaxy
  bounds: Readonly<GalaxyBounds>
  planets: readonly PlanetSite[]
  stations: readonly StationSite[]
  drones: readonly DroneSite[]
  asteroidBelts: readonly AsteroidBeltSite[]
  sun: SunSite
  merchant: MerchantSite
}

const ORION_SCALE = 3.75
/** Uniform body enlargement (planets + sun) relative to the fixed-size ship. */
const ORION_BODY_SCALE = 2.5
export const ORION_SECTOR_BOUNDS: Readonly<GalaxyBounds> = {
  minX: GALAXY_BOUNDS.minX * ORION_SCALE, maxX: GALAXY_BOUNDS.maxX * ORION_SCALE,
  minY: GALAXY_BOUNDS.minY * ORION_SCALE, maxY: GALAXY_BOUNDS.maxY * ORION_SCALE,
  minZ: GALAXY_BOUNDS.minZ * ORION_SCALE, maxZ: GALAXY_BOUNDS.maxZ * ORION_SCALE,
}

const ORIGINAL_ORION_SUN: Readonly<SunSite> = {
  id: 'meridian-sun', name: localizedText(text => text.world.meridianSun),
  x: 337920, y: 90112, z: 4280320, radius: 288000, heatRange: 20000,
}

function scaleOrionBody<T extends PlanetSite | SunSite>(site: T): T {
  return { ...site, x: site.x * ORION_SCALE, y: site.y * ORION_SCALE, z: site.z * ORION_SCALE, radius: site.radius * ORION_BODY_SCALE }
}

export const ORION_SUN = scaleOrionBody(ORIGINAL_ORION_SUN)

export const ORION_START_POSITION: Readonly<SectorPosition> = { x: 0, y: 0, z: 0 }

export const ORION_STATIONS: readonly StationSite[] = [
  {
    id: 'meridian-haven', name: localizedText(text => text.world.meridianHaven),
    x: 0, y: 0, z: 225, radius: 180, dockingRange: 440,
    launchPosition: { x: 0, y: 0, z: 560 }, faction: 'meridian', color: '#78cfff',
  },
  {
    id: 'nacre-crossing', name: localizedText(text => text.world.nacreCrossing),
    x: -3600, y: 800, z: 23500, radius: 240, dockingRange: 520,
    launchPosition: { x: -3600, y: 800, z: 23120 }, faction: 'nacre', color: '#73edd3',
  },
  {
    id: 'foundry-bastion', name: localizedText(text => text.world.foundryBastion),
    x: 4200, y: 1400, z: 50000, radius: 300, dockingRange: 600,
    launchPosition: { x: 4200, y: 1400, z: 49560 }, faction: 'meridian', color: '#ffbd7b',
  },
]

const PREVIOUS_ORION_PLANETS: readonly PlanetSite[] = [
  {
    id: 'glass-moon',
    name: localizedText(text => text.world.glassMoon),
    description: localizedText(text => text.world.glassMoonDescription),
    color: '#65a9c8',
    radius: 16,
    x: 0,
    y: 0,
    z: 528,
  },
  {
    id: 'ember-world',
    name: localizedText(text => text.world.emberWorld),
    description: localizedText(text => text.world.emberWorldDescription),
    color: '#c77951',
    radius: 24,
    x: 384,
    y: -144,
    z: 1800,
  },
  {
    id: 'meridian-wreck',
    name: localizedText(text => text.world.meridianWreck),
    description: localizedText(text => text.world.meridianWreckDescription),
    color: '#8a83c9',
    radius: 16,
    x: -480,
    y: 216,
    z: 3384,
  },
  {
    id: 'veil-archive',
    name: localizedText(text => text.world.veilArchive),
    description: localizedText(text => text.world.veilArchiveDescription),
    color: '#82c6c1',
    radius: 20,
    x: 648,
    y: -240,
    z: 4440,
  },
  {
    id: 'hollow-comet',
    name: localizedText(text => text.world.hollowComet),
    description: localizedText(text => text.world.hollowCometDescription),
    color: '#78bed9',
    radius: 22,
    x: -696,
    y: -336,
    z: 2520,
  },
  {
    id: 'quiet-foundry',
    name: localizedText(text => text.world.quietFoundry),
    description: localizedText(text => text.world.quietFoundryDescription),
    color: '#bd8d66',
    radius: 28,
    x: 120,
    y: 336,
    z: 3960,
  },
  {
    id: 'nacre-reef',
    name: localizedText(text => text.world.nacreReef),
    description: localizedText(text => text.world.nacreReefDescription),
    color: '#8b79c9',
    radius: 18,
    x: -192,
    y: 120,
    z: 4920,
  },
  {
    id: 'ashen-crown',
    name: localizedText(text => text.world.ashenCrown),
    description: localizedText(text => text.world.ashenCrownDescription),
    color: '#b67c59',
    radius: 30,
    x: 680,
    y: 220,
    z: 820,
  },
  {
    id: 'pale-sanctum',
    name: localizedText(text => text.world.paleSanctum),
    description: localizedText(text => text.world.paleSanctumDescription),
    color: '#b9c8bd',
    radius: 20,
    x: -340,
    y: 130,
    z: 1120,
  },
  {
    id: 'obsidian-tide',
    name: localizedText(text => text.world.obsidianTide),
    description: localizedText(text => text.world.obsidianTideDescription),
    color: '#6e689a',
    radius: 32,
    x: 110,
    y: -250,
    z: 1510,
  },
  {
    id: 'cinder-vault',
    name: localizedText(text => text.world.cinderVault),
    description: localizedText(text => text.world.cinderVaultDescription),
    color: '#bb654e',
    radius: 27,
    x: -730,
    y: 320,
    z: 1930,
  },
  {
    id: 'sable-garden',
    name: localizedText(text => text.world.sableGarden),
    description: localizedText(text => text.world.sableGardenDescription),
    color: '#588f7c',
    radius: 24,
    x: 730,
    y: -410,
    z: 2220,
  },
  {
    id: 'frost-threshold',
    name: localizedText(text => text.world.frostThreshold),
    description: localizedText(text => text.world.frostThresholdDescription),
    color: '#84b4cf',
    radius: 26,
    x: 310,
    y: 405,
    z: 2820,
  },
  {
    id: 'rusted-orbit',
    name: localizedText(text => text.world.rustedOrbit),
    description: localizedText(text => text.world.rustedOrbitDescription),
    color: '#b78c59',
    radius: 19,
    x: -210,
    y: -390,
    z: 3120,
  },
  {
    id: 'lumen-basin',
    name: localizedText(text => text.world.lumenBasin),
    description: localizedText(text => text.world.lumenBasinDescription),
    color: '#5caaa8',
    radius: 35,
    x: 640,
    y: 95,
    z: 3560,
  },
  {
    id: 'dusk-citadel',
    name: localizedText(text => text.world.duskCitadel),
    description: localizedText(text => text.world.duskCitadelDescription),
    color: '#777fae',
    radius: 31,
    x: -820,
    y: -120,
    z: 3830,
  },
  {
    id: 'silent-marsh',
    name: localizedText(text => text.world.silentMarsh),
    description: localizedText(text => text.world.silentMarshDescription),
    color: '#718f70',
    radius: 23,
    x: -395,
    y: 410,
    z: 4250,
  },
  {
    id: 'black-lantern',
    name: localizedText(text => text.world.blackLantern),
    description: localizedText(text => text.world.blackLanternDescription),
    color: '#777b8d',
    radius: 29,
    x: 385,
    y: -390,
    z: 4750,
  },
  {
    id: 'meridian-reach',
    name: localizedText(text => text.world.meridianReach),
    description: localizedText(text => text.world.meridianReachDescription),
    color: '#658aaa',
    radius: 38,
    x: 60,
    y: 80,
    z: 5260,
  },
]

const FRONTIER_PLANETS: readonly PlanetSite[] = [
  { id: 'aurora-expanse', name: localizedText(text => text.world.auroraExpanse), color: '#668ea8', x: -9000, y: 3200, z: 61000, radius: 580 },
  { id: 'iron-veil', name: localizedText(text => text.world.ironVeil), color: '#956f62', x: 14000, y: -6000, z: 70000, radius: 720 },
  { id: 'jade-silence', name: localizedText(text => text.world.jadeSilence), color: '#548d76', x: -18000, y: -2200, z: 79000, radius: 460 },
  { id: 'titan-rest', name: localizedText(text => text.world.titanRest), color: '#ac8763', x: 6000, y: 8500, z: 88000, radius: 1300 },
  { id: 'silver-requiem', name: localizedText(text => text.world.silverRequiem), color: '#a4b1b7', x: 22000, y: -9000, z: 97000, radius: 510 },
  { id: 'cobalt-depths', name: localizedText(text => text.world.cobaltDepths), color: '#42669c', x: -12000, y: 13000, z: 106000, radius: 980 },
  { id: 'ember-cathedral', name: localizedText(text => text.world.emberCathedral), color: '#a95c49', x: 19000, y: 2000, z: 115000, radius: 640 },
  { id: 'opal-drift', name: localizedText(text => text.world.opalDrift), color: '#82a5b1', x: -25000, y: -8000, z: 124000, radius: 420 },
  { id: 'storm-cradle', name: localizedText(text => text.world.stormCradle), color: '#8f7da8', x: 9000, y: 14000, z: 133000, radius: 1500 },
  { id: 'pilgrim-stone', name: localizedText(text => text.world.pilgrimStone), color: '#8d8c75', x: -5000, y: -14000, z: 142000, radius: 360 },
  { id: 'nacre-throne', name: localizedText(text => text.world.nacreThrone), color: '#5aaca1', x: 25000, y: -5000, z: 151000, radius: 780 },
  { id: 'night-estuary', name: localizedText(text => text.world.nightEstuary), color: '#605780', x: -20000, y: 7000, z: 160000, radius: 590 },
  { id: 'rust-colossus', name: localizedText(text => text.world.rustColossus), color: '#ad794f', x: -3000, y: -10000, z: 169000, radius: 1250 },
  { id: 'frozen-psalm', name: localizedText(text => text.world.frozenPsalm), color: '#8cb4c4', x: -26000, y: -2000, z: 178000, radius: 670 },
  { id: 'black-mirror', name: localizedText(text => text.world.blackMirror), color: '#626976', x: -15000, y: 14000, z: 187000, radius: 840 },
  { id: 'last-garden', name: localizedText(text => text.world.lastGarden), color: '#6c9b73', x: -18000, y: 10000, z: 198000, radius: 560 },
  { id: 'horizon-end', name: localizedText(text => text.world.horizonEnd), color: '#6489a9', x: -12000, y: -8000, z: 210000, radius: 1100 },
].map(planet => ({
  ...planet,
  description: localizedText(text => text.world.aRemoteWorldBeyondTheOld),
}))

const OUTER_REACH_PLANETS: readonly PlanetSite[] = [
  { id: 'blue-threshold', name: localizedText(text => text.world.blueThreshold), color: '#6496bd', x: -36000, y: -12000, z: 222000, radius: 1400 },
  { id: 'amber-vault', name: localizedText(text => text.world.amberVault), color: '#bd985d', x: 34000, y: 22000, z: 230000, radius: 2600 },
  { id: 'frost-prism', name: localizedText(text => text.world.frostPrism), color: '#8fb7c9', x: -51000, y: 14000, z: 238000, radius: 1000 },
  { id: 'goliath-ocean', name: localizedText(text => text.world.goliathOcean), color: '#426ba8', x: 8000, y: -26000, z: 246000, radius: 3800 },
  { id: 'red-pilgrimage', name: localizedText(text => text.world.redPilgrimage), color: '#ba6d57', x: 56000, y: -14000, z: 254000, radius: 2000 },
  { id: 'emerald-crown', name: localizedText(text => text.world.emeraldCrown), color: '#5e9879', x: -24000, y: 28000, z: 262000, radius: 3000 },
  { id: 'violet-observatory', name: localizedText(text => text.world.violetObservatory), color: '#937bb4', x: 42000, y: 4000, z: 270000, radius: 1500 },
  { id: 'titan-nocturne', name: localizedText(text => text.world.titanNocturne), color: '#6c7d9f', x: -58000, y: -24000, z: 278000, radius: 4200 },
  { id: 'white-cairn', name: localizedText(text => text.world.whiteCairn), color: '#b4bec0', x: -8000, y: -8000, z: 286000, radius: 1100 },
  { id: 'copper-dawn', name: localizedText(text => text.world.copperDawn), color: '#b88961', x: 23000, y: 31000, z: 294000, radius: 2400 },
  { id: 'serpent-depth', name: localizedText(text => text.world.serpentDepth), color: '#5a9291', x: -42000, y: 14000, z: 302000, radius: 1700 },
  { id: 'silent-giant', name: localizedText(text => text.world.silentGiant), color: '#a3987a', x: 56000, y: -28000, z: 310000, radius: 3300 },
  { id: 'indigo-witness', name: localizedText(text => text.world.indigoWitness), color: '#646eac', x: -16000, y: 3000, z: 318000, radius: 2200 },
  { id: 'broken-coral', name: localizedText(text => text.world.brokenCoral), color: '#ac7974', x: -56000, y: 27000, z: 326000, radius: 1900 },
  { id: 'oath-of-stone', name: localizedText(text => text.world.oathOfStone), color: '#9a8d76', x: -28000, y: -22000, z: 334000, radius: 3800 },
  { id: 'jade-reliquary', name: localizedText(text => text.world.jadeReliquary), color: '#7aa590', x: -48000, y: 7000, z: 342000, radius: 1400 },
  { id: 'last-anthem', name: localizedText(text => text.world.lastAnthem), color: '#a098b5', x: -36000, y: 31000, z: 350000, radius: 2600 },
  { id: 'deep-blue-throne', name: localizedText(text => text.world.deepBlueThrone), color: '#466e9c', x: -59000, y: -18000, z: 358000, radius: 4100 },
  { id: 'pilgrim-haven', name: localizedText(text => text.world.pilgrimHaven), color: '#93aaa4', x: -31000, y: -28000, z: 366000, radius: 1800 },
  { id: 'ash-garden', name: localizedText(text => text.world.ashGarden), color: '#9c8170', x: -52000, y: 24000, z: 374000, radius: 3100 },
  { id: 'crystal-dusk', name: localizedText(text => text.world.crystalDusk), color: '#8b9cb7', x: -40000, y: -10000, z: 382000, radius: 1600 },
  { id: 'eternal-drift', name: localizedText(text => text.world.eternalDrift), color: '#6b929d', x: -61000, y: 8000, z: 394000, radius: 2700 },
  { id: 'meridian-colossus', name: localizedText(text => text.world.meridianColossus), color: '#8d817d', x: -29000, y: -29000, z: 406000, radius: 3900 },
  { id: 'beyond-the-veil', name: localizedText(text => text.world.beyondTheVeil), color: '#7888ba', x: -50000, y: 25000, z: 420000, radius: 2300 },
].map(planet => ({ ...planet, description: localizedText(text => text.world.aVastWorldOnTheMeridian) }))

const BASE_PLANETS: readonly PlanetSite[] = [
  ...PREVIOUS_ORION_PLANETS.map(planet => ({
    ...planet, x: planet.x * 10, y: planet.y * 10, z: planet.z * 10, radius: planet.radius * 12,
  })),
  ...FRONTIER_PLANETS.map(planet => ({ ...planet, radius: planet.radius * 1.5 })),
  ...OUTER_REACH_PLANETS,
].map(planet => ({ ...planet, x: planet.x * 5.12, y: planet.y * 5.12, z: planet.z * 5.12, radius: planet.radius * 9 }))

function buildOrionPlanets(seed: number) {
  const previousLayout = buildGalaxyLayout(BASE_PLANETS, seed, ORION_STATIONS, ORIGINAL_ORION_SUN)
  return previousLayout.slice(0, Math.round(previousLayout.length * 0.75)).map(scaleOrionBody)
}

export let ORION_PLANETS: readonly PlanetSite[] = buildOrionPlanets(0)
export let PLANET_HANGARS: readonly StationSite[] = buildPlanetHangars(ORION_PLANETS)
export let ALL_HANGARS: readonly StationSite[] = [...ORION_STATIONS, ...PLANET_HANGARS]

const PREVIOUS_ORION_DRONES: readonly DroneSite[] = [
  { id: 'drone-a', x: -120, y: 48, z: 612, health: 45 },
  { id: 'drone-b', x: 348, y: -84, z: 1680, health: 55 },
  { id: 'drone-c', x: -384, y: 192, z: 3288, health: 65 },
  { id: 'drone-d', x: 624, y: -204, z: 4344, health: 55 },
  { id: 'drone-e', x: -648, y: -312, z: 2424, health: 60 },
  { id: 'drone-f', x: 168, y: 288, z: 3840, health: 70 },
  { id: 'drone-g', x: -264, y: 84, z: 4800, health: 65 },
  { id: 'drone-h', x: 36, y: -168, z: 1200, health: 50 },
  { id: 'drone-i', x: 552, y: 132, z: 2880, health: 75 },
  { id: 'drone-j', x: -480, y: -108, z: 4080, health: 80 },
]

const FLEET_FACTIONS: readonly FactionId[] = ['meridian', 'nacre', 'null-cult', 'ashen-legion']
const FLEET_ARCHETYPES: readonly ShipArchetype[] = ['scout', 'interceptor', 'bomber', 'frigate', 'monster', 'monster']

function buildWorldFleet(seed = 61483): DroneSite[] { return [
  ...PREVIOUS_ORION_DRONES.map((site, index) => ({
    ...createWorldShip(site.id, FLEET_FACTIONS[index % 4], FLEET_ARCHETYPES[index % FLEET_ARCHETYPES.length], {
      x: site.x * 10, y: site.y * 10, z: site.z * 10,
    }),
    health: site.health * 2,
  })),
  ...Array.from({ length: 62 }, (_, index) => {
    const planet = ORION_PLANETS[index % PREVIOUS_ORION_PLANETS.length]
    const angle = index * 2.399963229728653
    const orbit = planet.radius + 280 + Math.floor(index / PREVIOUS_ORION_PLANETS.length) * 100
    return createWorldShip(
      `faction-patrol-${index + 1}`,
      FLEET_FACTIONS[index % FLEET_FACTIONS.length],
      FLEET_ARCHETYPES[(index + Math.floor(index / 4)) % FLEET_ARCHETYPES.length],
      { x: planet.x + Math.cos(angle) * orbit, y: planet.y + Math.sin(angle * 0.7) * 90, z: planet.z + Math.sin(angle) * orbit },
    )
  }),
  ...FRONTIER_PLANETS.flatMap((source, planetIndex) => {
    const planet = ORION_PLANETS.find(site => site.id === source.id)
    if (!planet) return []
    return Array.from({ length: 2 }, (_, side) => {
      const index = planetIndex * 2 + side
      const angle = index * 2.399963229728653
      const orbit = planet.radius + 340
      return createWorldShip(
        `frontier-patrol-${index + 1}`,
        FLEET_FACTIONS[index % FLEET_FACTIONS.length],
        FLEET_ARCHETYPES[(index + Math.floor(index / 4)) % FLEET_ARCHETYPES.length],
        { x: planet.x + Math.cos(angle) * orbit, y: planet.y + Math.sin(angle * 0.7) * 150, z: planet.z + Math.sin(angle) * orbit },
      )
    })
  }),
  ...Array.from({ length: 180 }, (_, index): DroneSite => {
    const groupIndex = Math.floor(index / 4)
    const slot = index % 4
    const planet = ORION_PLANETS[(groupIndex * 2 + (slot === 3 ? 1 : 0)) % ORION_PLANETS.length]
    const angle = groupIndex * 2.399963229728653 + 0.85
    if (slot === 3) {
      const orbit = planet.radius + 740
      return createWorldShip(`outer-patrol-${index + 1}`, FLEET_FACTIONS[index % 4], FLEET_ARCHETYPES[groupIndex % FLEET_ARCHETYPES.length], {
        x: planet.x + Math.cos(angle) * orbit, y: planet.y + 120, z: planet.z + Math.sin(angle) * orbit,
      })
    }
    const formation: PatrolFormation = {
      id: `squadron-${groupIndex + 1}`, slot,
      anchor: groupIndex === 0 ? { x: -600, y: 120, z: 9200 } : { x: planet.x, y: planet.y, z: planet.z },
      radius: groupIndex === 0 ? 260 : planet.radius + 720,
      phase: angle, speed: 9,
    }
    const route = samplePatrolRoute(formation, 0)
    return {
      ...createWorldShip(`outer-patrol-${index + 1}`, FLEET_FACTIONS[groupIndex % 4], FLEET_ARCHETYPES[(groupIndex + slot) % FLEET_ARCHETYPES.length], sampleFormationPosition(route.center, route.forward, slot)),
      formation,
    }
  }),
  ...buildDeepSpacePopulation(ORION_PLANETS, ALL_HANGARS, ORION_SUN, seed),
] }

export let ORION_DRONES: readonly DroneSite[] = buildWorldFleet()

export function activateGalaxy(seed: number) {
  ORION_PLANETS = buildOrionPlanets(seed)
  PLANET_HANGARS = buildPlanetHangars(ORION_PLANETS)
  ALL_HANGARS = [...ORION_STATIONS, ...PLANET_HANGARS]
  ORION_DRONES = buildWorldFleet(seed)
}

export function getGalaxyWorld(id: GalaxyId, campaignSeed: number): GalaxyWorld {
  const galaxy = getGalaxy(id)
  const merchant: MerchantSite = {
    name: localizedText(text => text.world.exchangeArk),
    x: -880, y: 160, z: 3100, radius: 230, tradeRange: 1150,
  }
  if (id === ORION_SECTOR_ID) return { galaxy, bounds: ORION_SECTOR_BOUNDS, planets: ORION_PLANETS, stations: ALL_HANGARS, drones: ORION_DRONES, asteroidBelts: buildAsteroidBelts(ORION_PLANETS, campaignSeed), sun: ORION_SUN, merchant }

  const seed = (campaignSeed ^ galaxy.seedSalt) >>> 0 || 1
  const side = id === 'vesper' ? -1 : 1
  const sun = {
    id: `${id}-sun`, name: localizedText(text => formatText(text.world.sun, { name: galaxy.name })),
    x: 640000 * side, y: 145000, z: 3910000 + seed % 800000,
    radius: 240000 + seed % 45000, heatRange: 20000,
  }
  const ports = ORION_STATIONS.map((station, index): StationSite => ({
    ...station, id: `${id}-${station.id}`, x: station.x * side,
    name: localizedText(text => formatText(text.world.remotePortNames[index], { galaxy: galaxy.name })),
    color: galaxy.color,
    launchPosition: { ...station.launchPosition, x: station.launchPosition.x * side },
  }))
  const planets = buildGalaxyLayout(BASE_PLANETS, seed, ports, sun).map((planet, index) => ({
    ...planet, id: `${id}-${planet.id}`,
    name: localizedText((text, language) => formatText(text.world.remotePlanetName, { galaxy: galaxy.name, planet: planet.name[language] })),
    color: [planet.color, galaxy.color, galaxy.sunColor][index % 3],
  }))
  const stations = [...ports, ...buildPlanetHangars(planets)]
  const drones = buildDeepSpacePopulation(planets, stations, sun, seed).map(drone => ({ ...drone, id: `${id}-${drone.id}` }))
  return { galaxy, bounds: GALAXY_BOUNDS, planets, stations, drones, asteroidBelts: buildAsteroidBelts(planets, seed), sun, merchant: { ...merchant, x: merchant.x * side } }
}

export const VEIL_PATROL_DRONE: DroneSite = {
  id: 'veil-warden',
  x: 5880,
  y: -1920,
  z: 42000,
  health: 170,
  faction: 'null-cult', archetype: 'interceptor', damage: 14,
  attackInterval: 1.9, attackRange: 120, projectileSpeed: 95, speed: 24,
  missionId: 'patrol-hunt',
}

export function distanceBetween(left: SectorPosition, right: SectorPosition): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

export function findNearestStation(position: SectorPosition, stations: readonly StationSite[] = ALL_HANGARS): StationSite {
  return stations.reduce((nearest, station) => distanceBetween(position, station) < distanceBetween(position, nearest) ? station : nearest)
}

export function findNearbyPlanet(
  position: SectorPosition,
  planets: readonly PlanetSite[] = ORION_PLANETS,
  scanRange = 9,
): PlanetSite | null {
  const nearest = findNearestPlanet(position, planets)
  return nearest && distanceToPlanetSurface(position, nearest) <= scanRange ? nearest : null
}

export function distanceToPlanetSurface(position: SectorPosition, planet: PlanetSite): number {
  return Math.max(0, distanceBetween(position, planet) - planet.radius)
}

export function findPlanetCollision(
  position: SectorPosition,
  planets: readonly PlanetSite[] = ORION_PLANETS,
  shipRadius = 2.4,
): PlanetSite | null {
  return planets.find((planet) => distanceBetween(position, planet) < planet.radius + shipRadius) ?? null
}

/** Keep saves from before a planet expansion above the new surface, without collision damage. */
export function resolveSafeFlightPosition(position: SectorPosition, planets: readonly PlanetSite[] = ORION_PLANETS): SectorPosition {
  let safe = position
  for (const planet of planets) {
    const distance = distanceBetween(safe, planet)
    if (distance >= planet.radius + 2.4) continue
    const radius = planet.radius + 8
    const factor = radius / Math.max(distance, 0.001)
    safe = distance < 0.001 ? { x: planet.x, y: planet.y, z: planet.z - radius }
      : { x: planet.x + (safe.x - planet.x) * factor, y: planet.y + (safe.y - planet.y) * factor, z: planet.z + (safe.z - planet.z) * factor }
  }
  return safe
}

export function findNearestPlanet(
  position: SectorPosition,
  planets: readonly PlanetSite[] = ORION_PLANETS,
): PlanetSite | null {
  let nearest: PlanetSite | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const planet of planets) {
    const distance = distanceToPlanetSurface(position, planet)
    if (distance < nearestDistance) {
      nearest = planet
      nearestDistance = distance
    }
  }

  return nearest
}
export function calculateDroneDamage(bonuses: { damagePercent: number }): number {
  return resolveWeaponHit(bonuses, () => 1).damage
}
