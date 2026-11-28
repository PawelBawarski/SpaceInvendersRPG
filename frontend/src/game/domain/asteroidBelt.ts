import type { PlanetSite, SectorPosition } from './exploration'
import type { SectorLoot } from '../progress/missionProgress'

/** A single destructible rock inside an asteroid belt. */
export interface AsteroidRock extends SectorPosition {
  id: string
  radius: number
  health: number
  maxHealth: number
  /** Deterministic spin seed so rendering is stable across sessions. */
  spin: number
}

/** A belt of asteroids anchored to a planet. */
export interface AsteroidBeltSite extends SectorPosition {
  id: string
  innerRadius: number
  outerRadius: number
  count: number
  resourceProfile: 'ferrous' | 'radioactive'
}

export const ASTEROID_IMPACT = {
  collisionPadding: 1.5,
  recoveryPadding: 2.5,
  damage: 18,
  cooldownSeconds: 0.9,
} as const

/** Deterministic linear-congruential generator so belts are identical every load. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Builds one belt around each supplied planet, deterministically. */
export function buildAsteroidBelts(planets: readonly PlanetSite[], seed: number): AsteroidBeltSite[] {
  const random = createRandom(seed)
  return planets.slice(0, 2).map((planet, index) => {
    const innerRadius = planet.radius * (1.55 + random() * 0.25)
    return {
      id: `belt-${planet.id}`,
      x: planet.x,
      y: planet.y,
      z: planet.z,
      innerRadius,
      outerRadius: innerRadius + planet.radius * (0.5 + random() * 0.3),
      count: 48 + Math.floor(random() * 24),
      resourceProfile: index % 2 === 0 || random() < 0.5 ? 'ferrous' : 'radioactive',
    }
  })
}

/** Expands a belt into individual rocks with stable ids and transforms. */
export function generateAsteroidField(belt: AsteroidBeltSite, seed: number): AsteroidRock[] {
  const random = createRandom((seed ^ hashString(belt.id)) >>> 0)
  const rocks: AsteroidRock[] = []
  for (let index = 0; index < belt.count; index += 1) {
    const angle = random() * Math.PI * 2
    const distance = belt.innerRadius + random() * (belt.outerRadius - belt.innerRadius)
    const radius = 9 + random() * 22
    const maxHealth = Math.round(radius * (belt.resourceProfile === 'radioactive' ? 2.4 : 1.8))
    rocks.push({
      id: `${belt.id}-rock-${index}`,
      x: belt.x + Math.cos(angle) * distance,
      y: belt.y + (random() - 0.5) * belt.outerRadius * 0.16,
      z: belt.z + Math.sin(angle) * distance,
      radius,
      health: maxHealth,
      maxHealth,
      spin: random() * Math.PI * 2,
    })
  }
  return rocks
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Asteroids are richer in metal and radioactive residue than roaming drones. */
export function rollAsteroidLoot(belt: AsteroidBeltSite, random: () => number = Math.random): SectorLoot {
  const radioactive = belt.resourceProfile === 'radioactive'
  return {
    credits: 4 + Math.floor(random() * 8),
    experience: 6 + Math.floor(random() * 8),
    scrapMetal: 1 + Math.floor(random() * 3),
    copper: random() < 0.6 ? 1 + Math.floor(random() * 2) : 0,
    radioactiveResidue: radioactive ? (random() < 0.7 ? 1 : 0) : random() < 0.1 ? 1 : 0,
  }
}