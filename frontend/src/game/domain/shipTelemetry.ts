import type { ShipPartBonuses } from '../progress/shipParts'

export const BASE_SHIP_VITALS = { hull: 100, shield: 100 } as const
export const FIRST_FLIGHT_VITALS = { hull: 30, shield: 0 } as const
export const WRECK_RECOVERY_VITALS = { hull: 10, shield: 0 } as const
const VITALS_PER_SHIELD_LEVEL = { hull: 5, shield: 10 } as const

export interface ShipVitals {
  hull: number
  shield: number
}

export function getMaximumShipVitals(shieldLevel: number, bonuses: ShipPartBonuses): ShipVitals {
  return {
    hull: BASE_SHIP_VITALS.hull + shieldLevel * VITALS_PER_SHIELD_LEVEL.hull + bonuses.hullPoints,
    shield: BASE_SHIP_VITALS.shield + shieldLevel * VITALS_PER_SHIELD_LEVEL.shield + bonuses.shieldPoints,
  }
}

export interface ShipTelemetry extends ShipVitals {
  speed: number
  dodgeRemaining: number
  burningIntensity: number
}
