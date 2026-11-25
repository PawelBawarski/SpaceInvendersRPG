import type { FlightCommand, MouseFlightInput } from '../input/InputController'
import type { ShipPartBonuses } from '../progress/shipParts'

export const FLIGHT_SPEEDS = { cruise: 292.5, reverse: 241.8 } as const
const SPEED_RESPONSE = 2.6

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
    shield: 100,
    hull: 100,
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
    roll: (isDown('rollRight') ? 1 : 0) - (isDown('rollLeft') ? 1 : 0),
    thrust: isDown('fullBoost') ? 1 : isDown('boost') ? 0.5 : isDown('brake') ? -1 : 0,
    dodgeRequested: isDown('dodge'),
    fireRequested: isDown('fire') || mouse.fire,
  }
}

export function integrateShipRoll(angle: number, command: number, dt: number, handling = 1): number {
  return angle - command * 2.4 * handling * Math.max(0, dt)
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
