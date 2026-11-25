import { describe, expect, it } from 'vitest'
import { segmentBoundsOverlapSphere } from './collisionBroadphase'
import { segmentSphereContact } from './worldCombatMath'

describe('swept collision broadphase', () => {
  it('rejects distant segments while retaining fast crossings, grazing contact and starts inside', () => {
    const center = { x: 10, y: 20, z: 30 }
    expect(segmentBoundsOverlapSphere({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, center, 2)).toBe(false)
    expect(segmentBoundsOverlapSphere({ x: -100, y: 20, z: 30 }, { x: 100, y: 20, z: 30 }, center, 2)).toBe(true)
    expect(segmentBoundsOverlapSphere({ x: 1, y: 22, z: 30 }, { x: 12, y: 22, z: 30 }, center, 2)).toBe(true)
    expect(segmentBoundsOverlapSphere(center, center, center, 2)).toBe(true)
  })

  it('never rejects exact contacts across varied segments and translated spheres', () => {
    for (let index = 0; index < 300; index++) {
      const center = { x: Math.sin(index * 2) * 1000, y: Math.cos(index) * 300, z: index * 87 }
      const radius = 1 + index % 31
      const from = { x: center.x - radius * 3, y: center.y + Math.sin(index) * radius, z: center.z + Math.cos(index) * radius * 0.5 }
      const to = { x: center.x + radius * 3, y: center.y - Math.cos(index) * radius, z: center.z - Math.sin(index) * radius * 0.5 }
      if (segmentSphereContact(from, to, center, radius) !== null) expect(segmentBoundsOverlapSphere(from, to, center, radius)).toBe(true)
    }
  })
})
