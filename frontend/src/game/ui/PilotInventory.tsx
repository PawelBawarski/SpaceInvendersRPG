import { formatNumber, gameText, type GameLanguage } from '../i18n'
import { lazy, Suspense, useState } from 'react'
import {
  getBackpackShipParts,
  getPilotLevel,
  getShipResistances,
  type MissionProgress,
} from '../progress/missionProgress'
import {
  getShipPartLevelRequirement,
  getShipPartSellValue,
  getEquippedPartRarities,
  SHIP_PART_SLOTS,
  SHIP_PART_STORAGE_CAPACITY,
  type ShipPart,
  type ShipPartSlot,
} from '../progress/shipParts'
import {
  getShipPartRarityLabel,
  getShipPartSlotLabel,
  getShipPartStatSummary,
} from './shipPartPresentation'
import { MaterialArtwork, PartArtwork, type MaterialKind } from './EquipmentArtwork'
import { ShipResistanceReadout } from './ShipResistanceReadout'
import { IconButton } from './ActionIcon'
import type { GraphicsQuality } from '../progress/gameSettings'
import '../../styles/ui/PilotInventory.scss'

const ShipPreviewCanvas = lazy(() => import('../renderer/ShipPreviewCanvas').then(module => ({ default: module.ShipPreviewCanvas })))

interface PilotInventoryProps {
  progress: MissionProgress
  language: GameLanguage
  canSell: boolean
  /** Refitting (equip/unequip) is only allowed while docked at a station or hangar. */
  canRefit?: boolean
  quality: GraphicsQuality
  hullFraction: number
  onClose: () => void
  onEquip: (partId: string) => void
  onUnequip: (slot: ShipPartSlot) => void
  onSell: (partId: string) => void
  onOpenStatistics: () => void
}

