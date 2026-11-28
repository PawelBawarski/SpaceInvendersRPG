import type { WalkBounds } from '../simulation/OnFootController'

/**
 * Walkable region of the hangar deck, matching the floor mesh in GarageCanvas
 * (top surface at y = -1.1, walls at x = ±12, rear wall near z = 17).
 */
export const HANGAR_WALK_BOUNDS: WalkBounds = {
  minX: -11.4,
  maxX: 11.4,
  minZ: -10.5,
  maxZ: 16,
  floorY: -1.1,
}

/**
 * Placeholder interior of the player's ship for the on-foot mode. Kept small so
 * the hero (eye height 1.62) is clearly dwarfed by the landed hull.
 */
export const SHIP_INTERIOR_BOUNDS: WalkBounds = {
  minX: -2.4,
  maxX: 2.4,
  minZ: -6,
  maxZ: 6,
  floorY: 0,
}