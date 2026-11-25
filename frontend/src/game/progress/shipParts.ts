import { DAMAGE_TYPES, getDamageResistance, type ResistanceProfile } from '../domain/damageTypes'

export const SHIP_PART_SLOTS = ['weapon', 'shield', 'engine'] as const
export const SHIP_PART_STORAGE_CAPACITY = 36
export type ShipPartSlot = (typeof SHIP_PART_SLOTS)[number]
export type ShipPartRarity = 'standard' | 'refined' | 'prototype'
export type EquippedPartRarities = Partial<Record<ShipPartSlot, ShipPartRarity>>

export const SHIP_PART_RARITY_COLORS: Record<ShipPartRarity, string> = {
  standard: '#edf1f5',
  refined: '#62a8ff',
  prototype: '#ce8aff',
}

export function getShipPartLevelRequirement(rarity: ShipPartRarity): number {
  if (rarity === 'prototype') return 6
  if (rarity === 'refined') return 3
  return 1
}

export interface ShipPartStats {
  damagePercent: number
  shieldPoints: number
  hullPoints: number
  enginePercent: number
}

export interface ShipPart {
  id: string
  slot: ShipPartSlot
  rarity: ShipPartRarity
  stats: ShipPartStats
  resistances?: ResistanceProfile
}

export type ShipPartBonuses = ShipPartStats & {
  handlingPercent?: number
  speedPercent?: number
}

export function getEquippedPartRarities(
  parts: readonly ShipPart[],
  equipped: Partial<Record<ShipPartSlot, string | null>>,
): EquippedPartRarities {
  const rarityBySlot: EquippedPartRarities = {}
  for (const slot of SHIP_PART_SLOTS) {
    const part = parts.find((item) => item.id === equipped[slot] && item.slot === slot)
    if (part) rarityBySlot[slot] = part.rarity
  }
  return rarityBySlot
}

export function getShipPartSellValue(part: ShipPart): number {
  const rarityValue = part.rarity === 'prototype' ? 120 : part.rarity === 'refined' ? 65 : 30
  const statValue = Object.values(part.stats).reduce((total, value) => total + Math.max(0, value), 0)
  return rarityValue + Math.round(statValue * 2)
}

const STAT_KEYS: readonly (keyof ShipPartStats)[] = [
  'damagePercent',
  'shieldPoints',
  'hullPoints',
  'enginePercent',
]

function randomUnit(random: () => number): number {
  return Math.max(0, Math.min(0.999999, random()))
}

function randomAmount(random: () => number, minimum: number, maximum: number, multiplier: number): number {
  return Math.round((minimum + Math.floor(randomUnit(random) * (maximum - minimum + 1))) * multiplier)
}

export function createRandomShipPart(
  id: string,
  random: () => number = Math.random,
  fixedSlot?: ShipPartSlot,
): ShipPart {
  const rarityRoll = randomUnit(random)
  const rarity: ShipPartRarity = rarityRoll < 0.72
    ? 'standard'
    : rarityRoll < 0.95
      ? 'refined'
      : 'prototype'
  const multiplier = rarity === 'prototype' ? 1.8 : rarity === 'refined' ? 1.35 : 1
  const slot = fixedSlot ?? SHIP_PART_SLOTS[Math.floor(randomUnit(random) * SHIP_PART_SLOTS.length)]
  const stats: ShipPartStats = {
    damagePercent: 0,
    shieldPoints: 0,
    hullPoints: 0,
    enginePercent: 0,
  }
  const primaryStat: keyof ShipPartStats = slot === 'weapon'
    ? 'damagePercent'
    : slot === 'shield'
      ? 'shieldPoints'
      : 'enginePercent'
  const range = primaryStat === 'damagePercent'
    ? [6, 14]
    : primaryStat === 'shieldPoints'
      ? [8, 20]
      : [4, 10]
  stats[primaryStat] = randomAmount(random, range[0], range[1], multiplier)

  if (randomUnit(random) < 0.38) {
    const secondaryStats = STAT_KEYS.filter((key) => key !== primaryStat)
    const secondaryStat = secondaryStats[Math.floor(randomUnit(random) * secondaryStats.length)]
    stats[secondaryStat] = randomAmount(random, 2, 7, multiplier)
  }

  const resistanceTier = rarity === 'prototype' ? 2 : rarity === 'refined' ? 1 : 0
  const resistances: ResistanceProfile | undefined = slot === 'shield'
    ? { kinetic: [0.05, 0.1, 0.15][resistanceTier], ion: [0.08, 0.16, 0.24][resistanceTier] }
    : slot === 'engine'
      ? { thermal: [0.08, 0.16, 0.24][resistanceTier], radiation: [0.03, 0.06, 0.09][resistanceTier] }
      : undefined
  return { id, slot, rarity, stats, ...(resistances ? { resistances } : {}) }
}

function parseResistances(value: unknown): ResistanceProfile | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const known = DAMAGE_TYPES.filter(type => typeof record[type] === 'number' && Number.isFinite(record[type]))
  if (known.length === 0) return undefined
  return Object.fromEntries(known.map(type => [type, getDamageResistance(type, record as ResistanceProfile)]))
}

export function parseShipParts(value: unknown): ShipPart[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item): ShipPart[] => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const statsValue = record.stats
    if (typeof statsValue !== 'object' || statsValue === null || Array.isArray(statsValue)) return []
    const stats = statsValue as Record<string, unknown>
    if (
      typeof record.id !== 'string'
      || !record.id
      || !SHIP_PART_SLOTS.includes(record.slot as ShipPartSlot)
      || (record.rarity !== 'standard' && record.rarity !== 'refined' && record.rarity !== 'prototype')
      || STAT_KEYS.some((key) => typeof stats[key] !== 'number' || !Number.isFinite(stats[key]))
    ) {
      return []
    }

    const resistances = parseResistances(record.resistances)
    return [{
      id: record.id,
      slot: record.slot as ShipPartSlot,
      rarity: record.rarity,
      stats: {
        damagePercent: stats.damagePercent as number,
        shieldPoints: stats.shieldPoints as number,
        hullPoints: stats.hullPoints as number,
        enginePercent: stats.enginePercent as number,
      },
      ...(resistances ? { resistances } : {}),
    }]
  })
}

export function getEquippedPartBonuses(
  parts: readonly ShipPart[],
  equipped: Partial<Record<ShipPartSlot, string>>,
): ShipPartBonuses {
  const bonuses: ShipPartBonuses = {
    damagePercent: 0,
    shieldPoints: 0,
    hullPoints: 0,
    enginePercent: 0,
  }

  for (const slot of SHIP_PART_SLOTS) {
    const part = parts.find((item) => item.id === equipped[slot] && item.slot === slot)
    if (!part) continue
    for (const key of STAT_KEYS) bonuses[key] += part.stats[key]
  }

  return bonuses
}