function PilotInventory({
  progress,
  language,
  canSell,
  canRefit = true,
  quality,
  hullFraction,
  onClose,
  onEquip,
  onUnequip,
  onSell,
  onOpenStatistics,
}: PilotInventoryProps) {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const text = gameText(language).inventory.text
  const backpackParts = getBackpackShipParts(progress)
  const visibleParts = backpackParts.slice(0, SHIP_PART_STORAGE_CAPACITY)
  const overflowParts = backpackParts.slice(SHIP_PART_STORAGE_CAPACITY)
  const selectedPart = backpackParts.find(part => part.id === selectedPartId)
  const installedPart = selectedPart && progress.shipParts.find(part => part.id === progress.equippedParts[selectedPart.slot])
  const rarities = getEquippedPartRarities(progress.shipParts, progress.equippedParts)
  const number = (value: number) => formatNumber(value, language)
  const materials: { kind: MaterialKind; name: string; hint: string; value: string | number }[] = [
    { kind: 'credits', name: text.credits, hint: gameText(language).inventory.tradingAndWorkshop, value: `${number(progress.credits)} KS` },
    { kind: 'alloy', name: gameText(language).inventory.alloyScrap, hint: gameText(language).inventory.moduleConstruction, value: number(progress.scrapMetal) },
    { kind: 'copper', name: gameText(language).inventory.copper, hint: gameText(language).inventory.circuitsAndUpgrades, value: number(progress.copper) },
    { kind: 'radioactive', name: gameText(language).inventory.radioactiveResidue, hint: gameText(language).inventory.energyCores, value: number(progress.radioactiveResidue) },
  ]

  const renderPart = (part: ShipPart) => {
    const requiredLevel = getShipPartLevelRequirement(part.rarity)
    const canEquip = canRefit && getPilotLevel(progress.experience) >= requiredLevel
    const tooltip = [
      `${getShipPartSlotLabel(language, part.slot)} · ${getShipPartRarityLabel(language, part.rarity)}`,
      getShipPartStatSummary(part, language),
      canEquip ? '' : `${text.required}: ${requiredLevel}`,
      canSell ? `${text.sell} · ${getShipPartSellValue(part)} KS` : '',
    ].filter(Boolean).join('\n')

    return (
      <article
        className={`pilot-item rarity-${part.rarity}`}
        key={part.id}
        draggable={canEquip}
        aria-label={`${getShipPartSlotLabel(language, part.slot)}, ${getShipPartRarityLabel(language, part.rarity)}, ${getShipPartStatSummary(part, language)}`}
        data-tooltip={tooltip}
        onMouseEnter={() => setSelectedPartId(part.id)}
        onFocus={() => setSelectedPartId(part.id)}
        onDragStart={(event) => {
          if (!canEquip) {
            event.preventDefault()
            return
          }
          event.dataTransfer.setData('text/plain', part.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onContextMenu={(event) => {
          if (!canSell) return
          event.preventDefault()
          onSell(part.id)
        }}
      >
        <PartArtwork slot={part.slot} rarity={part.rarity} />
        <strong>{getShipPartSlotLabel(language, part.slot)}</strong>
        <span className={`rarity-badge rarity-${part.rarity}`}>{getShipPartRarityLabel(language, part.rarity)}</span>
        <small>{getShipPartStatSummary(part, language)}</small>
      <div className="pilot-item-actions">
          <button
            type="button"
            disabled={!canEquip}
            data-tooltip={canEquip ? tooltip : `${text.required}: ${requiredLevel}`}
            onClick={() => onEquip(part.id)}
          >
            {canEquip ? text.equip : `${text.required}: ${requiredLevel}`}
          </button>
          {canSell && <IconButton icon="sell" label={text.sell}
            tooltip={`${text.sell} · ${getShipPartSellValue(part)} KS`} onClick={() => onSell(part.id)} />}
      </div>
      </article>
    )
  }

  const renderSlot = (slot: ShipPartSlot) => {
    const part = progress.shipParts.find(item => item.id === progress.equippedParts[slot])
    return <article className={`pilot-equipped-slot${part ? ` rarity-${part.rarity}` : ' empty'}`} key={slot}
      data-equipped-slot={slot} onDragOver={event => event.preventDefault()} onDrop={event => {
        event.preventDefault()
        const id = event.dataTransfer.getData('text/plain')
        if (progress.shipParts.some(item => item.id === id && item.slot === slot)) onEquip(id)
      }}>
      <PartArtwork slot={slot} rarity={part?.rarity} />
      <div className="equipped-part-copy" data-tooltip={part ? getShipPartStatSummary(part, language) : undefined}>
        <strong>{getShipPartSlotLabel(language, slot)}</strong>
        {part ? <small>{getShipPartRarityLabel(language, part.rarity)}</small> : <small>{gameText(language).inventory.freeSlot}</small>}
      </div>
      {part && <button type="button" disabled={!canRefit || backpackParts.length >= SHIP_PART_STORAGE_CAPACITY} onClick={() => onUnequip(slot)}>{text.remove}</button>}
    </article>
  }

  return (
    <div className="pilot-inventory-backdrop">
      <section
        className="pilot-inventory"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilot-inventory-title"
      >
        <header className="pilot-inventory-header">
          <div>
            <p className="eyebrow">{gameText(language).inventory.cargoShipModules}</p>
            <h2 id="pilot-inventory-title">{text.title}</h2>
            <p>{text.subtitle}</p>
          </div>
          <IconButton icon="stats" className="pilot-open-statistics" label={gameText(language).inventory.statsAndTraining} onClick={onOpenStatistics} />
          <IconButton icon="close" className="pilot-inventory-close" label={text.close} onClick={onClose} />
        </header>

        <section className="pilot-equipped" aria-labelledby="pilot-equipped-title">
          <h3 id="pilot-equipped-title">{text.equipped}</h3>
          {!canRefit && <p className="pilot-refit-locked" role="status">{language === 'pl' ? 'Zmiana i modernizacja statku tylko w stacji lub hangarze.' : 'Refit and upgrades are only available at a station or hangar.'}</p>}
          <div className="pilot-equipped-slots pilot-ship-deck">
            <div className="pilot-slot-column">{SHIP_PART_SLOTS.slice(0, 3).map(renderSlot)}</div>
            <div className="pilot-ship-view">
              <Suspense fallback={<span>{gameText(language).inventory.loadingPreview}</span>}>
                <ShipPreviewCanvas rarities={rarities} quality={quality} label={gameText(language).inventory.equipment3dPreview} hullFraction={hullFraction} />
              </Suspense>
              <span aria-hidden="true">{gameText(language).common.shipName}</span>
            </div>
            <div className="pilot-slot-column">{SHIP_PART_SLOTS.slice(3).map(renderSlot)}</div>
          </div>
          {selectedPart && <aside className="pilot-item-compare" aria-label={gameText(language).inventory.moduleComparison}>
            <strong>{getShipPartSlotLabel(language, selectedPart.slot)}</strong>
            <p><span>{gameText(language).inventory.selected}</span> {getShipPartStatSummary(selectedPart, language)}</p>
            <p><span>{gameText(language).inventory.installed}</span> {installedPart ? getShipPartStatSummary(installedPart, language) : '—'}</p>
          </aside>}
          <ShipResistanceReadout resistances={getShipResistances(progress)} language={language} />
        </section>

        <section className="pilot-backpack" aria-labelledby="pilot-backpack-title">
          <h3 id="pilot-backpack-title">
            {text.backpack}
            <span>{Math.min(backpackParts.length, SHIP_PART_STORAGE_CAPACITY)} / {SHIP_PART_STORAGE_CAPACITY}</span>
          </h3>
          <div className="pilot-backpack-grid" aria-label={text.backpack}>
            {Array.from({ length: SHIP_PART_STORAGE_CAPACITY }, (_, index) => {
              const part = visibleParts[index]
              return part
                ? renderPart(part)
                : (
                  <div
                    className="pilot-item pilot-item-empty"
                    key={`empty-${index}`}
                    aria-label={`${text.empty} ${index + 1}`}
                  />
                )
            })}
          </div>
          {overflowParts.length > 0 && (
            <div className="pilot-overflow">
              <p>{text.overflow}</p>
              <div>{overflowParts.map(renderPart)}</div>
            </div>
          )}
        </section>

        <section className="pilot-materials" aria-labelledby="pilot-materials-title">
          <h3 id="pilot-materials-title">{text.materials}</h3>
          <div>
            {materials.map((material) => (
              <p key={material.kind}>
                <MaterialArtwork kind={material.kind} />
                <span className="pilot-material-copy"><span>{material.name}</span><small>{material.hint}</small></span>
                <strong>{material.value}</strong>
              </p>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}

export default PilotInventory
