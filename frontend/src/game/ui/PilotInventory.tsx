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
import type { GraphicsQuality } from '../progress/gameSettings'
import './PilotInventory.css'

const ShipPreviewCanvas = lazy(() => import('../renderer/ShipPreviewCanvas').then(module => ({ default: module.ShipPreviewCanvas })))

interface PilotInventoryProps {
  progress: MissionProgress
  language: 'pl' | 'en'
  canSell: boolean
  quality: GraphicsQuality
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
  quality,
  onClose,
  onEquip,
  onUnequip,
  onSell,
  onOpenStatistics,
}: PilotInventoryProps) {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const pl = language === 'pl'
  const text = language === 'pl'
    ? {
        title: 'Ekwipunek pilota',
        subtitle: 'Założone części pozostają poza plecakiem. Zmiany wyposażenia są dostępne poza walką.',
        sellHint: 'PPM na część sprzedaje ją w warsztacie.',
        close: 'Zamknij ekwipunek',
        equipped: 'Na statku',
        backpack: 'Plecak 6 × 6',
        empty: 'Puste miejsce',
        equip: 'Załóż',
        remove: 'Zdemontuj',
        full: 'Plecak pełny',
        sell: 'Sprzedaj',
        required: 'Wymagany poziom',
        materials: 'Materiały i zasoby',
        credits: 'Kredyty',
        overflow: 'Dodatkowe części zachowane ze starszego zapisu',
      }
    : {
        title: 'Pilot loadout',
        subtitle: 'Equipped parts are stored separately. Loadout changes are available outside combat.',
        sellHint: 'Right-click a part to sell it in the hangar.',
        close: 'Close inventory',
        equipped: 'Equipped',
        backpack: 'Backpack 6 × 6',
        empty: 'Empty slot',
        equip: 'Equip',
        remove: 'Unequip',
        full: 'Backpack full',
        sell: 'Sell',
        required: 'Required level',
        materials: 'Materials and resources',
        credits: 'Credits',
        overflow: 'Additional parts preserved from an older save',
      }
  const backpackParts = getBackpackShipParts(progress)
  const visibleParts = backpackParts.slice(0, SHIP_PART_STORAGE_CAPACITY)
  const overflowParts = backpackParts.slice(SHIP_PART_STORAGE_CAPACITY)
  const selectedPart = backpackParts.find(part => part.id === selectedPartId)
  const installedPart = selectedPart && progress.shipParts.find(part => part.id === progress.equippedParts[selectedPart.slot])
  const rarities = getEquippedPartRarities(progress.shipParts, progress.equippedParts)
  const numberFormat = new Intl.NumberFormat(language)
  const materials: { kind: MaterialKind; name: string; hint: string; value: string | number }[] = [
    { kind: 'credits', name: text.credits, hint: language === 'pl' ? 'Handel i warsztat' : 'Trading and workshop', value: `${numberFormat.format(progress.credits)} KS` },
    { kind: 'alloy', name: language === 'pl' ? 'Stop metalu' : 'Alloy scrap', hint: language === 'pl' ? 'Konstrukcja modułów' : 'Module construction', value: numberFormat.format(progress.scrapMetal) },
    { kind: 'copper', name: language === 'pl' ? 'Miedź' : 'Copper', hint: language === 'pl' ? 'Obwody i ulepszenia' : 'Circuits and upgrades', value: numberFormat.format(progress.copper) },
    { kind: 'radioactive', name: language === 'pl' ? 'Pozostałość radioaktywna' : 'Radioactive residue', hint: language === 'pl' ? 'Rdzenie energetyczne' : 'Energy cores', value: numberFormat.format(progress.radioactiveResidue) },
  ]

  const renderPart = (part: ShipPart) => {
    const requiredLevel = getShipPartLevelRequirement(part.rarity)
    const canEquip = getPilotLevel(progress.experience) >= requiredLevel
    const tooltip = [
      `${getShipPartSlotLabel(language, part.slot)} · ${getShipPartRarityLabel(language, part.rarity)}`,
      getShipPartStatSummary(part, language),
      canEquip ? '' : `${text.required}: ${requiredLevel}`,
      canSell ? `${text.sell}: ${getShipPartSellValue(part)} KS (PPM)` : '',
    ].filter(Boolean).join('\n')

    return (
      <article
        className={`pilot-item rarity-${part.rarity}`}
        key={part.id}
        draggable={canEquip}
        aria-label={`${getShipPartSlotLabel(language, part.slot)}, ${getShipPartRarityLabel(language, part.rarity)}, ${getShipPartStatSummary(part, language)}`}
        title={tooltip}
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
            title={canEquip ? tooltip : `${text.required}: ${requiredLevel}`}
            onClick={() => onEquip(part.id)}
          >
            {canEquip ? text.equip : `${text.required}: ${requiredLevel}`}
          </button>
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
      <div className="equipped-part-copy" title={part ? getShipPartStatSummary(part, language) : undefined}>
        <strong>{getShipPartSlotLabel(language, slot)}</strong>
        {part ? <small>{getShipPartRarityLabel(language, part.rarity)}</small> : <small>{pl ? 'Wolne miejsce' : 'Free slot'}</small>}
      </div>
      {part && <button type="button" disabled={backpackParts.length >= SHIP_PART_STORAGE_CAPACITY} onClick={() => onUnequip(slot)}>{text.remove}</button>}
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
            <p className="eyebrow">{language === 'pl' ? 'ŁADOWNIA / MODUŁY STATKU' : 'CARGO / SHIP MODULES'}</p>
            <h2 id="pilot-inventory-title">{text.title}</h2>
            <p>{text.subtitle}{canSell ? ` ${text.sellHint}` : ''}</p>
          </div>
          <button type="button" className="pilot-open-statistics" onClick={onOpenStatistics}>{pl ? 'Parametry i rozwój' : 'Stats and training'} <kbd>C</kbd></button>
          <button type="button" className="pilot-inventory-close" aria-label={text.close} onClick={onClose}>
            ×
          </button>
        </header>

        <section className="pilot-equipped" aria-labelledby="pilot-equipped-title">
          <h3 id="pilot-equipped-title">{text.equipped}</h3>
          <div className="pilot-equipped-slots pilot-ship-deck">
            <div className="pilot-slot-column">{SHIP_PART_SLOTS.slice(0, 3).map(renderSlot)}</div>
            <div className="pilot-ship-view">
              <Suspense fallback={<span>{pl ? 'Ładowanie podglądu…' : 'Loading preview…'}</span>}>
                <ShipPreviewCanvas rarities={rarities} quality={quality} label={pl ? 'Podgląd wyposażenia 3D' : 'Equipment 3D preview'} />
              </Suspense>
              <span aria-hidden="true">VANTA</span>
            </div>
            <div className="pilot-slot-column">{SHIP_PART_SLOTS.slice(3).map(renderSlot)}</div>
          </div>
          {selectedPart && <aside className="pilot-item-compare" aria-label={pl ? 'Porównanie modułów' : 'Module comparison'}>
            <strong>{getShipPartSlotLabel(language, selectedPart.slot)}</strong>
            <p><span>{pl ? 'Wybrany' : 'Selected'}</span> {getShipPartStatSummary(selectedPart, language)}</p>
            <p><span>{pl ? 'Zamontowany' : 'Installed'}</span> {installedPart ? getShipPartStatSummary(installedPart, language) : '—'}</p>
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
