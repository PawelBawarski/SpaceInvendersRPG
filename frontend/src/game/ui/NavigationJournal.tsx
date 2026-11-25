import { FACTIONS, ORION_DRONES, ORION_PLANETS, ORION_SECTOR_BOUNDS, ORION_STATIONS, ORION_SUN, distanceBetween } from '../domain/exploration'
import { isMissionComplete, MISSIONS, type MissionId } from '../missions/definitions'
import type { MissionProgress } from '../progress/missionProgress'
import './NavigationJournal.css'

interface Props {
  language: 'pl' | 'en'
  progress: MissionProgress
  activeMission: MissionId | null
  trackedStationId: string | null
  onClose: () => void
  onTrackMission: (id: MissionId) => void
  onTrackStation: (id: string) => void
}

const distanceLabel = (distance: number) => distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`
const project = (x: number, z: number) => ({ x: 24 + (x - ORION_SECTOR_BOUNDS.minX) / (ORION_SECTOR_BOUNDS.maxX - ORION_SECTOR_BOUNDS.minX) * 352, y: 252 - z / ORION_SECTOR_BOUNDS.maxZ * 220 })

export function NavigationJournal({ language, progress, activeMission, trackedStationId, onClose, onTrackMission, onTrackStation }: Props) {
  const pl = language === 'pl'
  const position = { x: progress.sectorX, y: progress.sectorY, z: progress.sectorDistance }
  const completed = MISSIONS.filter(mission => isMissionComplete(progress, mission.id)).length
  const target = trackedStationId ? ORION_STATIONS.find(station => station.id === trackedStationId) : MISSIONS.find(mission => mission.id === activeMission)
  const targetPosition = target && ('worldPosition' in target ? target.worldPosition : target)
  const targetName = target && ('title' in target ? target.title[language] : target.name[language])
  const pilotPoint = project(position.x, position.z)
  const targetPoint = targetPosition ? project(targetPosition.x, targetPosition.z) : null
  const sun = project(ORION_SUN.x, ORION_SUN.z)
  return <main className="navigation-journal" aria-label={pl ? 'Dziennik nawigacyjny' : 'Navigation journal'}>
    <header className="journal-header">
      <div><p className="journal-eyebrow">VANTA · ORION–7 / {pl ? 'POŁĄCZENIE AKTYWNE' : 'LINK ESTABLISHED'}</p>
        <h1>{pl ? 'Dziennik nawigacyjny' : 'Navigation journal'}</h1>
        <p>{pl ? 'Sygnały w ciemności. Obierz kurs w głąb Meridian.' : 'Signals in the dark. Chart your course into Meridian.'}</p>
      </div>
      <div className="journal-close-group"><kbd>L</kbd><button type="button" className="journal-close" onClick={onClose} autoFocus aria-label={pl ? 'Zamknij dziennik' : 'Close journal'}>×</button></div>
    </header>
    <div className="journal-layout">
      <aside className="journal-atlas">
        <div className="journal-section-title"><span>{pl ? 'KARTOGRAFIA SEKTORA' : 'SECTOR CARTOGRAPHY'}</span><small>01 / ORION–7</small></div>
        <div className="journal-star-chart">
          <svg viewBox="0 0 400 285" role="img" aria-label={pl ? 'Mapa planet, słońca i wybranego celu' : 'Map of planets, sun and destination'}>
            <defs><radialGradient id="journal-map-glow"><stop stopColor="#63d9ff" stopOpacity=".16"/><stop offset="1" stopColor="#10203b" stopOpacity="0"/></radialGradient></defs>
            <circle cx="200" cy="143" r="137" fill="url(#journal-map-glow)"/>
            {[40, 80, 120].map(radius => <circle key={radius} cx="200" cy="143" r={radius} className="chart-orbit"/>)}
            <path d="M24 143H376M200 20V264M74 60L326 226M74 226L326 60" className="chart-grid"/>
            {ORION_PLANETS.map(planet => { const point = project(planet.x, planet.z); return <circle key={planet.id} cx={point.x} cy={point.y} r={Math.max(1.7, Math.min(5, Math.sqrt(planet.radius) / 35))} fill={planet.color} opacity=".8"><title>{planet.name[language]}</title></circle> })}
            <circle cx={sun.x} cy={sun.y} r="12" fill="#ffb44b" opacity=".09"/><circle cx={sun.x} cy={sun.y} r="5" fill="#ffd48b"><title>{ORION_SUN.name[language]}</title></circle>
            {targetPoint && <><path d={`M${pilotPoint.x} ${pilotPoint.y}L${targetPoint.x} ${targetPoint.y}`} className="chart-course"/><circle cx={targetPoint.x} cy={targetPoint.y} r="6" className="chart-target"/></>}
            <path d={`M${pilotPoint.x} ${pilotPoint.y - 5}l-4 9 4-2 4 2z`} fill="#a9f4ff"/>
            <text x="25" y="22">MERIDIAN DEEP SPACE</text><text x="25" y="277">{pl ? 'RZUT X / Z · 3000 KM' : 'X / Z PROJECTION · 3000 KM'}</text>
          </svg>
          <span className="journal-chart-caption"><i/> {pl ? 'Skan dalekiego zasięgu' : 'Long-range scan'}</span>
        </div>
        <div className="journal-course-readout"><span>{pl ? 'AKTUALNY KURS' : 'CURRENT COURSE'}</span><strong>{targetName ?? (pl ? 'Swobodny lot' : 'Free flight')}</strong><small>{targetPosition ? distanceLabel(distanceBetween(position, targetPosition)) : '—'} · {pl ? 'lot ręczny' : 'manual flight'}</small></div>
        <dl className="journal-summary">
          <div><dt>{pl ? 'KONTRAKTY' : 'CONTRACTS'}</dt><dd>{completed}<small> / {MISSIONS.length}</small></dd></div>
          <div><dt>{pl ? 'ODKRYTE ŚWIATY' : 'SURVEYED WORLDS'}</dt><dd>{progress.visitedPlanets.length}<small> / {ORION_PLANETS.length}</small></dd></div>
          <div><dt>{pl ? 'ŚLADY JEDNOSTEK' : 'FLEET SIGNATURES'}</dt><dd>{ORION_DRONES.length.toLocaleString(language)}</dd></div>
        </dl>
        <section className="journal-harbours"><div className="journal-section-title"><span>{pl ? 'STACJE ORBITALNE' : 'ORBITAL STATIONS'}</span><small>03</small></div>
          <div className="world-mission-grid world-station-grid">
            {ORION_STATIONS.map(station => <article className={`world-mission journal-station${trackedStationId === station.id ? ' is-tracked' : ''}`} key={station.id}>
              <span className="journal-station-icon" aria-hidden="true">⌂</span><div><h2>{station.name[language]}</h2><small>{distanceLabel(distanceBetween(position, station))} · {pl ? 'hangar / serwis' : 'hangar / services'}</small></div>
              <button type="button" onClick={() => onTrackStation(station.id)} aria-label={`${pl ? 'Wyznacz kurs' : 'Set course'}: ${station.name[language]}`}>{trackedStationId === station.id ? '◆' : '↗'}<span className="journal-sr-only">{pl ? 'Wyznacz kurs' : 'Set course'}</span></button>
            </article>)}
          </div>
        </section>
      </aside>
      <section className="journal-signals">
        <div className="journal-signals-heading"><div><p className="journal-eyebrow">{pl ? 'ARCHIWUM TRANSMISJI' : 'TRANSMISSION ARCHIVE'}</p><h2>{pl ? 'Sygnały w pustce' : 'Signals in the void'}</h2></div><span>{MISSIONS.length - completed} {pl ? 'AKTYWNYCH' : 'ACTIVE'}</span></div>
        <div className="world-mission-grid journal-missions">
          {MISSIONS.map((mission, index) => {
            const done = isMissionComplete(progress, mission.id)
            const tracked = !trackedStationId && activeMission === mission.id
            return <article key={mission.id} className={`world-mission journal-mission${done ? ' complete' : ''}${tracked ? ' is-tracked' : ''}`}>
              <div className="journal-mission-code"><span>{String(index + 1).padStart(2, '0')}</span><i style={{ background: FACTIONS[mission.faction].accent }}/></div>
              <div className="journal-mission-body"><div className="journal-mission-tags"><span>{mission.bossProfile ? 'BOSS' : mission.objective === 'orbital-sweep' ? (pl ? 'ORBITA' : 'ORBIT') : (pl ? 'KONTRAKT' : 'CONTRACT')}</span><small>{distanceLabel(distanceBetween(position, mission.worldPosition))}</small></div>
                <h3>{mission.title[language]}</h3><p>{mission.briefing[language]}</p><footer><small>{FACTIONS[mission.faction].name[language]}</small><span>{mission.reward.credits} KS{mission.bossProfile ? ` + ${pl ? 'MODUŁ' : 'MODULE'}` : ''}</span></footer>
              </div>
              <button type="button" className="journal-track" disabled={done || tracked} onClick={() => onTrackMission(mission.id)} aria-label={`${pl ? 'Śledź sygnał' : 'Track signal'}: ${mission.title[language]}`}>
                <span aria-hidden="true">{done ? '✓' : tracked ? '◆' : '↗'}</span><small>{done ? (pl ? 'UKOŃCZONO' : 'COMPLETE') : tracked ? (pl ? 'WYBRANY' : 'TRACKED') : (pl ? 'ŚLEDŹ SYGNAŁ' : 'TRACK SIGNAL')}</small>
              </button>
            </article>
          })}
        </div>
      </section>
    </div>
  </main>
}
