import { gameText, type GameLanguage } from '../i18n'
import { SHIP_PART_REROLL_COST, getPilotLevel, type MissionProgress } from '../progress/missionProgress'
import { SHIP_PART_SLOTS, getShipPartLevelRequirement, getShipPartSellValue } from '../progress/shipParts'
import { getShipPartSlotLabel } from './shipPartPresentation'
import { PartArtwork } from './EquipmentArtwork'
import { IconButton } from './ActionIcon'

interface GaragePartsListProps {
  progress: MissionProgress
  language: GameLanguage
  onEquip: (partId: string) => void
  onReroll: (partId: string) => void
  onSell: (partId: string) => void
}

/** Backpack ship parts with equip / reroll / sell actions shown inside the hangar. */
export function GaragePartsList({ progress, language, onEquip, onReroll, onSell }: GaragePartsListProps) {
  const ui = gameText(language).application.ui
  const slotLabels = Object.fromEntries(SHIP_PART_SLOTS.map(slot => [slot, getShipPartSlotLabel(language, slot)]))
  const rarityLabels = {
    standard: ui.rarityStandard,
    refined: ui.rarityRefined,
    prototype: ui.rarityPrototype,
  }
  if (progress.shipParts.length === 0) return null
  return (
    <div className="garage-part-list">
      {progress.shipParts.map((part) => {
        const isEquipped = progress.equippedParts[part.slot] === part.id
        const requiredLevel = getShipPartLevelRequirement(part.rarity)
        const canEquip = getPilotLevel(progress.experience) >= requiredLevel
        const statLabels = [
          part.stats.damagePercent > 0 ? `DMG +${part.stats.damagePercent}%` : '',
          part.stats.shieldPoints > 0 ? `SHD +${part.stats.shieldPoints}` : '',
          part.stats.hullPoints > 0 ? `HULL +${part.stats.hullPoints}` : '',
          part.stats.enginePercent > 0 ? `ENG +${part.stats.enginePercent}%` : '',
        ].filter(Boolean).join(' · ')

        return (
          <article
            className={`garage-part rarity-${part.rarity}`}
            key={part.id}
            data-tooltip={statLabels || undefined}
            onContextMenu={(event) => {
              if (isEquipped) return
              event.preventDefault()
              onSell(part.id)
            }}
          >
            <PartArtwork slot={part.slot} rarity={part.rarity} />
            <div className="garage-part-info">
              <strong>{slotLabels[part.slot]}</strong>
              <span className={`rarity-badge rarity-${part.rarity}`}>{rarityLabels[part.rarity]}</span>
              <small>{statLabels}</small>
            </div>
            <div className="garage-part-actions">
              <button
                type="button"
                className="garage-part-action"
                disabled={isEquipped || !canEquip}
                data-tooltip={canEquip ? undefined : `${ui.garageLevelRequired}: ${requiredLevel}`}
                onClick={() => onEquip(part.id)}
              >
                {isEquipped
                  ? ui.garageEquipped
                  : canEquip
                    ? ui.garageEquip
                    : `${ui.garageLevelRequired}: ${requiredLevel}`}
              </button>
              <button
                type="button"
                className="garage-part-action"
                disabled={
                  progress.credits < SHIP_PART_REROLL_COST.credits
                  || progress.scrapMetal < SHIP_PART_REROLL_COST.scrapMetal
                  || progress.copper < SHIP_PART_REROLL_COST.copper
                  || progress.radioactiveResidue < SHIP_PART_REROLL_COST.radioactiveResidue
                }
                onClick={() => onReroll(part.id)}
              >
                {ui.garageReroll} • {SHIP_PART_REROLL_COST.credits} KS
              </button>
              {!isEquipped && <IconButton icon="sell" label={gameText(language).inventory.text.sell}
                tooltip={`${gameText(language).inventory.text.sell} · ${getShipPartSellValue(part)} KS`} onClick={() => onSell(part.id)} />}
            </div>
          </article>
        )
      })}
    </div>
  )
}