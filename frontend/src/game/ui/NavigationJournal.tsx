import { formatText, gameText, type GameLanguage } from '../i18n'
import { useState } from 'react'
import { FACTIONS, MERCHANT_COURSE_ID, ORION_SECTOR_ID, distanceBetween, type GalaxyWorld } from '../domain/exploration'
import { CAMPAIGN_MISSION_ORDER, getMissionPrerequisite, isCampaignComplete, isMissionComplete, isMissionUnlocked, MISSIONS, type CampaignEndingId, type MissionId } from '../missions/definitions'
import type { MissionProgress } from '../progress/missionProgress'
import { SectorChart } from './SectorChart'
import { IconButton } from './ActionIcon'
import '../../styles/ui/NavigationJournal.scss'

interface Props {
  language: GameLanguage
  progress: MissionProgress
  world: GalaxyWorld
  activeMission: MissionId | null
  trackedStationId: string | null
  onClose: () => void
  onTrackMission: (id: MissionId) => void
  onTrackStation: (id: string) => void
  onChooseEnding: (ending: CampaignEndingId) => void
  onBoundaryCourse?: () => void
}

const distanceLabel = (distance: number) => distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`
type ChapterCopy = ReturnType<typeof gameText>['application']['copy']

const CHAPTER_COPY: readonly ((copy: ChapterCopy) => { eyebrow: string; title: string; story: string; objective: string })[] = [
  copy => ({ eyebrow: copy.journal, title: copy.firstTitle, story: copy.firstStory, objective: copy.firstObjective }),
  copy => ({ eyebrow: copy.chapterTwo, title: copy.secondTitle, story: copy.secondStory, objective: copy.secondObjective }),
  copy => ({ eyebrow: copy.chapterThree, title: copy.thirdTitle, story: copy.thirdStory, objective: copy.thirdObjective }),
  copy => ({ eyebrow: copy.chapterFour, title: copy.fourthTitle, story: copy.fourthStory, objective: copy.fourthObjective }),
  copy => ({ eyebrow: copy.chapterFive, title: copy.fifthTitle, story: copy.fifthStory, objective: copy.fifthObjective }),
  copy => ({ eyebrow: copy.chapterSix, title: copy.sixthTitle, story: copy.sixthStory, objective: copy.sixthObjective }),
  copy => ({ eyebrow: copy.chapterSeven, title: copy.seventhTitle, story: copy.seventhStory, objective: copy.seventhObjective }),
  copy => ({ eyebrow: copy.chapterEight, title: copy.eighthTitle, story: copy.eighthStory, objective: copy.eighthObjective }),
  copy => ({ eyebrow: copy.chapterNine, title: copy.ninthTitle, story: copy.ninthStory, objective: copy.ninthObjective }),
  copy => ({ eyebrow: copy.chapterTen, title: copy.tenthTitle, story: copy.tenthStory, objective: copy.tenthObjective }),
  copy => ({ eyebrow: copy.chapterEleven, title: copy.eleventhTitle, story: copy.eleventhStory, objective: copy.eleventhObjective }),
  copy => ({ eyebrow: copy.chapterTwelve, title: copy.twelfthTitle, story: copy.twelfthStory, objective: copy.twelfthObjective }),
]

export function NavigationJournal({ language, progress, world, activeMission, trackedStationId, onClose, onTrackMission, onTrackStation, onChooseEnding, onBoundaryCourse }: Props) {
  const [pane, setPane] = useState<'map' | 'missions' | 'ports'>('map')
  const position = { x: progress.sectorX, y: progress.sectorY, z: progress.sectorDistance }
  const missions = world.galaxy.id === ORION_SECTOR_ID ? MISSIONS : []
  const remaining = missions.filter(mission => isMissionUnlocked(progress, mission.id) && !isMissionComplete(progress, mission.id)).length
  const copy = gameText(language).application.copy
  const chapterIndex = activeMission ? CAMPAIGN_MISSION_ORDER.indexOf(activeMission) : -1
  const chapter = chapterIndex >= 0 ? CHAPTER_COPY[chapterIndex](copy) : null
  const campaignComplete = world.galaxy.id === ORION_SECTOR_ID && isCampaignComplete(progress)
  const ending = progress.campaignEnding === 'rebuild'
    ? { title: copy.endingRebuildTitle, story: copy.endingRebuildStory }
    : progress.campaignEnding === 'seal' ? { title: copy.endingSealTitle, story: copy.endingSealStory }
      : progress.campaignEnding === 'command' ? { title: copy.endingCommandTitle, story: copy.endingCommandStory } : null
  const target = trackedStationId === MERCHANT_COURSE_ID ? world.merchant
    : trackedStationId ? world.stations.find(station => station.id === trackedStationId) : missions.find(mission => mission.id === activeMission)
  const targetPosition = target && ('worldPosition' in target ? target.worldPosition : target)
  const targetName = target && ('title' in target ? target.title[language] : target.name[language])
  const surveyCount = world.planets.filter(planet => progress.visitedPlanets.includes(planet.id)).length
  const heading = gameText(language).journal.navigationJournal
  const tabs = [['map', gameText(language).journal.map], ['missions', gameText(language).journal.missions], ['ports', gameText(language).journal.hangars]] as const

  return <main className="navigation-journal" aria-label={heading}>
    <header className="journal-header">
      <div><p className="journal-eyebrow">{gameText(language).journal.galaxy} · {world.galaxy.name}</p><h1>{heading}</h1></div>
      <IconButton icon="close" className="journal-close" onClick={onClose} autoFocus label={gameText(language).journal.closeJournal} />
    </header>
    <nav className="journal-tabs" aria-label={gameText(language).journal.journalViews}>
      {tabs.map(([id, label]) => <button type="button" key={id} aria-pressed={pane === id} onClick={() => setPane(id)}>{label}</button>)}
    </nav>
    <div className="journal-layout" data-pane={pane}>
      <section className="journal-atlas" aria-labelledby="sector-chart-title">
        <div className="journal-section-title">
          <h2 id="sector-chart-title">{gameText(language).journal.sectorCartography}</h2>
          <span>{surveyCount} / {world.planets.length} {gameText(language).journal.surveyed}</span>
        </div>
        <SectorChart world={world} position={position} target={targetPosition} language={language} />
        <div className="journal-course-readout">
          <div><span>{gameText(language).journal.currentCourse}</span><strong>{targetName ?? (gameText(language).journal.freeFlight)}</strong></div>
          {targetPosition && <small>{distanceLabel(distanceBetween(position, targetPosition))}</small>}
        </div>
        {onBoundaryCourse && <button type="button" className="journal-boundary-action" onClick={onBoundaryCourse}>{gameText(language).journal.courseToGalaxyBoundary} <span aria-hidden="true">↗</span></button>}
      </section>
      <section className="journal-harbours" aria-labelledby="journal-ports-title">
        <div className="journal-section-title">
          <h2 id="journal-ports-title">{gameText(language).journal.hangarsAndPorts}</h2><span>{world.stations.length}</span>
        </div>
        <div className="world-mission-grid world-station-grid journal-scroll" tabIndex={0} aria-labelledby="journal-ports-title">
          <article className={`world-mission journal-station${trackedStationId === MERCHANT_COURSE_ID ? ' is-tracked' : ''}`}>
            <span className="journal-station-icon" aria-hidden="true">◇</span>
            <div><h3>{world.merchant.name[language]}</h3><small>{gameText(language).journal.merchant} · {distanceLabel(distanceBetween(position, world.merchant))}</small></div>
            <button type="button" disabled={progress.initialRepairRequired} onClick={() => onTrackStation(MERCHANT_COURSE_ID)}
              aria-label={`${gameText(language).journal.setCourse}: ${world.merchant.name[language]}`}>{trackedStationId === MERCHANT_COURSE_ID ? '◆' : '↗'}</button>
          </article>
          {world.stations.toSorted((a, b) => distanceBetween(position, a) - distanceBetween(position, b)).map(station =>
            <article className={`world-mission journal-station${trackedStationId === station.id ? ' is-tracked' : ''}`} key={station.id}>
              <span className="journal-station-icon" aria-hidden="true">⌂</span>
              <div><h3>{station.name[language]}</h3><small>{distanceLabel(distanceBetween(position, station))}</small></div>
              <button type="button" disabled={progress.initialRepairRequired} onClick={() => onTrackStation(station.id)} aria-label={`${gameText(language).journal.setCourse}: ${station.name[language]}`}>{trackedStationId === station.id ? '◆' : '↗'}</button>
            </article>)}
        </div>
      </section>
      <section className="journal-signals" aria-labelledby="journal-signals-title">
        <div className="journal-section-title">
          <h2 id="journal-signals-title">{gameText(language).journal.signalsInTheVoid}</h2>
          <span>{remaining} {gameText(language).journal.active}</span>
        </div>
        {chapter && <article className="journal-chapter" aria-live="polite">
          <span>{chapter.eyebrow}</span><h3>{chapter.title}</h3><p>{chapter.story}</p>
          <strong>{chapter.objective}</strong>
        </article>}
        {campaignComplete && !ending && <section className="journal-ending" aria-labelledby="journal-ending-title">
          <span>{gameText(language).journal.campaignEnding}</span><h3 id="journal-ending-title">{copy.endingTitle}</h3>
          <p>{copy.endingPrompt}</p>
          <div className="journal-ending-choices">
            <button type="button" onClick={() => onChooseEnding('rebuild')}><strong>{copy.endingRebuildTitle}</strong><small>{copy.endingRebuildStory}</small></button>
            <button type="button" onClick={() => onChooseEnding('seal')}><strong>{copy.endingSealTitle}</strong><small>{copy.endingSealStory}</small></button>
            <button type="button" onClick={() => onChooseEnding('command')}><strong>{copy.endingCommandTitle}</strong><small>{copy.endingCommandStory}</small></button>
          </div>
        </section>}
        {campaignComplete && ending && <section className="journal-postgame" aria-live="polite">
          <span>{copy.postgameTitle}</span><h3>{ending.title}</h3><p>{ending.story}</p><small>{copy.postgameStory}</small>
        </section>}
        <div className="world-mission-grid journal-missions journal-scroll" tabIndex={0} aria-labelledby="journal-signals-title">
          {progress.initialRepairRequired && <p className="journal-empty">{gameText(language).journal.initialRepairRequired}</p>}
          {missions.length === 0 && <p className="journal-empty">{gameText(language).journal.campaignContractsAreAvailableInOrion}</p>}
          {missions.map(mission => {
            const done = isMissionComplete(progress, mission.id)
            const unlocked = isMissionUnlocked(progress, mission.id)
            const tracked = !trackedStationId && activeMission === mission.id
            const prerequisite = getMissionPrerequisite(mission.id)
            const prerequisiteTitle = prerequisite ? MISSIONS.find(item => item.id === prerequisite)?.title[language] : undefined
            return <article key={mission.id} style={{ borderInlineStartColor: FACTIONS[mission.faction].accent }}
              className={`world-mission journal-mission${done ? ' complete' : ''}${tracked ? ' is-tracked' : ''}${!unlocked ? ' is-locked' : ''}`}>
              <div className="journal-mission-body">
                <div className="journal-mission-tags">
                  <span>{mission.bossProfile ? gameText(language).journal.boss : mission.objective === 'orbital-sweep' ? gameText(language).journal.orbit : gameText(language).journal.contract}</span>
                  <small>{!unlocked && prerequisiteTitle
                    ? formatText(gameText(language).journal.missionLockedUntil, { mission: prerequisiteTitle })
                    : distanceLabel(distanceBetween(position, mission.worldPosition))}</small>
                </div>
                <h3>{mission.title[language]}</h3><p>{mission.briefing[language]}</p>
                <footer><small>{FACTIONS[mission.faction].name[language]}</small><span>{mission.reward.credits} KS{mission.bossProfile ? ` + ${gameText(language).journal.module}` : ''}</span></footer>
              </div>
              <button type="button" className="journal-track" disabled={!unlocked || done || tracked} onClick={() => onTrackMission(mission.id)} aria-label={`${gameText(language).journal.trackSignal}: ${mission.title[language]}`}>
                <span aria-hidden="true">{done ? '✓' : tracked ? '◆' : '↗'}</span><small>{done ? (gameText(language).journal.complete) : tracked ? (gameText(language).journal.tracked) : (gameText(language).journal.track)}</small>
              </button>
            </article>
          })}
        </div>
      </section>
    </div>
  </main>
}
