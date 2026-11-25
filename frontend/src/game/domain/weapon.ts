import type { ShipPartBonuses } from '../progress/shipParts'
import type { ShipPartRarity } from '../progress/shipParts'

export const PLAYER_WEAPON = {
  criticalChance: 0.1,
  criticalMultiplier: 1.5,
  fireCooldown: 0.16,
  projectileSpeed: 1000,
  projectilesPerVolley: 2,
} as const

const DAMAGE_RANGES: Record<ShipPartRarity, readonly [number, number]> = {
  standard: [18, 24],
  refined: [22, 30],
  prototype: [26, 36],
}

export function getWeaponStatistics(bonuses: Pick<ShipPartBonuses, 'damagePercent'>, rarity: ShipPartRarity = 'standard') {
  const [minimum, maximum] = DAMAGE_RANGES[rarity]
  const multiplier = 1 + bonuses.damagePercent / 100
  const values = Array.from({ length: maximum - minimum + 1 }, (_, index) => (minimum + index) * multiplier)
  const normalAverage = values.reduce((sum, value) => sum + Math.round(value), 0) / values.length
  const criticalAverage = values.reduce((sum, value) => sum + Math.round(value * PLAYER_WEAPON.criticalMultiplier), 0) / values.length
  return {
    minimum: Math.round(minimum * multiplier), maximum: Math.round(maximum * multiplier),
    criticalChance: PLAYER_WEAPON.criticalChance, criticalMultiplier: PLAYER_WEAPON.criticalMultiplier,
    fireCooldown: PLAYER_WEAPON.fireCooldown, projectileSpeed: PLAYER_WEAPON.projectileSpeed,
    projectilesPerVolley: PLAYER_WEAPON.projectilesPerVolley,
    expectedDps: (normalAverage * (1 - PLAYER_WEAPON.criticalChance) + criticalAverage * PLAYER_WEAPON.criticalChance)
      * PLAYER_WEAPON.projectilesPerVolley / PLAYER_WEAPON.fireCooldown,
  }
}

export interface WeaponHit {
  damage: number
  critical: boolean
}

export function resolveWeaponHit(
  bonuses: Pick<ShipPartBonuses, 'damagePercent'>,
  random: () => number = Math.random,
  guaranteedCritical = false,
  rarity: ShipPartRarity = 'standard',
): WeaponHit {
  const criticalRoll = randomUnit(random)
  const damageRoll = randomUnit(random)
  const critical = guaranteedCritical || criticalRoll < PLAYER_WEAPON.criticalChance
  const [minimum, maximum] = DAMAGE_RANGES[rarity]
  const baseDamage = minimum + Math.floor(damageRoll * (maximum - minimum + 1))
  const multiplier = 1 + bonuses.damagePercent / 100
  const criticalMultiplier = critical ? PLAYER_WEAPON.criticalMultiplier : 1
  return {
    damage: Math.round(baseDamage * multiplier * criticalMultiplier),
    critical,
  }
}

export function applyArmorDamage(damage: number, armor: number): number {
  return Math.max(1, Math.round(damage) - Math.max(0, Math.round(armor)))
}

function randomUnit(random: () => number): number {
  return Math.max(0, Math.min(0.999999, random()))
}
