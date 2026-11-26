import type { FlightCommand, MouseFlightInput } from '../input/InputController'
import type { ShipPartBonuses } from '../progress/shipParts'
import { DODGE_TIMING } from '../domain/combat'
import { BASE_SHIP_VITALS } from '../domain/shipTelemetry'

const FLIGHT_SPEED_BASELINE = { cruise: 292.5, reverse: 241.8, reduction: .2 } as const
export const FLIGHT_SPEEDS = {
  cruise: FLIGHT_SPEED_BASELINE.cruise * (1 - FLIGHT_SPEED_BASELINE.reduction),
  reverse: FLIGHT_SPEED_BASELINE.reverse * (1 - FLIGHT_SPEED_BASELINE.reduction),
} as const
export const FLIGHT_STEERING = { pitchRate: 1.1, yawRate: 1.25, rollRate: 2.4, dodgeStep: 7 } as const
const SPEED_RESPONSE = 2.6
const MAX_DODGE_COOLDOWN_REDUCTION = 0.55

export function getDodgeCooldown(bonuses: Pick<ShipPartBonuses, 'dodgeCooldownPercent'>): number {
  return DODGE_TIMING.cooldown * (1 - Math.min(MAX_DODGE_COOLDOWN_REDUCTION, (bonuses.dodgeCooldownPercent ?? 0) / 100))
}

export interface FlightState {
  speed: number
  maxSpeed: number
  dodgeCooldown: number
  dodgeElapsed: number
  activeDodge: boolean
  shield: number
  hull: number
  perfectBonus: number
}

export interface FlightUpdate {
  pitch: number
  yaw: number
  roll: number
  thrust: number
  dodgeRequested: boolean
  fireRequested: boolean
}

export function createFlightState(): FlightState {
  return {
    speed: 14,
    maxSpeed: 24,
    dodgeCooldown: 0,
    dodgeElapsed: 0,
    activeDodge: false,
    ...BASE_SHIP_VITALS,
    perfectBonus: 0,
  }
}

export function readFlightUpdate(
  isDown: (command: FlightCommand) => boolean,
  mouse: MouseFlightInput = { yaw: 0, pitch: 0, fire: false },
): FlightUpdate {
  return {
    pitch: clamp((isDown('pitchDown') ? 1 : 0) - (isDown('pitchUp') ? 1 : 0) + mouse.pitch, -1, 1),
    yaw: clamp((isDown('yawRight') ? 1 : 0) - (isDown('yawLeft') ? 1 : 0) + mouse.yaw, -1, 1),
    roll: (isDown('rollLeft') ? 1 : 0) - (isDown('rollRight') ? 1 : 0),
    thrust: isDown('fullBoost') ? 1 : isDown('boost') ? 0.5 : isDown('brake') ? -1 : 0,
    dodgeRequested: isDown('dodge'),
    fireRequested: isDown('fire') || mouse.fire,
  }
}

export function integrateShipRoll(angle: number, command: number, dt: number, handling = 1): number {
  // The chase camera faces +Z; positive roll lowers the port wing on screen.
  return angle + command * FLIGHT_STEERING.rollRate * handling * Math.max(0, dt)
}

export function integrateShipPitch(angle: number, command: number, dt: number, handling = 1): number {
  return wrapAngle(angle + command * FLIGHT_STEERING.pitchRate * handling * Math.max(0, dt))
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

export function approachFlightSpeed(speed: number, targetSpeed: number, dt: number): number {
  return speed + (targetSpeed - speed) * (1 - Math.exp(-Math.max(0, dt) * SPEED_RESPONSE))
}

export function getFlightTargetSpeed(thrust: number, bonuses: Pick<ShipPartBonuses, 'enginePercent' | 'speedPercent'>): number {
  const multiplier = (1 + bonuses.enginePercent / 100) * (1 + (bonuses.speedPercent ?? 0) / 100)
  const power = clamp(thrust, -1, 1)
  return (power < 0 ? FLIGHT_SPEEDS.reverse : FLIGHT_SPEEDS.cruise) * power * multiplier
}

/** Integrate both velocity and distance so frame duration does not change acceleration. */
export function advanceFlightMotion(speed: number, targetSpeed: number, seconds: number) {
  const dt = Math.max(0, seconds)
  const response = -Math.expm1(-dt * SPEED_RESPONSE)
  return {
    speed: speed + (targetSpeed - speed) * response,
    distance: targetSpeed * dt + (speed - targetSpeed) * response / SPEED_RESPONSE,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
