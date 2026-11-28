import { describe, expect, it } from 'vitest'
import { COCKPIT_CAMERA, cockpitCameraPose } from './CockpitCamera'

describe('cockpitCameraPose', () => {
  it('places the eye ahead of and above the hull', () => {
    const pose = cockpitCameraPose({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
    expect(pose.position.z).toBeCloseTo(COCKPIT_CAMERA.forward)
    expect(pose.position.y).toBeCloseTo(COCKPIT_CAMERA.height)
  })

  it('looks far ahead along the facing direction', () => {
    const pose = cockpitCameraPose({ x: 1, y: 2, z: 3 }, { x: 1, y: 0, z: 0 })
    expect(pose.target.x).toBeCloseTo(1 + COCKPIT_CAMERA.lookAhead)
    expect(pose.target.y).toBeCloseTo(2 + COCKPIT_CAMERA.height)
  })

  it('tracks the ship position exactly', () => {
    const base = { x: 5, y: -3, z: 9 }
    const forward = { x: 0, y: 0, z: 1 }
    const pose = cockpitCameraPose(base, forward)
    expect(pose.position.x).toBeCloseTo(base.x)
    expect(pose.position.z).toBeCloseTo(base.z + COCKPIT_CAMERA.forward)
  })
})