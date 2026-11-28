import { describe, expect, it } from 'vitest'
import { ON_FOOT, createOnFootState, stepOnFoot, type WalkBounds } from './OnFootController'

const bounds: WalkBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, floorY: -1 }
const idle = { forward: 0, strafe: 0, run: false, yawDelta: 0, pitchDelta: 0 }

describe('stepOnFoot', () => {
  it('keeps the eye at a fixed height above the floor', () => {
    const state = stepOnFoot(createOnFootState({ x: 0, y: 0, z: 0 }), idle, bounds, 0.016)
    expect(state.position.y).toBeCloseTo(bounds.floorY + ON_FOOT.eyeHeight)
  })

  it('walks forward along the facing direction', () => {
    const start = createOnFootState({ x: 0, y: 0, z: 0 }, 0)
    const next = stepOnFoot(start, { ...idle, forward: 1 }, bounds, 1)
    expect(next.position.z).toBeGreaterThan(0)
    expect(next.position.x).toBeCloseTo(0)
  })

  it('strafes right relative to yaw', () => {
    const start = createOnFootState({ x: 0, y: 0, z: 0 }, 0)
    const next = stepOnFoot(start, { ...idle, strafe: 1 }, bounds, 1)
    expect(next.position.x).toBeGreaterThan(0)
  })

  it('runs faster than walking', () => {
    const start = createOnFootState({ x: 0, y: 0, z: 0 }, 0)
    const walk = stepOnFoot(start, { ...idle, forward: 1 }, bounds, 1)
    const run = stepOnFoot(start, { ...idle, forward: 1, run: true }, bounds, 1)
    expect(run.position.z).toBeGreaterThan(walk.position.z)
  })

  it('does not move faster diagonally than straight ahead', () => {
    const start = createOnFootState({ x: 0, y: 0, z: 0 }, 0)
    const straight = stepOnFoot(start, { ...idle, forward: 1 }, bounds, 1)
    const diagonal = stepOnFoot(start, { ...idle, forward: 1, strafe: 1 }, bounds, 1)
    const travelled = (s: typeof straight) => Math.hypot(s.position.x - start.position.x, s.position.z - start.position.z)
    expect(travelled(diagonal)).toBeLessThanOrEqual(travelled(straight) + 1e-6)
  })

  it('clamps movement inside the walkable bounds', () => {
    const edge = createOnFootState({ x: bounds.maxX - 0.5, y: 0, z: 0 }, 0)
    const next = stepOnFoot(edge, { ...idle, strafe: 1 }, bounds, 10)
    expect(next.position.x).toBeLessThanOrEqual(bounds.maxX - ON_FOOT.radius)
  })

  it('applies look deltas and clamps pitch', () => {
    const start = createOnFootState({ x: 0, y: 0, z: 0 })
    const looked = stepOnFoot(start, { ...idle, yawDelta: 100, pitchDelta: 100000 }, bounds, 0.016)
    expect(looked.yaw).toBeGreaterThan(start.yaw)
    expect(looked.pitch).toBeLessThanOrEqual(ON_FOOT.maxPitch)
  })

  it('does not mutate the input state', () => {
    const start = createOnFootState({ x: 1, y: 2, z: 3 }, 0.5)
    const snapshot = JSON.stringify(start)
    stepOnFoot(start, { ...idle, forward: 1, yawDelta: 10 }, bounds, 0.5)
    expect(JSON.stringify(start)).toBe(snapshot)
  })

  it('pushes the hero out of solid obstacles', () => {
    const start = createOnFootState({ x: 0, y: 0, z: -1 }, 0)
    const next = stepOnFoot(start, { ...idle, forward: 1 }, bounds, 1, [{ x: 0, z: 0, radius: 1 }])
    const distance = Math.hypot(next.position.x, next.position.z)
    expect(distance).toBeGreaterThanOrEqual(1 + ON_FOOT.radius - 1e-6)
  })
})