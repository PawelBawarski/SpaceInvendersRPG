import { describe, expect, it } from 'vitest'
import { distanceToMegastation, isMegastationInRange, MEGASTATION, MEGASTATION_DOCK_RANGE, MEGASTATION_NPC } from './megastation'

describe('megastation', () => {
  it('is a colossal structure near the start, far larger than a hangar', () => {
    expect(MEGASTATION.radius).toBeGreaterThan(4000)
    expect(Math.hypot(MEGASTATION.x, MEGASTATION.y, MEGASTATION.z)).toBeLessThan(20000)
  })

  it('has a busy concourse with unique NPCs and side-mission hooks', () => {
    expect(MEGASTATION_NPC.length).toBeGreaterThanOrEqual(5)
    expect(new Set(MEGASTATION_NPC.map(npc => npc.id)).size).toBe(MEGASTATION_NPC.length)
    expect(MEGASTATION_NPC.some(npc => !!npc.sideMissionId)).toBe(true)
  })

  it('measures approach distance and interaction range from the ring centre', () => {
    expect(distanceToMegastation({ x: MEGASTATION.x, y: MEGASTATION.y, z: MEGASTATION.z })).toBe(0)
    const near = { x: MEGASTATION.x + MEGASTATION_DOCK_RANGE * 0.5, y: MEGASTATION.y, z: MEGASTATION.z }
    const far = { x: MEGASTATION.x + MEGASTATION_DOCK_RANGE * 2, y: MEGASTATION.y, z: MEGASTATION.z }
    expect(isMegastationInRange(near)).toBe(true)
    expect(isMegastationInRange(far)).toBe(false)
    expect(isMegastationInRange(far, MEGASTATION_DOCK_RANGE * 3)).toBe(true)
  })
})