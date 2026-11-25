import {
  getBackpackShipParts,
  getPilotLevel,
  getShipResistances,
  type MissionProgress,
} from '../progress/missionProgress'
import {
  getShipPartLevelRequirement,
  getShipPartSellValue,
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
import './PilotInventory.css'

interface PilotInventoryProps {
  progress: MissionProgress
  language: 'pl' | 'en'
  canSell: boolean
  onClose: () => void
  onEquip: (partId: string) => void
  onUnequip: (slot: ShipPartSlot) => void
  onSell: (partId: string) => void
}

function PilotInventory({
  progress,
  language,
  canSell,
  onClose,
  onEquip,
  onUnequip,
  onSell,
}: PilotInventoryProps) {
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
          <button type="button" className="pilot-inventory-close" aria-label={text.close} onClick={onClose}>
            ×
          </button>
        </header>

        <section className="pilot-equipped" aria-labelledby="pilot-equipped-title">
          <h3 id="pilot-equipped-title">{text.equipped}</h3>
          <div className="pilot-equipped-slots">
            {SHIP_PART_SLOTS.map((slot) => {
              const part = progress.shipParts.find((item) => item.id === progress.equippedParts[slot])
              return (
                <article
                  className={`pilot-equipped-slot${part ? ` rarity-${part.rarity}` : ' empty'}`}
                  key={slot}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const partId = event.dataTransfer.getData('text/plain')
                    const draggedPart = progress.shipParts.find((item) => item.id === partId)
                    if (draggedPart?.slot === slot) onEquip(partId)
                  }}
                >
                  <PartArtwork slot={slot} rarity={part?.rarity} />
                  <div className="equipped-part-copy" title={part ? getShipPartStatSummary(part, language) : undefined}>
                    <strong>{getShipPartSlotLabel(language, slot)}</strong>
                    {part
                      ? (
                        <>
                          <span className={`rarity-badge rarity-${part.rarity}`}>{getShipPartRarityLabel(language, part.rarity)}</span>
                          <small>{getShipPartStatSummary(part, language)}</small>
                        </>
                      )
                      : <small>{language === 'pl' ? 'Brak części' : 'No part installed'}</small>}
                  </div>
                  {part && (
                    <button
                      type="button"
                      disabled={backpackParts.length >= SHIP_PART_STORAGE_CAPACITY}
                      title={backpackParts.length >= SHIP_PART_STORAGE_CAPACITY ? text.full : undefined}
                      onClick={() => onUnequip(slot)}
                    >
                      {text.remove}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
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
