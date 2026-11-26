import { describe, expect, it } from 'vitest'
import { keepCameraOutsidePlanets, segmentSphereContact } from './worldCombatMath'

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

  it('shortens the chase offset even when both ends are clear of the planet', () => {
    const camera = { x: 0, y: 0, z: 20 }
    keepCameraOutsidePlanets({ x: 0, y: 0, z: -20 }, camera, [{ ...center, radius: 4 }], 2)
    expect(camera.z).toBeCloseTo(-6)
  })

  it('projects a camera emerging from a landing shell outside the surface', () => {
    const camera = { ...center }
    keepCameraOutsidePlanets(center, camera, [{ ...center, radius: 50 }], 2)
    expect(Math.hypot(camera.x, camera.y, camera.z)).toBeCloseTo(52)
  })
})
