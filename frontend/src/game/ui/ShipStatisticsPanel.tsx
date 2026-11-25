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
import type { PilotSkillId } from '../progress/pilotSkills'
import { BASE_RADAR_RANGE } from '../domain/flightRadar'
import './ShipStatisticsPanel.css'

const ShipPreviewCanvas = lazy(() => import('../renderer/ShipPreviewCanvas').then(module => ({ default: module.ShipPreviewCanvas })))

interface ShipStatisticsPanelProps {
  progress: MissionProgress
  telemetry: ShipTelemetry | null
  language: 'pl' | 'en'
  quality: GraphicsQuality
  onClose: () => void
  onLearn: (skill: PilotSkillId) => void
  onOpenInventory?: () => void
}

export function ShipStatisticsPanel({ progress, telemetry, language, quality, onClose, onLearn, onOpenInventory }: ShipStatisticsPanelProps) {
  const [view, setView] = useState<'stats' | 'training'>('stats')
  const pl = language === 'pl'
  const stats = getShipStatistics(progress, telemetry)
  const number = (value: number, digits = 0) => value.toLocaleString(language, { maximumFractionDigits: digits })
  const rows = [
    [pl ? 'Kadłub / HP' : 'Hull / HP', `${number(stats.hull)} / ${number(stats.maximumHull)}`],
    [pl ? 'Osłony' : 'Shields', `${number(stats.shield)} / ${number(stats.maximumShield)}`],
    [pl ? 'Obrażenia pocisku' : 'Damage per projectile', `${stats.weapon.minimum}–${stats.weapon.maximum}`],
    [pl ? 'Pociski w salwie' : 'Projectiles per volley', String(stats.weapon.projectilesPerVolley)],
    [pl ? 'Teoretyczny DPS' : 'Theoretical DPS', number(stats.weapon.expectedDps, 1)],
    [pl ? 'Szansa krytyczna' : 'Critical chance', `${stats.weapon.criticalChance * 100}% · ×${stats.weapon.criticalMultiplier}`],
    [pl ? 'Odstęp salw' : 'Firing interval', `${number(stats.weapon.fireCooldown, 2)} s`],
    [pl ? 'Prędkość pocisków' : 'Projectile speed', `${number(stats.weapon.projectileSpeed)} m/s`],
    [pl ? 'Prędkość przelotowa' : 'Cruise speed', `${number(stats.maximumSpeed)} m/s`],
    [pl ? 'Połowa mocy / Shift' : 'Half thrust / Shift', `${number(stats.halfSpeed)} m/s`],
    [pl ? 'Aktualna prędkość' : 'Current speed', `${number(stats.speed)} m/s`],
    [pl ? 'Ładowanie uniku' : 'Dodge recharge', `${number(stats.dodgeRemaining, 2)} / ${number(stats.dodgeCooldown, 2)} s`],
    [pl ? 'Zwrotność' : 'Handling', `${number(100 + (stats.bonuses.handlingPercent ?? 0))}%`],
    [pl ? 'Zasięg radaru' : 'Radar range', `${number(BASE_RADAR_RANGE * (1 + (stats.bonuses.sensorRangePercent ?? 0) / 100))} m`],
  ]
  return <div className="ship-stats-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="ship-stats-panel" role="dialog" aria-modal="true" aria-labelledby="ship-stats-title">
      <header className="ship-stats-header">
        <div><p className="eyebrow">VANTA / {pl ? 'SYSTEMY POKŁADOWE' : 'SHIP SYSTEMS'}</p><h2 id="ship-stats-title">{pl ? 'Statystyki statku' : 'Ship statistics'}</h2></div>
        <span className="ship-stats-level">{pl ? 'POZIOM PILOTA' : 'PILOT LEVEL'} <strong>{stats.level}</strong></span>
        <button type="button" className="ship-stats-close" onClick={onClose} autoFocus aria-label={pl ? 'Zamknij statystyki statku' : 'Close ship statistics'} title="C / Esc">×</button>
      </header>
      <nav className="ship-sheet-tabs" aria-label={pl ? 'Widoki pokładu' : 'Ship views'}>
        <button type="button" aria-pressed={view === 'stats'} onClick={() => setView('stats')}>{pl ? 'Parametry' : 'Ship stats'}</button>
        <button type="button" aria-pressed={view === 'training'} onClick={() => setView('training')}>{pl ? 'Rozwój pilota' : 'Pilot training'}</button>
        {onOpenInventory && <button type="button" onClick={onOpenInventory}>{pl ? 'Ekwipunek' : 'Inventory'} <kbd>I</kbd></button>}
      </nav>
      {view === 'training' ? <PilotTraining level={stats.level} learned={progress.pilotSkills} language={language} onLearn={onLearn}/>
        : <div className="ship-stats-body">
        <section className="ship-stats-numbers" aria-label={pl ? 'Parametry statku' : 'Ship parameters'}>
          <h3>{pl ? 'PARAMETRY LOTU I WALKI' : 'FLIGHT AND COMBAT'}</h3>
          <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className="ship-stats-note">{pl ? 'DPS uwzględnia krytyki i dwie lufy, przed pancerzem celu. Shift utrzymuje połowę mocy, spacja pełną; otoczenie nie zmienia prędkości docelowej.' : 'DPS includes critical hits and both cannons, before target armor. Shift maintains half thrust, Space full thrust; surroundings do not change the target speed.'}</p>
        </section>
        <section className="ship-stats-model" aria-label={pl ? 'Twój statek' : 'Your ship'}>
          <div className="ship-stats-model-grid" aria-hidden="true" />
          <Suspense fallback={<div className="ship-stats-loading" role="status">{pl ? 'Przygotowywanie podglądu…' : 'Preparing ship preview…'}</div>}>
            <ShipPreviewCanvas rarities={stats.rarities} quality={quality} />
          </Suspense>
          <div className="ship-stats-model-caption"><strong>VANTA</strong><span>{pl ? 'AKTUALNE WYPOSAŻENIE' : 'CURRENT LOADOUT'}</span></div>
        </section>
        <section className="ship-stats-loadout" aria-label={pl ? 'Wyposażenie i odporności' : 'Equipment and resistances'}>
          <ShipResistanceReadout resistances={stats.resistances} language={language} collapsible={false} />
          <h3>{pl ? 'ZAMONTOWANE MODUŁY' : 'INSTALLED MODULES'}</h3>
          {SHIP_PART_SLOTS.map(slot => {
            const part = progress.shipParts.find(item => item.id === progress.equippedParts[slot] && item.slot === slot)
            return <article key={slot} className={`ship-stats-module${part ? ` rarity-${part.rarity}` : ''}`} title={part ? getShipPartStatSummary(part, language) : undefined}>
              <PartArtwork slot={slot} rarity={part?.rarity ?? 'standard'} />
              <div><strong>{getShipPartSlotLabel(language, slot)}</strong><span>{part ? getShipPartRarityLabel(language, part.rarity) : (pl ? 'Wyposażenie fabryczne' : 'Factory equipment')}</span>
                {part && <small>{getShipPartStatSummary(part, language)}</small>}</div>
            </article>
          })}
        </section>
      </div>}
      <footer className="ship-stats-footer">{pl ? 'C / ESC · ZAMKNIJ' : 'C / ESC · CLOSE'}</footer>
    </section>
  </div>
}
