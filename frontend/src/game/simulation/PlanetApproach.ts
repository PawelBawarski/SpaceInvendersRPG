import type { PlanetSite, SectorPosition } from '../domain/exploration'
import { orbitEntryPosition } from '../domain/planetOrbit'

export const ORBIT_ENTRY_DURATION = 7
export const ORBIT_EXIT_DURATION = 4
export function samplePlanetApproach(planet: PlanetSite, from: SectorPosition, progress: number, leaving = false) {
  const t = Math.max(0, Math.min(1, progress))
  const eased = t * t * (3 - 2 * t)
  const target = orbitEntryPosition(planet)
  if (leaving) {
    const length = Math.hypot(from.x - planet.x, from.y - planet.y, from.z - planet.z)
    const radius = length + 5500 * eased
    return { x: planet.x + (from.x - planet.x) / length * radius, y: planet.y + (from.y - planet.y) / length * radius, z: planet.z + (from.z - planet.z) / length * radius }
  }
  const a = { x: from.x - planet.x, y: from.y - planet.y, z: from.z - planet.z }
  const b = { x: target.x - planet.x, y: target.y - planet.y, z: target.z - planet.z }
  const radius = Math.max(planet.radius + 120, Math.hypot(a.x, a.y, a.z) * (1 - eased) + Math.hypot(b.x, b.y, b.z) * eased)
  // Spherical interpolation keeps the entire approach outside the planetary surface.
  const al = Math.hypot(a.x, a.y, a.z)
  const bl = Math.hypot(b.x, b.y, b.z)
  const cosine = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / al / bl))
  const angle = Math.acos(cosine)
  let direction: SectorPosition
  if (cosine < -0.999) {
    const theta = Math.PI * eased
    const tangentLength = Math.hypot(a.z, a.x) || 1
    direction = { x: a.x / al * Math.cos(theta) - a.z / tangentLength * Math.sin(theta), y: a.y / al * Math.cos(theta), z: a.z / al * Math.cos(theta) + a.x / tangentLength * Math.sin(theta) }
  } else if (angle < 0.001) direction = { x: b.x / bl, y: b.y / bl, z: b.z / bl }
  else {
    const left = Math.sin((1 - eased) * angle) / Math.sin(angle)
    const right = Math.sin(eased * angle) / Math.sin(angle)
    direction = { x: a.x / al * left + b.x / bl * right, y: a.y / al * left + b.y / bl * right, z: a.z / al * left + b.z / bl * right }
  }
  if (t === 1) return target
  return { x: planet.x + direction.x * radius, y: planet.y + direction.y * radius, z: planet.z + direction.z * radius }
}
