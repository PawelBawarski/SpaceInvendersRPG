import type { SectorPosition } from './exploration'

export const ORION_SECTOR_ID = 'orion-7'
export const GALAXIES = [
  { id: ORION_SECTOR_ID, name: 'Orion–7', x: 24, y: 67, color: '#87dfff', sunColor: '#ffc278', seedSalt: 0, level: 1 },
  { id: 'vesper', name: 'Vesper', x: 56, y: 26, color: '#c3a5ff', sunColor: '#b9ceff', seedSalt: 0x7934b98a, level: 12 },
  { id: 'carina', name: 'Carina', x: 80, y: 67, color: '#90e5c3', sunColor: '#ff9c75', seedSalt: 0xb817b69d, level: 22 },
  { id: 'erebus', name: 'Erebus', x: 50, y: 88, color: '#ff9db0', sunColor: '#ff6b6b', seedSalt: 0x51f0a3c7, level: 32 },
] as const

export type Galaxy = (typeof GALAXIES)[number]
export type GalaxyId = Galaxy['id']
export const GALAXY_ARRIVAL: SectorPosition = { x: 0, y: 0, z: 880 }
export const HYPERSPACE_SECONDS = 3.2

const ZONE_LEVEL_DISTANCE = 1_200_000
const MAX_ZONE_LEVEL = 40

export function getZoneLevel(galaxy: Galaxy, position: SectorPosition): number {
  const distanceFromCore = Math.hypot(position.x, position.y, position.z)
  return Math.min(MAX_ZONE_LEVEL, galaxy.level + Math.floor(distanceFromCore / ZONE_LEVEL_DISTANCE))
}

export type LevelBand = 'entry' | 'frontier' | 'veteran' | 'elite'

/** Coarse level-area classification used to label and gate content by region. */
export function getLevelBand(level: number): LevelBand {
  if (level <= 5) return 'entry'
  if (level <= 15) return 'frontier'
  if (level <= 28) return 'veteran'
  return 'elite'
}

export function getGalaxy(id: unknown): Galaxy {
  return GALAXIES.find(galaxy => galaxy.id === id) ?? GALAXIES[0]
}
