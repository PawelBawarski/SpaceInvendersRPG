import { DEFAULT_GAME_LANGUAGE, gameText, type GameLanguage } from '../i18n'
import type { ShipPart, ShipPartSlot } from '../progress/shipParts'
import { DAMAGE_TYPES, getDamageResistance } from '../domain/damageTypes'

export function getShipPartSlotLabel(language: GameLanguage, slot: ShipPartSlot): string {
  return gameText(language).equipment.labels[slot]
}

export function getShipPartRarityLabel(language: GameLanguage, rarity: ShipPart['rarity']): string {
  return gameText(language).equipment.labels2[rarity]
}

export function getShipPartStatSummary(part: ShipPart, language: GameLanguage = DEFAULT_GAME_LANGUAGE): string {
  const resistanceLabels = gameText(language).equipment.resistanceLabels
  return [
    part.stats.damagePercent > 0 ? `DMG +${part.stats.damagePercent}%` : '',
    part.stats.shieldPoints > 0 ? `SHD +${part.stats.shieldPoints}` : '',
    part.stats.hullPoints > 0 ? `HULL +${part.stats.hullPoints}` : '',
    part.stats.enginePercent > 0 ? `ENG +${part.stats.enginePercent}%` : '',
    part.stats.sensorRangePercent ? `${gameText(language).equipment.range} +${part.stats.sensorRangePercent}%` : '',
    part.stats.dodgeCooldownPercent ? `${gameText(language).equipment.dodgeCooldown} −${part.stats.dodgeCooldownPercent}%` : '',
    ...DAMAGE_TYPES.flatMap(type => {
      const resistance = getDamageResistance(type, part.resistances)
      return resistance > 0 ? [`${resistanceLabels[type]} ${Math.round(resistance * 100)}%`] : []
    }),
  ].filter(Boolean).join(' · ')
}
