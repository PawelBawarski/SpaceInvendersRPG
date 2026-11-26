import { getMaximumShipVitals, type ShipVitals } from '../domain/shipTelemetry'
import { getShipBonuses, type MissionProgress } from './missionProgress'

export const HANGAR_HULL_REGEN_PER_SECOND = 10
export const SHIELD_CREDITS_PER_POINT = 0.5

export function getShipVitals(progress: MissionProgress, maximum = getMaximumShipVitals(progress.shieldLevel, getShipBonuses(progress))): ShipVitals {
  return {
    hull: Math.min(maximum.hull, progress.shipVitals?.hull ?? maximum.hull),
    shield: Math.min(maximum.shield, progress.shipVitals?.shield ?? maximum.shield),
  }
}

export function updateShipVitals(progress: MissionProgress, vitals: ShipVitals): MissionProgress {
  const maximum = getMaximumShipVitals(progress.shieldLevel, getShipBonuses(progress))
  const current = getShipVitals(progress, maximum)
  const hull = Number.isFinite(vitals.hull) ? Math.max(0, Math.min(maximum.hull, vitals.hull)) : current.hull
  const shield = Number.isFinite(vitals.shield) ? Math.max(0, Math.min(maximum.shield, vitals.shield)) : current.shield
  if (progress.shipVitals?.hull === hull && progress.shipVitals.shield === shield) return progress
  return { ...progress, shipVitals: { hull, shield } }
}

export function regenerateHangarHull(progress: MissionProgress, seconds: number): MissionProgress {
  if (!Number.isFinite(seconds) || seconds <= 0) return progress
  const maximum = getMaximumShipVitals(progress.shieldLevel, getShipBonuses(progress))
  const current = getShipVitals(progress, maximum)
  const hull = Math.min(maximum.hull, current.hull + HANGAR_HULL_REGEN_PER_SECOND * seconds)
  const initialRepairRequired = progress.initialRepairRequired && hull < maximum.hull
  if (hull === current.hull && initialRepairRequired === progress.initialRepairRequired) return progress
  return { ...progress, shipVitals: { hull, shield: current.shield }, initialRepairRequired }
}

export function getShieldRechargeCost(progress: MissionProgress): number {
  const maximum = getMaximumShipVitals(progress.shieldLevel, getShipBonuses(progress))
  return Math.ceil(Math.max(0, maximum.shield - getShipVitals(progress, maximum).shield) * SHIELD_CREDITS_PER_POINT)
}

export function rechargeShipShields(progress: MissionProgress): MissionProgress {
  const cost = getShieldRechargeCost(progress)
  if (cost <= 0 || progress.credits < cost) return progress
  const maximum = getMaximumShipVitals(progress.shieldLevel, getShipBonuses(progress))
  return updateShipVitals({ ...progress, credits: progress.credits - cost }, { ...getShipVitals(progress), shield: maximum.shield })
}
