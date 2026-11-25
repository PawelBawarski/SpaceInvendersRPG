import { describe, expect, it } from 'vitest'
import { segmentSphereContact } from './worldCombatMath'

describe('world swept collisions', () => {
  const center = { x: 0, y: 0, z: 0 }

  it('detects a fast projectile crossing an entire enemy between frames', () => {
    expect(segmentSphereContact({ x: 0, y: 0, z: -100 }, { x: 0, y: 0, z: 100 }, center, 2)).toBeCloseTo(0.49)
  })

  it('does not hit a ship beside the trajectory or beyond its endpoint', () => {
    expect(segmentSphereContact({ x: 3, y: 0, z: -100 }, { x: 3, y: 0, z: 100 }, center, 2)).toBeNull()
    expect(segmentSphereContact({ x: 0, y: 0, z: -100 }, { x: 0, y: 0, z: -3 }, center, 2)).toBeNull()
  })

  it('handles a spawn already inside a collision volume without a division by zero', () => {
    expect(segmentSphereContact(center, center, center, 2)).toBe(0)
    expect(segmentSphereContact({ x: 3, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, center, 2)).toBeNull()
  })
})
