export interface IdleDrift {
  x: number
  y: number
  z: number
  pitch: number
  yaw: number
  roll: number
}

/**
 * Gentle, deterministic drift so an idle ship never looks frozen in space.
 * Visual-only: small local offsets applied to the ship mesh, never the flight
 * transform, so docking, collision and saving are unaffected.
 */
export function sampleIdleDrift(seconds: number): IdleDrift {
  const t = Number.isFinite(seconds) ? seconds : 0
  return {
    x: Math.sin(t * 0.21) * 0.16,
    y: Math.sin(t * 0.8) * 0.28 + Math.sin(t * 0.37 + 1.3) * 0.12,
    z: Math.cos(t * 0.29) * 0.14,
    pitch: Math.sin(t * 0.33 + 0.7) * 0.02,
    yaw: Math.sin(t * 0.24) * 0.03,
    roll: Math.cos(t * 0.41) * 0.05,
  }
}