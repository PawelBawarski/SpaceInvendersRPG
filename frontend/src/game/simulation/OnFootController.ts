export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Axis-aligned walkable area with a single floor height. */
export interface WalkBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  floorY: number
}

export interface OnFootState {
  position: Vec3
  yaw: number
  pitch: number
}

export interface OnFootObstacle {
  x: number
  z: number
  radius: number
}

export interface OnFootInput {
  /** -1..1, positive walks toward the facing direction. */
  forward: number
  /** -1..1, positive strafes right. */
  strafe: number
  run: boolean
  /** Raw look deltas in pixels (already pointer-lock relative). */
  yawDelta: number
  pitchDelta: number
}

/**
 * Human-scale on-foot tuning. Eye height keeps the pilot shorter than the
 * landed ship (scaled by HANGAR_SHIP_SCALE) so the hero never dwarfs it.
 */
export const ON_FOOT = {
  eyeHeight: 1.62,
  bodyHeight: 1.8,
  radius: 0.35,
  walkSpeed: 3.2,
  runMultiplier: 1.7,
  lookSensitivity: 0.0022,
  maxPitch: Math.PI / 2 - 0.05,
} as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function createOnFootState(position: Vec3, yaw = 0, pitch = 0): OnFootState {
  return { position: { ...position }, yaw, pitch }
}

/** Pure single step. Returns a new state; never mutates the input. */
export function stepOnFoot(
  state: OnFootState,
  input: OnFootInput,
  bounds: WalkBounds,
  seconds: number,
  obstacles: readonly OnFootObstacle[] = [],
): OnFootState {
  const dt = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const yaw = state.yaw + input.yawDelta * ON_FOOT.lookSensitivity
  const pitch = clamp(state.pitch + input.pitchDelta * ON_FOOT.lookSensitivity, -ON_FOOT.maxPitch, ON_FOOT.maxPitch)

  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  // Forward faces +Z at yaw 0; right is +X rotated by yaw.
  let moveX = sin * input.forward + cos * input.strafe
  let moveZ = cos * input.forward - sin * input.strafe
  const magnitude = Math.hypot(moveX, moveZ)
  if (magnitude > 1) {
    moveX /= magnitude
    moveZ /= magnitude
  }
  const speed = ON_FOOT.walkSpeed * (input.run ? ON_FOOT.runMultiplier : 1)
  const radius = ON_FOOT.radius
  let x = clamp(state.position.x + moveX * speed * dt, bounds.minX + radius, bounds.maxX - radius)
  let z = clamp(state.position.z + moveZ * speed * dt, bounds.minZ + radius, bounds.maxZ - radius)
  // Push the hero out of solid props so they cannot walk through them.
  for (const obstacle of obstacles) {
    const dx = x - obstacle.x
    const dz = z - obstacle.z
    const minDistance = obstacle.radius + radius
    const distance = Math.hypot(dx, dz)
    if (distance > 0 && distance < minDistance) {
      const push = (minDistance - distance) / distance
      x = clamp(x + dx * push, bounds.minX + radius, bounds.maxX - radius)
      z = clamp(z + dz * push, bounds.minZ + radius, bounds.maxZ - radius)
    }
  }
  const y = bounds.floorY + ON_FOOT.eyeHeight
  return { position: { x, y, z }, yaw, pitch }
}