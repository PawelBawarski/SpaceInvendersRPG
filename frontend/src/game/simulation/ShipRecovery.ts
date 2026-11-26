import type { PlanetSite, SectorPosition } from '../domain/exploration'

export const RECOVERY_LAUNCH_DURATION = 8
const FIRST_FLIGHT_ALTITUDE = 2500
export const RECOVERY_TASK = { circuits: 0, reactor: 1, ignition: 2 } as const
export const RECOVERY_TASKS = Object.values(RECOVERY_TASK)
export const RECOVERY_COMPLETE_MASK = (1 << RECOVERY_TASKS.length) - 1
export const RECOVERY_CIRCUIT_TURNS = [1, 3, 2] as const
export const RECOVERY_REACTOR = {
  voltage: { initial: 24, min: 58, max: 66 },
  frequency: { initial: 71, min: 32, max: 40 },
  synchronizationMilliseconds: 1400,
} as const
export const RECOVERY_IGNITION = {
  sequence: [2, 4, 1, 3],
  contacts: [1, 2, 3, 4],
  pulseMilliseconds: 680,
} as const

const LAUNCH_PATH = {
  liftProgress: .32, advanceFrom: .25, altitude: 8, distance: 175,
  maxPitch: .55, pitchRate: .7, retractFrom: .18, retractProgress: .23, fadeFrom: .87,
} as const

export function getRecoveryFlightPosition(planet: PlanetSite): SectorPosition {
  return { x: planet.x, y: planet.y, z: planet.z - planet.radius - FIRST_FLIGHT_ALTITUDE }
}

export function sampleRecoveryLaunch(progress: number) {
  const t = Math.max(0, Math.min(1, progress))
  const lift = Math.min(1, t / LAUNCH_PATH.liftProgress)
  const travel = Math.max(0, (t - LAUNCH_PATH.advanceFrom) / (1 - LAUNCH_PATH.advanceFrom))
  return {
    lift: lift * lift * (3 - 2 * lift) * LAUNCH_PATH.altitude,
    distance: travel * travel * LAUNCH_PATH.distance,
    pitch: -Math.min(LAUNCH_PATH.maxPitch, travel * LAUNCH_PATH.pitchRate),
    gear: 1 - Math.min(1, Math.max(0, (t - LAUNCH_PATH.retractFrom) / LAUNCH_PATH.retractProgress)),
    fade: Math.max(0, (t - LAUNCH_PATH.fadeFrom) / (1 - LAUNCH_PATH.fadeFrom)),
  }
}
