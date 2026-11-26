import type { SectorPosition } from '../domain/exploration'

export interface NavigationObstacle extends SectorPosition { radius: number }

const NAVIGATION = { minimumLookahead: 240, maximumLookahead: 8000, planetLookaheadFraction: .12 } as const

const normalize = (x: number, y: number, z: number): SectorPosition => {
  const length = Math.hypot(x, y, z)
  return length > .00001 ? { x: x / length, y: y / length, z: z / length } : { x: 0, y: 0, z: 1 }
}

/**
 * Turns a flight vector around a planet before the ship reaches its collision shell.
 * The bias makes neighbouring ships choose opposite sides instead of forming one queue.
 */
export function steerAroundPlanets(
  position: SectorPosition,
  desired: SectorPosition,
  planets: readonly NavigationObstacle[],
  clearance: number,
  orbitBias = 1,
): SectorPosition {
  let direction = normalize(desired.x, desired.y, desired.z)
  for (const planet of planets) {
    const safeRadius = Math.max(0, planet.radius + clearance)
    const fromCenterX = position.x - planet.x
    const fromCenterY = position.y - planet.y
    const fromCenterZ = position.z - planet.z
    const distanceFromCenter = Math.hypot(fromCenterX, fromCenterY, fromCenterZ)
    const toCenterX = -fromCenterX
    const toCenterY = -fromCenterY
    const toCenterZ = -fromCenterZ
    const lookahead = Math.min(NAVIGATION.maximumLookahead, Math.max(NAVIGATION.minimumLookahead, safeRadius * NAVIGATION.planetLookaheadFraction))
    const ahead = toCenterX * direction.x + toCenterY * direction.y + toCenterZ * direction.z
    if (distanceFromCenter >= safeRadius && (ahead <= 0 || ahead > lookahead)) continue
    const closestDistance = ahead > 0
      ? Math.hypot(fromCenterX + direction.x * Math.min(ahead, lookahead), fromCenterY + direction.y * Math.min(ahead, lookahead), fromCenterZ + direction.z * Math.min(ahead, lookahead))
      : distanceFromCenter
    if (closestDistance >= safeRadius) continue
    const radial = normalize(fromCenterX || -direction.x, fromCenterY || -direction.y, fromCenterZ || -direction.z)
    const reference = Math.abs(radial.y) < .82 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
    const tangent = normalize(
      (radial.y * reference.z - radial.z * reference.y) * Math.sign(orbitBias || 1),
      (radial.z * reference.x - radial.x * reference.z) * Math.sign(orbitBias || 1),
      (radial.x * reference.y - radial.y * reference.x) * Math.sign(orbitBias || 1),
    )
    const proximity = Math.min(1, Math.max(0, 1 - closestDistance / Math.max(1, safeRadius)))
    const strength = .55 + proximity * 1.45
    direction = normalize(
      direction.x + tangent.x * strength + radial.x * proximity * 1.15,
      direction.y + tangent.y * strength + radial.y * proximity * 1.15,
      direction.z + tangent.z * strength + radial.z * proximity * 1.15,
    )
  }
  return direction
}

