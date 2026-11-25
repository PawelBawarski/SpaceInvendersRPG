import { useState } from 'react'
import { FACTIONS, MERCHANT_COURSE_ID, ORION_SECTOR_ID, distanceBetween, type GalaxyWorld } from '../domain/exploration'
import { isMissionComplete, MISSIONS, type MissionId } from '../missions/definitions'
import type { MissionProgress } from '../progress/missionProgress'
import { SectorChart } from './SectorChart'
import './NavigationJournal.css'

interface Props {
  language: 'pl' | 'en'
  progress: MissionProgress
  world: GalaxyWorld
  activeMission: MissionId | null
  trackedStationId: string | null
  onClose: () => void
  onTrackMission: (id: MissionId) => void
  onTrackStation: (id: string) => void
  onBoundaryCourse?: () => void
}

const distanceLabel = (distance: number) => distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`

export function NavigationJournal({ language, progress, world, activeMission, trackedStationId, onClose, onTrackMission, onTrackStation, onBoundaryCourse }: Props) {
  const pl = language === 'pl'
  const [pane, setPane] = useState<'map' | 'missions' | 'ports'>('map')
  const position = { x: progress.sectorX, y: progress.sectorY, z: progress.sectorDistance }
  const missions = world.galaxy.id === ORION_SECTOR_ID ? MISSIONS : []
  const remaining = missions.filter(mission => !isMissionComplete(progress, mission.id)).length
  const target = trackedStationId === MERCHANT_COURSE_ID ? world.merchant
    : trackedStationId ? world.stations.find(station => station.id === trackedStationId) : missions.find(mission => mission.id === activeMission)
  const targetPosition = target && ('worldPosition' in target ? target.worldPosition : target)
  const targetName = target && ('title' in target ? target.title[language] : target.name[language])
  const surveyCount = world.planets.filter(planet => progress.visitedPlanets.includes(planet.id)).length
  const heading = pl ? 'Dziennik nawigacyjny' : 'Navigation journal'
  const tabs = [['map', pl ? 'Mapa' : 'Map'], ['missions', pl ? 'Misje' : 'Missions'], ['ports', pl ? 'Hangary' : 'Hangars']] as const

  return <main className="navigation-journal" aria-label={heading}>
    <header className="journal-header">
      <div><p className="journal-eyebrow">{pl ? 'GALAKTYKA' : 'GALAXY'} · {world.galaxy.name}</p><h1>{heading}</h1></div>
      <button type="button" className="journal-close" onClick={onClose} autoFocus aria-label={pl ? 'Zamknij dziennik' : 'Close journal'}>×</button>
    </header>
    <nav className="journal-tabs" aria-label={pl ? 'Widoki dziennika' : 'Journal views'}>
      {tabs.map(([id, label]) => <button type="button" key={id} aria-pressed={pane === id} onClick={() => setPane(id)}>{label}</button>)}
    </nav>
    <div className="journal-layout" data-pane={pane}>
      <section className="journal-atlas" aria-labelledby="sector-chart-title">
        <div className="journal-section-title">
          <h2 id="sector-chart-title">{pl ? 'Kartografia sektora' : 'Sector cartography'}</h2>
          <span>{surveyCount} / {world.planets.length} {pl ? 'zbadanych' : 'surveyed'}</span>
        </div>
        <SectorChart world={world} position={position} target={targetPosition} language={language} />
        <div className="journal-course-readout">
          <div><span>{pl ? 'Aktualny kurs' : 'Current course'}</span><strong>{targetName ?? (pl ? 'Swobodny lot' : 'Free flight')}</strong></div>
          {targetPosition && <small>{distanceLabel(distanceBetween(position, targetPosition))}</small>}
        </div>
        {onBoundaryCourse && <button type="button" className="journal-boundary-action" onClick={onBoundaryCourse}>{pl ? 'Kurs do granicy galaktyki' : 'Course to galaxy boundary'} <span aria-hidden="true">↗</span></button>}
      </section>
      <section className="journal-harbours" aria-labelledby="journal-ports-title">
        <div className="journal-section-title">
          <h2 id="journal-ports-title">{pl ? 'Hangary i porty' : 'Hangars and ports'}</h2><span>{world.stations.length}</span>
        </div>
        <div className="world-mission-grid world-station-grid journal-scroll" tabIndex={0} aria-labelledby="journal-ports-title">
          <article className={`world-mission journal-station${trackedStationId === MERCHANT_COURSE_ID ? ' is-tracked' : ''}`}>
            <span className="journal-station-icon" aria-hidden="true">◇</span>
            <div><h3>{world.merchant.name[language]}</h3><small>{pl ? 'Kupiec' : 'Merchant'} · {distanceLabel(distanceBetween(position, world.merchant))}</small></div>
            <button type="button" onClick={() => onTrackStation(MERCHANT_COURSE_ID)}
              aria-label={`${pl ? 'Wyznacz kurs' : 'Set course'}: ${world.merchant.name[language]}`}>{trackedStationId === MERCHANT_COURSE_ID ? '◆' : '↗'}</button>
          </article>
          {world.stations.toSorted((a, b) => distanceBetween(position, a) - distanceBetween(position, b)).map(station =>
            <article className={`world-mission journal-station${trackedStationId === station.id ? ' is-tracked' : ''}`} key={station.id}>
              <span className="journal-station-icon" aria-hidden="true">⌂</span>
              <div><h3>{station.name[language]}</h3><small>{distanceLabel(distanceBetween(position, station))}</small></div>
              <button type="button" onClick={() => onTrackStation(station.id)} aria-label={`${pl ? 'Wyznacz kurs' : 'Set course'}: ${station.name[language]}`}>{trackedStationId === station.id ? '◆' : '↗'}</button>
            </article>)}
        </div>
      </section>
      <section className="journal-signals" aria-labelledby="journal-signals-title">
        <div className="journal-section-title">
          <h2 id="journal-signals-title">{pl ? 'Sygnały w pustce' : 'Signals in the void'}</h2>
          <span>{remaining} {pl ? 'aktywnych' : 'active'}</span>
        </div>
        <div className="world-mission-grid journal-missions journal-scroll" tabIndex={0} aria-labelledby="journal-signals-title">
          {missions.length === 0 && <p className="journal-empty">{pl ? 'Kontrakty kampanii czekają w Orionie–7.' : 'Campaign contracts are available in Orion–7.'}</p>}
          {missions.map(mission => {
            const done = isMissionComplete(progress, mission.id)
            const tracked = !trackedStationId && activeMission === mission.id
            return <article key={mission.id} style={{ borderInlineStartColor: FACTIONS[mission.faction].accent }}
              className={`world-mission journal-mission${done ? ' complete' : ''}${tracked ? ' is-tracked' : ''}`}>
              <div className="journal-mission-body">
                <div className="journal-mission-tags">
                  <span>{mission.bossProfile ? 'Boss' : mission.objective === 'orbital-sweep' ? (pl ? 'Orbita' : 'Orbit') : (pl ? 'Kontrakt' : 'Contract')}</span>
                  <small>{distanceLabel(distanceBetween(position, mission.worldPosition))}</small>
                </div>
                <h3>{mission.title[language]}</h3><p>{mission.briefing[language]}</p>
                <footer><small>{FACTIONS[mission.faction].name[language]}</small><span>{mission.reward.credits} KS{mission.bossProfile ? ` + ${pl ? 'moduł' : 'module'}` : ''}</span></footer>
              </div>
              <button type="button" className="journal-track" disabled={done || tracked} onClick={() => onTrackMission(mission.id)} aria-label={`${pl ? 'Śledź sygnał' : 'Track signal'}: ${mission.title[language]}`}>
                <span aria-hidden="true">{done ? '✓' : tracked ? '◆' : '↗'}</span><small>{done ? (pl ? 'Ukończono' : 'Complete') : tracked ? (pl ? 'Wybrany' : 'Tracked') : (pl ? 'Śledź' : 'Track')}</small>
              </button>
            </article>
          })}
        </div>
      </section>
    </div>
  </main>
}
