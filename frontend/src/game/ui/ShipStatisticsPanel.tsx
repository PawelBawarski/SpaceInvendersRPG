import { formatNumber, gameText, type GameLanguage } from '../i18n'
import { lazy, Suspense, useState } from 'react'
import type { ShipTelemetry } from '../domain/shipTelemetry'
import { getShipStatistics } from '../progress/shipStatistics'
import type { MissionProgress } from '../progress/missionProgress'
import type { GraphicsQuality } from '../progress/gameSettings'
import { SHIP_PART_SLOTS } from '../progress/shipParts'
import { PartArtwork } from './EquipmentArtwork'
import { ShipResistanceReadout } from './ShipResistanceReadout'
import { getShipPartRarityLabel, getShipPartSlotLabel, getShipPartStatSummary } from './shipPartPresentation'
import { PilotTraining } from './PilotTraining'
import { IconButton } from './ActionIcon'
import type { PilotSkillId } from '../progress/pilotSkills'
import { BASE_RADAR_RANGE } from '../domain/flightRadar'
import './ShipStatisticsPanel.css'

const ShipPreviewCanvas = lazy(() => import('../renderer/ShipPreviewCanvas').then(module => ({ default: module.ShipPreviewCanvas })))

interface ShipStatisticsPanelProps {
  progress: MissionProgress
  telemetry: ShipTelemetry | null
  language: GameLanguage
  quality: GraphicsQuality
  onClose: () => void
  onLearn: (skill: PilotSkillId) => void
  onOpenInventory?: () => void
}

export function ShipStatisticsPanel({ progress, telemetry, language, quality, onClose, onLearn, onOpenInventory }: ShipStatisticsPanelProps) {
  const [view, setView] = useState<'stats' | 'training'>('stats')
  const stats = getShipStatistics(progress, telemetry)
  const number = (value: number, digits = 0) => formatNumber(value, language, digits)
  const rows = [
    [gameText(language).statistics.hullHp, `${number(stats.hull)} / ${number(stats.maximumHull)}`],
    [gameText(language).statistics.shields, `${number(stats.shield)} / ${number(stats.maximumShield)}`],
    [gameText(language).statistics.damagePerProjectile, `${stats.weapon.minimum}–${stats.weapon.maximum}`],
    [gameText(language).statistics.projectilesPerVolley, String(stats.weapon.projectilesPerVolley)],
    [gameText(language).statistics.theoreticalDps, number(stats.weapon.expectedDps, 1)],
    [gameText(language).statistics.criticalChance, `${stats.weapon.criticalChance * 100}% · ×${stats.weapon.criticalMultiplier}`],
    [gameText(language).statistics.firingInterval, `${number(stats.weapon.fireCooldown, 2)} s`],
    [gameText(language).statistics.projectileSpeed, `${number(stats.weapon.projectileSpeed)} m/s`],
    [gameText(language).statistics.cruiseSpeed, `${number(stats.maximumSpeed)} m/s`],
    [gameText(language).statistics.halfThrustShift, `${number(stats.halfSpeed)} m/s`],
    [gameText(language).statistics.currentSpeed, `${number(stats.speed)} m/s`],
    [gameText(language).statistics.dodgeRecharge, `${number(stats.dodgeRemaining, 2)} / ${number(stats.dodgeCooldown, 2)} s`],
    [gameText(language).statistics.handling, `${number(100 + (stats.bonuses.handlingPercent ?? 0))}%`],
    [gameText(language).statistics.radarRange, `${number(BASE_RADAR_RANGE * (1 + (stats.bonuses.sensorRangePercent ?? 0) / 100))} m`],
  ]
  return <div className="ship-stats-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="ship-stats-panel" role="dialog" aria-modal="true" aria-labelledby="ship-stats-title">
      <header className="ship-stats-header">
        <div><p className="eyebrow">{gameText(language).common.shipName} / {gameText(language).statistics.shipSystems}</p><h2 id="ship-stats-title">{gameText(language).statistics.shipStatistics}</h2></div>
        <span className="ship-stats-level">{gameText(language).statistics.pilotLevel} <strong>{stats.level}</strong></span>
        <IconButton icon="close" className="ship-stats-close" onClick={onClose} autoFocus label={gameText(language).statistics.closeShipStatistics} />
      </header>
      <nav className="ship-sheet-tabs" aria-label={gameText(language).statistics.shipViews}>
        <button type="button" aria-pressed={view === 'stats'} onClick={() => setView('stats')}>{gameText(language).statistics.shipStats}</button>
        <button type="button" aria-pressed={view === 'training'} onClick={() => setView('training')}>{gameText(language).statistics.pilotTraining}</button>
        {onOpenInventory && <IconButton icon="inventory" label={gameText(language).statistics.inventory} onClick={onOpenInventory} />}
      </nav>
      {view === 'training' ? <PilotTraining level={stats.level} learned={progress.pilotSkills} language={language} onLearn={onLearn}/>
        : <div className="ship-stats-body">
        <section className="ship-stats-numbers" aria-label={gameText(language).statistics.shipParameters}>
          <h3>{gameText(language).statistics.flightAndCombat}</h3>
          <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className="ship-stats-note">{gameText(language).statistics.dpsIncludesCriticalHitsAndBoth}</p>
        </section>
        <section className="ship-stats-model" aria-label={gameText(language).statistics.yourShip}>
          <div className="ship-stats-model-grid" aria-hidden="true" />
          <Suspense fallback={<div className="ship-stats-loading" role="status">{gameText(language).statistics.preparingShipPreview}</div>}>
            <ShipPreviewCanvas rarities={stats.rarities} quality={quality} label={gameText(language).statistics.shipPreview} hullFraction={stats.hull / stats.maximumHull} />
          </Suspense>
          <div className="ship-stats-model-caption"><strong>{gameText(language).common.shipName}</strong><span>{gameText(language).statistics.currentLoadout}</span></div>
        </section>
        <section className="ship-stats-loadout" aria-label={gameText(language).statistics.equipmentAndResistances}>
          <ShipResistanceReadout resistances={stats.resistances} language={language} collapsible={false} />
          <h3>{gameText(language).statistics.installedModules}</h3>
          {SHIP_PART_SLOTS.map(slot => {
            const part = progress.shipParts.find(item => item.id === progress.equippedParts[slot] && item.slot === slot)
            return <article key={slot} className={`ship-stats-module${part ? ` rarity-${part.rarity}` : ''}`} data-tooltip={part ? getShipPartStatSummary(part, language) : undefined}>
              <PartArtwork slot={slot} rarity={part?.rarity ?? 'standard'} />
              <div><strong>{getShipPartSlotLabel(language, slot)}</strong><span>{part ? getShipPartRarityLabel(language, part.rarity) : (gameText(language).statistics.factoryEquipment)}</span>
                {part && <small>{getShipPartStatSummary(part, language)}</small>}</div>
            </article>
          })}
        </section>
      </div>}
    </section>
  </div>
}
