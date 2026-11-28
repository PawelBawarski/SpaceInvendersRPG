import { describe, expect, it } from 'vitest'
import {
  findNearbyMegastationNpc,
  getMegastationNpcPlacements,
  MEGASTATION_CONCOURSE_BOUNDS,
  MEGASTATION_TALK_RANGE,
} from './megastationInterior'
import { MEGASTATION_NPC } from './megastation'

describe('megastation concourse', () => {
  it('places every crew member inside the walkable hall', () => {
    const placements = getMegastationNpcPlacements()
    expect(placements).toHaveLength(MEGASTATION_NPC.length)
    for (const placement of placements) {
      expect(placement.x).toBeGreaterThan(MEGASTATION_CONCOURSE_BOUNDS.minX)
      expect(placement.x).toBeLessThan(MEGASTATION_CONCOURSE_BOUNDS.maxX)
      expect(placement.z).toBeGreaterThanOrEqual(MEGASTATION_CONCOURSE_BOUNDS.minZ)
      expect(placement.z).toBeLessThanOrEqual(MEGASTATION_CONCOURSE_BOUNDS.maxZ)
    }
  })

  it('finds the closest NPC within talk range and ignores the aisle', () => {
    const placements = getMegastationNpcPlacements()
    const target = placements[0]
    const near = findNearbyMegastationNpc({ x: target.x, z: target.z })
    expect(near?.npc.id).toBe(target.npc.id)
    const aisle = findNearbyMegastationNpc({ x: 0, z: 0 })
    expect(aisle).toBeNull()
    const justOutside = findNearbyMegastationNpc({ x: target.x + MEGASTATION_TALK_RANGE + 1, z: target.z })
    expect(justOutside).toBeNull()
  })
})