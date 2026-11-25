import { DODGE_TIMING } from '../domain/combat'
import { getWeaponStatistics } from '../domain/weapon'
import type { ShipTelemetry } from '../domain/shipTelemetry'
import { getFlightTargetSpeed } from '../simulation/FlightSimulation'
import { getPilotLevel, getShipBonuses, getShipResistances, type MissionProgress } from './missionProgress'
import { getEquippedPartRarities } from './shipParts'
import { getShipVitals } from './shipMaintenance'
import { getMaximumShipVitals } from '../domain/shipTelemetry'

/** The read-only ship sheet uses the same tuning, modules and pilot bonuses as flight. */
export function getShipStatistics(progress: MissionProgress, telemetry?: ShipTelemetry | null) {
  const bonuses = getShipBonuses(progress)
  const { hull: maximumHull, shield: maximumShield } = getMaximumShipVitals(progress.shieldLevel, bonuses)
  const current = telemetry ?? getShipVitals(progress)
  const maximumSpeed = getFlightTargetSpeed(1, bonuses)
  const rarities = getEquippedPartRarities(progress.shipParts, progress.equippedParts)
  return {
    level: getPilotLevel(progress.experience), bonuses, rarities,
    weapon: getWeaponStatistics(bonuses, rarities.weapon ?? 'standard'),
    hull: Math.max(0, Math.min(maximumHull, current.hull)), maximumHull,
    shield: Math.max(0, Math.min(maximumShield, current.shield)), maximumShield,
    speed: telemetry?.speed ?? 0, maximumSpeed, halfSpeed: maximumSpeed * 0.5,
    reverseSpeed: Math.abs(getFlightTargetSpeed(-1, bonuses)),
    dodgeCooldown: DODGE_TIMING.cooldown, dodgeRemaining: telemetry?.dodgeRemaining ?? 0,
    burningIntensity: telemetry?.burningIntensity ?? 0,
    resistances: getShipResistances(progress),
  }
}
