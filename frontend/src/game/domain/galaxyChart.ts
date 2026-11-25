import type { SectorPosition } from './exploration'

export const ORION_SECTOR_ID = 'orion-7'
export const GALAXIES = [
  { id: ORION_SECTOR_ID, name: 'Orion–7', x: 24, y: 67, color: '#87dfff', sunColor: '#ffc278', seedSalt: 0 },
  { id: 'vesper', name: 'Vesper', x: 56, y: 26, color: '#c3a5ff', sunColor: '#b9ceff', seedSalt: 0x7934b98a },
  { id: 'carina', name: 'Carina', x: 80, y: 67, color: '#90e5c3', sunColor: '#ff9c75', seedSalt: 0xb817b69d },
] as const

export type Galaxy = (typeof GALAXIES)[number]
export type GalaxyId = Galaxy['id']
export const GALAXY_ARRIVAL: SectorPosition = { x: 0, y: 0, z: 880 }
export const HYPERSPACE_SECONDS = 3.2

export function getGalaxy(id: unknown): Galaxy {
  return GALAXIES.find(galaxy => galaxy.id === id) ?? GALAXIES[0]
}
