import type { PlanetSite, SectorPosition } from '../domain/exploration'

export const RECOVERY_LAUNCH_DURATION = 8
const FIRST_FLIGHT_ALTITUDE = 2500
export const RECOVERY_TASK = { circuits: 0, reactor: 1, ignition: 2 } as const
export const RECOVERY_TASKS = Object.values(RECOVERY_TASK)
export const RECOVERY_COMPLETE_MASK = (1 << RECOVERY_TASKS.length) - 1
export const RECOVERY_CIRCUIT_TURNS = [1, 3, 2] as const
export const RECOVERY_REACTOR = { synchronizationMilliseconds: 1400 } as const
export const RECOVERY_IGNITION = { targetCount: 4, rotationSeconds: 2.8, toleranceRadians: .5 } as const
const RECOVERY_CHALLENGE_BANDS = {
  voltage: { minimum: 24, maximum: 66, widthMinimum: 10, widthMaximum: 17 },
  frequency: { minimum: 19, maximum: 67, widthMinimum: 9, widthMaximum: 16 },
  outsideMargin: 12,
} as const
type RecoveryBandRange = { minimum: number; maximum: number; widthMinimum: number; widthMaximum: number }

export interface RecoveryChallenge {
  voltage: { initial: number; min: number; max: number }
  frequency: { initial: number; min: number; max: number }
  ignitionTargets: readonly number[]
}

export function createRecoveryChallenge(seed: number): RecoveryChallenge {
  let state = seed >>> 0 || 1
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
  const band = ({ minimum, maximum, widthMinimum, widthMaximum }: RecoveryBandRange) => {
    const width = widthMinimum + Math.floor(random() * (widthMaximum - widthMinimum + 1))
    const min = minimum + Math.floor(random() * (maximum - minimum - width + 1))
    const outsideMargin = RECOVERY_CHALLENGE_BANDS.outsideMargin
    const outside = random() < .5 ? Math.max(0, min - outsideMargin) : Math.min(100, min + width + outsideMargin)
    return { initial: Math.round(outside), min, max: min + width }
  }
  return {
    voltage: band(RECOVERY_CHALLENGE_BANDS.voltage),
    frequency: band(RECOVERY_CHALLENGE_BANDS.frequency),
    ignitionTargets: Array.from({ length: RECOVERY_IGNITION.targetCount }, () => random() * Math.PI * 2),
  }
}

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
