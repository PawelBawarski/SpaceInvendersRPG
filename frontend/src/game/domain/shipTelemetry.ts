import type { ShipPartBonuses } from '../progress/shipParts'

export interface ShipVitals {
  hull: number
  shield: number
}

export function getMaximumShipVitals(shieldLevel: number, bonuses: ShipPartBonuses): ShipVitals {
  return { hull: 100 + shieldLevel * 5 + bonuses.hullPoints, shield: 100 + shieldLevel * 10 + bonuses.shieldPoints }
}

export interface ShipTelemetry extends ShipVitals {
  speed: number
  dodgeRemaining: number
  burningIntensity: number
}
