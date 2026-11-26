import type { SectorPosition } from '../domain/exploration'
import type { GalaxyBounds } from '../domain/galaxyLayout'

export const BOUNDARY_TRANSIT_SECONDS = 4.5

export function clampGalaxyPosition(position: SectorPosition, bounds: Readonly<GalaxyBounds>): SectorPosition {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, position.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, position.y)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, position.z)),
  }
}

export function isGalaxyBoundary(position: SectorPosition, bounds: Readonly<GalaxyBounds>, tolerance = 0.01): boolean {
  return position.x <= bounds.minX + tolerance || position.x >= bounds.maxX - tolerance
    || position.y <= bounds.minY + tolerance || position.y >= bounds.maxY - tolerance
    || position.z <= bounds.minZ + tolerance || position.z >= bounds.maxZ - tolerance
}

/** Move a cancelled boundary jump far enough inward that the chart cannot reopen on the next frame. */
export function returnFromGalaxyBoundary(position: SectorPosition, bounds: Readonly<GalaxyBounds>, inset = 360): SectorPosition {
  const clamped = clampGalaxyPosition(position, bounds)
  const safeInset = Math.max(1, Math.min(inset, (bounds.maxX - bounds.minX) / 4, (bounds.maxY - bounds.minY) / 4, (bounds.maxZ - bounds.minZ) / 4))
  const tolerance = 0.01
  return {
    x: clamped.x <= bounds.minX + tolerance ? bounds.minX + safeInset : clamped.x >= bounds.maxX - tolerance ? bounds.maxX - safeInset : clamped.x,
    y: clamped.y <= bounds.minY + tolerance ? bounds.minY + safeInset : clamped.y >= bounds.maxY - tolerance ? bounds.maxY - safeInset : clamped.y,
    z: clamped.z <= bounds.minZ + tolerance ? bounds.minZ + safeInset : clamped.z >= bounds.maxZ - tolerance ? bounds.maxZ - safeInset : clamped.z,
  }
}

export function getBoundaryCourses(position: SectorPosition, bounds: Readonly<GalaxyBounds>): SectorPosition[] {
  const distance = (target: SectorPosition) => Math.hypot(target.x - position.x, target.y - position.y, target.z - position.z)
  return [
    { ...position, x: bounds.minX }, { ...position, x: bounds.maxX },
    { ...position, y: bounds.minY }, { ...position, y: bounds.maxY },
    { ...position, z: bounds.minZ }, { ...position, z: bounds.maxZ },
  ].sort((left, right) => distance(left) - distance(right))
}
