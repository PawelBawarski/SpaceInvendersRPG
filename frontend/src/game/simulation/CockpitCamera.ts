export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface CameraPose {
  position: Vec3
  target: Vec3
}

export type CameraMode = 'chase' | 'cockpit'

/** First-person eye placed behind the dashboard so the cockpit shell fills the view. */
export const COCKPIT_CAMERA = { forward: 1.75, height: 0.66, lookAhead: 40 } as const

/** Pure cockpit (first-person) pose derived from the ship position and forward. */
export function cockpitCameraPose(position: Vec3, forward: Vec3): CameraPose {
  const { forward: ahead, height, lookAhead } = COCKPIT_CAMERA
  return {
    position: {
      x: position.x + forward.x * ahead,
      y: position.y + forward.y * ahead + height,
      z: position.z + forward.z * ahead,
    },
    target: {
      x: position.x + forward.x * lookAhead,
      y: position.y + forward.y * lookAhead + height,
      z: position.z + forward.z * lookAhead,
    },
  }
}