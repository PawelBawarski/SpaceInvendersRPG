import type { WalkBounds } from '../simulation/OnFootController'
import { MEGASTATION_NPC, type MegastationNpc } from './megastation'

/**
 * Walkable concourse inside Bastion Ring. A long hall; the hero (eye height
 * 1.62) walks between NPCs stationed along both sides.
 */
export const MEGASTATION_CONCOURSE_BOUNDS: WalkBounds = {
  minX: -13,
  maxX: 13,
  minZ: -20,
  maxZ: 20,
  floorY: 0,
}

export interface MegastationNpcPlacement {
  npc: MegastationNpc
  x: number
  z: number
  /** Facing angle (radians) the NPC looks toward the aisle. */
  facing: number
}

/** Spread the crew down the hall, alternating sides so the aisle stays clear. */
export function getMegastationNpcPlacements(): MegastationNpcPlacement[] {
  const count = MEGASTATION_NPC.length
  return MEGASTATION_NPC.map((npc, index) => {
    const side = index % 2 === 0 ? -1 : 1
    const t = count > 1 ? index / (count - 1) : 0.5
    return {
      npc,
      x: side * 7.5,
      z: -16 + t * 32,
      facing: side < 0 ? Math.PI / 2 : -Math.PI / 2,
    }
  })
}

/** How close (meters) the hero must be to an NPC to read their dialogue. */
export const MEGASTATION_TALK_RANGE = 3.2

export function findNearbyMegastationNpc(
  position: { x: number; z: number },
  range = MEGASTATION_TALK_RANGE,
): MegastationNpcPlacement | null {
  let best: MegastationNpcPlacement | null = null
  let bestDistance = range
  for (const placement of getMegastationNpcPlacements()) {
    const distance = Math.hypot(position.x - placement.x, position.z - placement.z)
    if (distance <= bestDistance) {
      bestDistance = distance
      best = placement
    }
  }
  return best
}