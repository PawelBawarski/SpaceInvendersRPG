import type { ShipPart, ShipPartSlot } from '../progress/shipParts'
import { DAMAGE_TYPES, getDamageResistance } from '../domain/damageTypes'

export type PilotUiLanguage = 'pl' | 'en'

const slotLabels = {
  pl: { weapon: 'Uzbrojenie', shield: 'Osłony', engine: 'Silnik', armor: 'Pancerz', reactor: 'Reaktor', scanner: 'Skaner' },
  en: { weapon: 'Weapon', shield: 'Shield', engine: 'Engine', armor: 'Armor', reactor: 'Reactor', scanner: 'Scanner' },
} as const

const rarityLabels = {
  pl: { standard: 'Standardowy', refined: 'Ulepszony', prototype: 'Prototyp' },
  en: { standard: 'Standard', refined: 'Refined', prototype: 'Prototype' },
} as const

export function getShipPartSlotLabel(language: PilotUiLanguage, slot: ShipPartSlot): string {
  return slotLabels[language][slot]
}

export function getShipPartRarityLabel(language: PilotUiLanguage, rarity: ShipPart['rarity']): string {
  return rarityLabels[language][rarity]
}

export function getShipPartStatSummary(part: ShipPart, language: PilotUiLanguage = 'pl'): string {
  const resistanceLabels = language === 'pl'
    ? { kinetic: 'KIN', thermal: 'TERM', ion: 'JON', radiation: 'RAD' }
    : { kinetic: 'KIN', thermal: 'HEAT', ion: 'ION', radiation: 'RAD' }
  return [
    part.stats.damagePercent > 0 ? `DMG +${part.stats.damagePercent}%` : '',
    part.stats.shieldPoints > 0 ? `SHD +${part.stats.shieldPoints}` : '',
    part.stats.hullPoints > 0 ? `HULL +${part.stats.hullPoints}` : '',
    part.stats.enginePercent > 0 ? `ENG +${part.stats.enginePercent}%` : '',
    part.stats.sensorRangePercent ? `${language === 'pl' ? 'Zasięg' : 'Range'} +${part.stats.sensorRangePercent}%` : '',
    part.stats.dodgeCooldownPercent ? `${language === 'pl' ? 'Czas uniku' : 'Dodge cooldown'} −${part.stats.dodgeCooldownPercent}%` : '',
    ...DAMAGE_TYPES.filter(type => getDamageResistance(type, part.resistances) > 0)
      .map(type => `${resistanceLabels[type]} ${Math.round(getDamageResistance(type, part.resistances) * 100)}%`),
  ].filter(Boolean).join(' · ')
}
