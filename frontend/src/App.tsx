import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { getNextCampaignMission, isMissionComplete, MISSIONS, type MissionId } from './game/missions/definitions'
import { FLIGHT_COMMANDS, type FlightCommand } from './game/input/InputController'
import { ORION_SECTOR_ID, ORION_STATIONS, type SectorPosition } from './game/domain/exploration'
import {
  applyDroneLoot,
  applyPlanetLoot,
  completeWorldMission,
  recordMissionObjectiveProgress,
  canStoreShipPart,
  craftRandomShipPart,
  equipShipPart,
  getPilotLevel,
  getShipBonuses,
  unequipShipPart,
  createEmptyMissionProgress,
  hasMissionProgress,
  loadMissionProgress,
  rerollShipPart,
  rollDroneLoot,
  rollPlanetLoot,
  saveMissionProgress,
  sellShipPart,
  updateSectorPosition,
  SHIP_PART_CRAFTING_COST,
  SHIP_PART_REROLL_COST,
  type MissionProgress,
} from './game/progress/missionProgress'
import {
  getEquippedPartRarities,
  getShipPartLevelRequirement,
  getShipPartSellValue,
  type ShipPartSlot,
} from './game/progress/shipParts'
import { HANGAR_CONVERSATIONS, HANGAR_CREW } from './game/hangar/crew'
import PilotInventory from './game/ui/PilotInventory'
import { MaterialArtwork, PartArtwork } from './game/ui/EquipmentArtwork'
import './game/ui/GarageArtwork.css'
import { PilotProgressBar } from './game/ui/PilotProgressBar'
import { GamePauseOverlay } from './game/ui/GamePauseOverlay'
import { ShipResistanceReadout } from './game/ui/ShipResistanceReadout'
import { ShipStatisticsPanel } from './game/ui/ShipStatisticsPanel'
import { HangarMaintenancePanel } from './game/ui/HangarMaintenancePanel'
import { ShipStatusHud } from './game/ui/ShipStatusHud'
import { NavigationJournal } from './game/ui/NavigationJournal'
import { useApplicationAudio } from './game/audio/useApplicationAudio'
import { getShipVitals, rechargeShipShields, regenerateHangarHull, updateShipVitals } from './game/progress/shipMaintenance'
import { getMaximumShipVitals } from './game/domain/shipTelemetry'
import type { HangarLandingStage } from './game/simulation/HangarLanding'
import type { ShipTelemetry } from './game/domain/shipTelemetry'
import { getShipResistances } from './game/progress/missionProgress'
import {
  loadGameSettings,
  saveGameSettings,
  type GameSettings,
} from './game/progress/gameSettings'

const SectorCanvas = lazy(() => import('./game/renderer/SectorCanvas').then((module) => ({
  default: module.SectorCanvas,
})))
type GarageSceneComponent = typeof import('./game/renderer/GarageCanvas')['GarageCanvas']

type Screen = 'title' | 'campaign' | 'garage' | 'exploration' | 'settings' | 'credits' | 'quit'
type ReturnScreen = 'title' | 'campaign' | 'exploration'

function getKeyLabel(code: string, language: 'pl' | 'en'): string {
  const labels: Record<string, string> = language === 'pl'
    ? { Space: 'Spacja', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', Escape: 'Esc' }
    : { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', Escape: 'Esc' }

  if (labels[code]) return labels[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [journalReturnScreen, setJournalReturnScreen] = useState<'exploration' | 'garage'>('exploration')
  const [returnScreen, setReturnScreen] = useState<ReturnScreen>('title')
  const [settings, setSettings] = useState(loadGameSettings)
  const [progress, setProgress] = useState(loadMissionProgress)
  const [hasSave, setHasSave] = useState(hasMissionProgress)
  const [confirmNewGame, setConfirmNewGame] = useState(false)
  const [garagePanelOpen, setGaragePanelOpen] = useState(true)
  const [garagePanelExpanded, setGaragePanelExpanded] = useState(false)
  const [rebindingCommand, setRebindingCommand] = useState<FlightCommand | null>(null)
  const [ambientLineIndex, setAmbientLineIndex] = useState(0)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [statisticsOpen, setStatisticsOpen] = useState(false)
  const [statisticsTelemetry, setStatisticsTelemetry] = useState<ShipTelemetry | null>(null)
  const shipTelemetryRef = useRef<ShipTelemetry | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseSettingsOpen, setPauseSettingsOpen] = useState(false)
  const [worldSessionActive, setWorldSessionActive] = useState(false)
  const [worldSessionKey, setWorldSessionKey] = useState(0)
  const [trackedMissionId, setTrackedMissionId] = useState<MissionId | null>(null)
  const [trackedStationId, setTrackedStationId] = useState<string | null>(null)
  const [dockingStationId, setDockingStationId] = useState<string | null>(null)
  const [garageReady, setGarageReady] = useState(false)
  const [garageLanded, setGarageLanded] = useState(false)
  const [garageLandingStage, setGarageLandingStage] = useState<HangarLandingStage>('approach')
  const [departureStationId, setDepartureStationId] = useState<string | null>(null)
  const [departureWorldReady, setDepartureWorldReady] = useState(false)
  const [GarageScene, setGarageScene] = useState<GarageSceneComponent | null>(null)
  const [combatActive, setCombatActive] = useState(false)
  const language = settings.language
  const applicationAudio = useApplicationAudio(screen, { main: settings.mainVolume, shots: settings.shotsVolume, music: settings.musicVolume })
  const activeMission = trackedMissionId && !isMissionComplete(progress, trackedMissionId) ? trackedMissionId : getNextCampaignMission(progress)
  const displayedExperience = progress.experience
  const equippedPartRarities = getEquippedPartRarities(progress.shipParts, progress.equippedParts)
  const updateShipTelemetry = useCallback((telemetry: ShipTelemetry) => { shipTelemetryRef.current = telemetry }, [])

  const updateSettings = useCallback((change: Partial<GameSettings>) => {
    const next = { ...settings, ...change }
    saveGameSettings(next)
    setSettings(next)
  }, [settings])

  useEffect(() => {
    if (!rebindingCommand) return

    const captureBinding = (event: KeyboardEvent) => {
      event.preventDefault()
      if (event.code === 'Escape') {
        event.stopImmediatePropagation()
        setRebindingCommand(null)
        return
      }
      if (!event.code || event.code === 'Unidentified') return
      if (event.code === 'KeyL') return

      const previousCommand = FLIGHT_COMMANDS.find(
        (command) => command !== rebindingCommand && settings.controls[command] === event.code,
      )
      const controls = { ...settings.controls, [rebindingCommand]: event.code }
      if (previousCommand) {
        controls[previousCommand] = settings.controls[rebindingCommand]
      }
      updateSettings({ controls })
      setRebindingCommand(null)
    }

    window.addEventListener('keydown', captureBinding)
    return () => window.removeEventListener('keydown', captureBinding)
  }, [rebindingCommand, settings.controls, updateSettings])

  useEffect(() => {
    if (screen !== 'settings') return

    const leaveSettingsOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || rebindingCommand) return
      event.preventDefault()
      setScreen(returnScreen)
    }

    window.addEventListener('keydown', leaveSettingsOnEscape)
    return () => window.removeEventListener('keydown', leaveSettingsOnEscape)
  }, [rebindingCommand, returnScreen, screen])

  useEffect(() => {
    if (screen !== 'garage') return
    const timer = window.setInterval(() => {
      setAmbientLineIndex((index) => (index + 1) % HANGAR_CONVERSATIONS.length)
    }, 9000)
    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen !== 'campaign' && screen !== 'exploration' && screen !== 'garage') return
    const toggleJournal = (event: KeyboardEvent) => {
      if (event.code !== 'KeyL' || event.repeat || rebindingCommand || statisticsOpen || inventoryOpen || pauseOpen || pauseSettingsOpen) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (departureStationId || (screen === 'garage' ? !garageLanded : screen === 'exploration' && dockingStationId)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (screen === 'campaign') setScreen(journalReturnScreen)
      else { setJournalReturnScreen(screen); setScreen('campaign') }
    }
    window.addEventListener('keydown', toggleJournal, true)
    return () => window.removeEventListener('keydown', toggleJournal, true)
  }, [screen, journalReturnScreen, rebindingCommand, statisticsOpen, inventoryOpen, pauseOpen, pauseSettingsOpen, departureStationId, garageLanded, dockingStationId])

  useEffect(() => {
    if (screen !== 'campaign' && screen !== 'exploration' && screen !== 'garage') return

    const handleStatisticsShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && statisticsOpen) {
        event.preventDefault()
        event.stopImmediatePropagation()
        setStatisticsOpen(false)
        return
      }
      if (event.code !== 'KeyC' || event.repeat || rebindingCommand || pauseOpen || pauseSettingsOpen) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (departureStationId || (screen === 'garage' ? !garageLanded : dockingStationId !== null)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setStatisticsTelemetry(screen === 'garage' ? null : shipTelemetryRef.current)
      setInventoryOpen(false)
      setStatisticsOpen(!statisticsOpen)
    }
    window.addEventListener('keydown', handleStatisticsShortcut, true)
    return () => window.removeEventListener('keydown', handleStatisticsShortcut, true)
  }, [screen, statisticsOpen, rebindingCommand, pauseOpen, pauseSettingsOpen, garageLanded, dockingStationId, departureStationId])

  useEffect(() => {
    if (screen !== 'campaign' && screen !== 'exploration' && screen !== 'garage') return

    const handleInventoryShortcut = (event: KeyboardEvent) => {
      if (event.code === 'KeyI' && !combatActive && !dockingStationId) {
        event.preventDefault()
        setStatisticsOpen(false)
        setInventoryOpen((open) => !open)
      } else if (event.key === 'Escape' && inventoryOpen) {
        event.preventDefault()
        setInventoryOpen(false)
      }
    }

    window.addEventListener('keydown', handleInventoryShortcut)
    return () => window.removeEventListener('keydown', handleInventoryShortcut)
  }, [combatActive, dockingStationId, inventoryOpen, screen])

  useEffect(() => {
    if (screen !== 'exploration' || dockingStationId) return

    const handlePauseShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || rebindingCommand) return
      event.preventDefault()
      if (inventoryOpen) {
        setInventoryOpen(false)
        return
      }
      if (pauseSettingsOpen) {
        setPauseSettingsOpen(false)
        setPauseOpen(true)
        return
      }
      setPauseOpen((open) => !open)
    }

    window.addEventListener('keydown', handlePauseShortcut)
    return () => window.removeEventListener('keydown', handlePauseShortcut)
  }, [dockingStationId, inventoryOpen, pauseSettingsOpen, rebindingCommand, screen])

  const startNewGame = () => {
    const fresh = createEmptyMissionProgress()
    saveMissionProgress(fresh)
    setProgress(fresh)
    setStatisticsOpen(false)
    shipTelemetryRef.current = null
    setHasSave(true)
    setInventoryOpen(false)
    setPauseOpen(false)
    setPauseSettingsOpen(false)
    setConfirmNewGame(false)
    setTrackedMissionId(null)
    setTrackedStationId(null)
    setDockingStationId(null)
    setGarageReady(false)
    setGarageLanded(false)
    setCombatActive(false)
    setDepartureStationId(null)
    setDepartureWorldReady(false)
    setWorldSessionActive(true)
    setWorldSessionKey(key => key + 1)
    setScreen('exploration')
  }

  const exitGameplay = () => {
    setStatisticsOpen(false)
    setPauseOpen(false)
    setPauseSettingsOpen(false)
    setInventoryOpen(false)
    setDepartureStationId(null)
    setDepartureWorldReady(false)
    setWorldSessionActive(false)
    setDockingStationId(null)
    setScreen('title')
  }

  const requestNewGame = () => {
    if (hasSave) {
      setConfirmNewGame(true)
      return
    }
    startNewGame()
  }

  const loadGame = () => {
    if (!hasSave) return
    const savedProgress = loadMissionProgress()
    setProgress(savedProgress)
    setStatisticsOpen(false)
    shipTelemetryRef.current = null
    setInventoryOpen(false)
    setDepartureStationId(null)
    setDepartureWorldReady(false)
    setWorldSessionActive(true)
    setWorldSessionKey(key => key + 1)
    setDockingStationId(null)
    setGarageReady(false)
    setGarageLanded(false)
    setCombatActive(false)
    setScreen('exploration')
  }

  const openSettings = (from: ReturnScreen) => {
    setReturnScreen(from)
    setScreen('settings')
  }

  const closeSettings = () => {
    setRebindingCommand(null)
    setScreen(returnScreen)
  }

  const openCredits = (from: ReturnScreen) => {
    setReturnScreen(from)
    setScreen('credits')
  }

  const updateSavedProgress = useCallback((update: (current: MissionProgress) => MissionProgress) => {
    const current = loadMissionProgress()
    const next = update(current)
    if (next === current) return
    saveMissionProgress(next)
    setProgress(next)
    setHasSave(true)
  }, [])

  useEffect(() => {
    if (screen !== 'garage' || !garageLanded || departureStationId) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const seconds = Math.max(0, (now - previous) / 1000)
      previous = now
      updateSavedProgress(current => regenerateHangarHull(current, seconds))
    }, 500)
    return () => window.clearInterval(timer)
  }, [screen, garageLanded, departureStationId, updateSavedProgress])

  const collectPlanet = useCallback((planetId: string) => {
    updateSavedProgress(current => {
      let next = applyPlanetLoot(current, planetId, rollPlanetLoot())
      for (const mission of MISSIONS) {
        if (mission.objective === 'survey-planet' && mission.sectorTarget?.id === planetId) next = completeWorldMission(next, mission.id)
      }
      return next
    })
  }, [updateSavedProgress])

  const defeatDrone = useCallback((droneId: string) => {
    updateSavedProgress(current => applyDroneLoot(current, droneId, rollDroneLoot()))
  }, [updateSavedProgress])

  const completeMission = useCallback((id: MissionId) => {
    updateSavedProgress(current => completeWorldMission(current, id))
  }, [updateSavedProgress])

  const updateMissionObjective = useCallback((id: MissionId, count: number) => {
    updateSavedProgress(current => recordMissionObjectiveProgress(current, id, count))
  }, [updateSavedProgress])

  const beginDocking = useCallback((id: string) => {
    if (!ORION_STATIONS.some(station => station.id === id)) return
    setInventoryOpen(false)
    setStatisticsOpen(false)
    setPauseOpen(false)
    setPauseSettingsOpen(false)
    setGarageReady(false)
    setGarageLanded(false)
    setGaragePanelOpen(true)
    setGaragePanelExpanded(false)
    setGarageLandingStage('approach')
    setDockingStationId(id)
    // A normal parent update mounts the prepared scene while flight continues.
    // Suspense retries can otherwise wait behind the world's animation updates.
    void import('./game/renderer/GarageCanvas').then(module => {
      setGarageScene(() => module.GarageCanvas)
    })
  }, [])

  const finishDocking = useCallback((id: string) => {
    if (id === dockingStationId && garageReady) setScreen('garage')
  }, [dockingStationId, garageReady])

  const leaveGarage = useCallback(() => {
    if (!garageLanded || departureStationId) return
    const station = ORION_STATIONS.find(site => site.id === dockingStationId)
    if (!station) return
    updateSavedProgress(current => updateSectorPosition(current, ORION_SECTOR_ID, station.launchPosition.z, station.launchPosition.x, station.launchPosition.y))
    setInventoryOpen(false)
    setStatisticsOpen(false)
    shipTelemetryRef.current = null
    setDepartureWorldReady(false)
    setDepartureStationId(station.id)
    setCombatActive(false)
    setWorldSessionKey(key => key + 1)
  }, [dockingStationId, garageLanded, departureStationId, updateSavedProgress])

  const finishDeparture = useCallback(() => {
    setDepartureStationId(null)
    setDockingStationId(null)
    setGarageReady(false)
    setGarageLanded(false)
  }, [])

  useEffect(() => {
    if (screen !== 'garage') return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (inventoryOpen) setInventoryOpen(false)
      else leaveGarage()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [inventoryOpen, leaveGarage, screen])

  const updateSectorPositionSaved = useCallback((position: SectorPosition) => {
    updateSavedProgress((current) => {
      const next = updateSectorPosition(current, ORION_SECTOR_ID, position.z, position.x, position.y)
      return shipTelemetryRef.current ? updateShipVitals(next, shipTelemetryRef.current) : next
    })
  }, [updateSavedProgress])

  const craftPart = () => {
    updateSavedProgress((current) => craftRandomShipPart(current, `module-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`))
  }

  const sellPart = (partId: string) => {
    updateSavedProgress((current) => sellShipPart(current, partId))
  }

  const copy = language === 'pl'
    ? {
        eyebrow: 'CZARNY MERIDIAN / SEKTOR ORION-7',
        title: 'NEON VOID',
        lead: 'Gdy sieć szlaków umarła, każda odpowiedź prowadzi głębiej w jej ruiny. Przetrwaj lot i odkrywaj, co naprawdę uciszyło Meridian.',
        prologueKicker: 'DZIENNIK LOTU / PUNKT WEJŚCIA',
        prologueTitle: 'Sygnał w pustce',
        prologueStory: 'Pokład budzi się w zimnym świetle awaryjnych lamp. Szlaki Meridian zamilkły, a z uszkodzonej boi wraca pojedynczy sygnał — zawsze z tymi samymi współrzędnymi.',
        prologueTransmission: '„Jeśli słyszysz ten zapis, nie odpowiadaj. Strażnik wciąż czuwa.”',
        prologueObjective: 'Najpierw dotrzyj do przekaźnika. Nie wiadomo, czy wezwanie jest prośbą o pomoc, czy przynętą.',
        journal: 'DZIENNIK KAMPANII / ROZDZIAŁ 01',
        firstTitle: 'Pierwszy kontakt',
        firstStory: 'Sieć szlaków zamilkła. Strażnik Meridian odciął ostatni działający przekaźnik, a jego sygnał awaryjny powtarza te same współrzędne.',
        firstObjective: 'Przerwij blokadę Strażnika i dotrzyj do przekaźnika.',
        secondTitle: 'Sygnał w ciszy',
        secondStory: 'Strażnik nie bronił przekaźnika przed tobą. Chronił go przed czymś, co odpowiada z drugiej strony. Trzy boje mogą ujawnić, co wydarzyło się na szlaku.',
        secondObjective: 'Odzyskaj czarne skrzynki z trzech boi.',
        thirdTitle: 'Echo w rdzeniu',
        thirdStory: 'Ostrzeżenie z boi prowadzi do rdzenia emisji. Osłona otwiera się tylko między impulsami — strzelaj w krótkich oknach, zanim przekaźnik ponownie zawoła.',
        thirdObjective: 'Zniszcz rdzeń emisji, trafiając w otwartą osłonę.',
        fourthTitle: 'Archiwum Mgławicy',
        fourthStory: 'Cisza po rdzeniu nie przyniosła odpowiedzi. Sygnał odbija się od lodowych ruin daleko poza znanymi szlakami.',
        fourthObjective: 'Doleć do Archiwum Mgławicy i zeskanuj ruiny.',
        fifthTitle: 'Cichy patrol',
        fifthStory: 'W archiwum znaleziono fałszywe współrzędne. Nadaje je zwiadowca, który krąży przy lodowej skorupie.',
        fifthObjective: 'Odszukaj i unieszkodliw zwiadowcę Veil.',
        sixthTitle: 'Głos bez echa',
        sixthStory: 'Zwiadowca prowadzi do jednostki sterującej zakłóceniami. Gdy zamilknie, droga do stoczni powinna być wolna.',
        sixthObjective: 'Pokonaj jednostkę Null Choir i otwórz drogę do stoczni.',
        continue: 'Kontynuuj historię',
        retry: 'Wznów rozdział',
        completedTitle: 'Stocznia na końcu szlaku',
        completedStory: 'Null Choir zamilkł. Załoga odbiera współrzędne stoczni Meridian — teraz można odbudować hangar i planować wyprawy poza główną historią.',
        hangar: 'HANGAR / JESZCZE NIEODKRYTY',
        hangarDetail: 'Najpierw trzeba dotrzeć do stoczni i odzyskać hangar. Wybór map pozostaje zamknięty do tego czasu.',
        defeat: 'Poprzednia wyprawa zakończyła się utratą kadłuba. Załoga czeka na ponowną próbę.',
        chapterTwo: 'DZIENNIK KAMPANII / ROZDZIAŁ 02',
        chapterThree: 'DZIENNIK KAMPANII / ROZDZIAŁ 03',
        chapterFour: 'DZIENNIK KAMPANII / ROZDZIAŁ 04',
        chapterFive: 'DZIENNIK KAMPANII / ROZDZIAŁ 05',
      }
    : {
        eyebrow: 'BLACK MERIDIAN / SECTOR ORION-7',
        title: 'NEON VOID',
        lead: 'When the transit network died, every answer led deeper into its ruins. Survive the route and uncover what truly silenced Meridian.',
        prologueKicker: 'FLIGHT LOG / ENTRY POINT',
        prologueTitle: 'A Signal in the Void',
        prologueStory: 'The deck wakes under the cold glow of emergency lamps. Meridian’s routes have gone silent, and a damaged buoy repeats one signal — always from the same coordinates.',
        prologueTransmission: '“If you hear this recording, do not answer. The Warden is still watching.”',
        prologueObjective: 'Reach the relay first. There is no way to know whether the call is a plea for help or a lure.',
        journal: 'CAMPAIGN LOG / CHAPTER 01',
        firstTitle: 'First Contact',
        firstStory: 'The transit network fell silent. The Meridian Warden cut off the last active relay, and its distress signal repeats a single set of coordinates.',
        firstObjective: 'Break the Warden blockade and reach the relay.',
        secondTitle: 'Signal in the Quiet',
        secondStory: 'The Warden was not protecting the relay from you. It was guarding it from something answering on the other side. Three buoys may reveal what happened along the route.',
        secondObjective: 'Recover the black boxes from all three buoys.',
        thirdTitle: 'Echo in the Core',
        thirdStory: 'The buoy warning leads to the signal core. Its shield opens only between pulses — fire in the brief windows before the relay calls again.',
        thirdObjective: 'Destroy the signal core while its shield is open.',
        fourthTitle: 'Veil Archive',
        fourthStory: 'Silencing the core brought no answer. A signal now rebounds from icy ruins far beyond the known routes.',
        fourthObjective: 'Reach the Veil Archive and scan the ruins.',
        fifthTitle: 'Silent Patrol',
        fifthStory: 'The Archive revealed false coordinates. A scout near the ice shell is broadcasting them.',
        fifthObjective: 'Find and disable the Veil scout.',
        sixthTitle: 'The Null Choir',
        sixthStory: 'The scout leads to the craft steering the interference. Once it falls silent, the shipyard route should open.',
        sixthObjective: 'Defeat the Null Choir and clear the route to the shipyard.',
        continue: 'Continue the story',
        retry: 'Retry this chapter',
        completedTitle: 'The Shipyard at the End of the Route',
        completedStory: 'The Null Choir is silent. The crew has the Meridian shipyard coordinates — rebuild the hangar and chart routes beyond the main story.',
        hangar: 'HANGAR / NOT DISCOVERED',
        hangarDetail: 'First reach the shipyard and recover the hangar. Free map selection stays locked until then.',
        defeat: 'The last sortie ended with a lost hull. The crew is waiting for another attempt.',
        chapterTwo: 'CAMPAIGN LOG / CHAPTER 02',
        chapterThree: 'CAMPAIGN LOG / CHAPTER 03',
        chapterFour: 'CAMPAIGN LOG / CHAPTER 04',
        chapterFive: 'CAMPAIGN LOG / CHAPTER 05',
      }

  const ui = language === 'pl'
    ? {
        mainMenu: 'MENU GŁÓWNE',
        newGame: 'Nowa gra',
        loadGame: 'Wczytaj grę',
        noSave: 'Brak zapisu kampanii',
        settings: 'Ustawienia',
        credits: 'Credits',
        quit: 'Zakończ',
        confirmTitle: 'Rozpocząć nową grę?',
        confirmMessage: 'Obecny zapis kampanii zostanie zastąpiony. Ustawienia pozostaną bez zmian.',
        cancel: 'Anuluj',
        confirm: 'Zastąp zapis i zacznij',
        settingsTitle: 'Ustawienia',
        language: 'Język',
        polish: 'Polski',
        english: 'English',
        graphics: 'Jakość grafiki',
        low: 'Oszczędna',
        standard: 'Standardowa',
        high: 'Wysoka',
        graphicsHint: 'Jakość wpływa na rozdzielczość renderowania, poświatę i liczbę gwiazd.',
        controls: 'Sterowanie',
        controlsHint: 'Mysz steruje statkiem, LPM strzela. L otwiera dziennik i jest zarezerwowane. Kliknij przypisany klawisz, by zmienić go; Esc anuluje, zajęte klawisze zamieniają się miejscami.',
        rebind: 'Zmień klawisz',
        pressKey: 'Naciśnij nowy klawisz…',
        pitchUp: 'Pochylenie w górę',
        pitchDown: 'Pochylenie w dół',
        yawLeft: 'Skręt w lewo',
        yawRight: 'Skręt w prawo',
        rollLeft: 'Przechył w lewo',
        rollRight: 'Przechył w prawo',
        boost: 'Przyspieszenie',
        brake: 'Hamowanie',
        fire: 'Strzał',
        dodge: 'Unik',
        mainVolume: 'Głośność główna',
        shotsVolume: 'Głośność strzałów',
        musicVolume: 'Głośność muzyki',
        mouseSensitivity: 'Czułość myszy',
        mouseSensitivityHint: 'Wskaźnik na środku jest neutralny; wyższa czułość szybciej obraca statek.',
        back: 'Wróć',
        creditsTitle: 'Twórcy i technologia',
        creditsStory: 'Świat i fabuła',
        creditsGame: 'Projekt gry',
        creditsEngine: 'Silnik 3D',
        creditsInterface: 'Interfejs',
        quitTitle: 'Lot zakończony',
        quitMessage: 'Możesz bezpiecznie zamknąć tę kartę przeglądarki.',
        prologueLaunch: 'Rozpocznij pierwszą misję',
        prologueBack: 'Wróć do tytułu',
        continue: 'Kontynuuj historię',
        retry: 'Wznów rozdział',
        chapterObjective: 'CEL',
        workshop: 'Otwórz hangar planetarny',
        garageTitle: 'Hangar',
        garageStory: 'Na Szklanym Księżycu działa niewielka stacja naprawcza. Rhea, Ivo i kurier z Nacre wymieniają się wieściami, gdy ty ulepszasz statek przed kolejnym lotem.',
        garageBalance: 'Kredyty Szlakowe (KS)',
        garageMaterials: 'Materiały w ładowni',
        garageParts: 'Części w magazynie',
        garageEmptyParts: 'Nie masz jeszcze modułów. Odzyskuj ładunki i twórz części z zebranych materiałów.',
        garageCraft: 'Wytwórz losowy moduł',
        garageSlots: 'Elementy statku',
        garageInstalled: 'Zamontowano',
        garageEmptySlot: 'Brak zamontowanego modułu',
        garageUnequip: 'Zdemontuj',
        garageExit: 'Opuść hangar',
        garageLocation: 'HANGAR NA PLANECIE',
        garagePlanetName: 'SZKLANY KSIĘŻYC',
        garageHidePanel: 'Ukryj panel',
        garageShowPanel: 'Pokaż hangar',
        garageExpandPanel: 'Rozszerz panel',
        garageShrinkPanel: 'Zwiń panel',
        garageLoading: 'Otwieranie hangaru…',
        rarityStandard: 'Standardowy',
        rarityRefined: 'Ulepszony',
        rarityPrototype: 'Prototyp',
        garageEquip: 'Zamontuj',
        garageEquipped: 'Zamontowany',
        garageSell: 'Sprzedaj',
        garageSellHint: 'PPM na niezainstalowany module sprzedaje go.',
        garageLevelRequired: 'Wymagany poziom pilota',
        garageFull: 'Plecak jest pełny. Sprzedaj część lub zamontuj jedną przed tworzeniem modułu.',
        garageReroll: 'Przestrojenie',
        garageEffect: 'Premie z zamontowanych części',
        garageBack: 'Wróć do fabuły',
        menu: 'Tytuł',
      }
    : {
        mainMenu: 'MAIN MENU',
        newGame: 'New Game',
        loadGame: 'Load Game',
        noSave: 'No campaign save yet',
        settings: 'Settings',
        credits: 'Credits',
        quit: 'Quit',
        confirmTitle: 'Start a new game?',
        confirmMessage: 'Your current campaign save will be replaced. Settings will be kept.',
        cancel: 'Cancel',
        confirm: 'Replace save and start',
        settingsTitle: 'Settings',
        language: 'Language',
        polish: 'Polski',
        english: 'English',
        graphics: 'Graphics quality',
        low: 'Performance',
        standard: 'Standard',
        high: 'High',
        graphicsHint: 'Quality changes render resolution, glow, and star count.',
        controls: 'Controls',
        controlsHint: 'Move the mouse to steer and use the left button to fire. L is reserved for the journal. Select a binding to change it; Esc cancels and occupied keys swap.',
        rebind: 'Change key',
        pressKey: 'Press a new key…',
        pitchUp: 'Pitch up',
        pitchDown: 'Pitch down',
        yawLeft: 'Turn left',
        yawRight: 'Turn right',
        rollLeft: 'Roll left',
        rollRight: 'Roll right',
        boost: 'Boost',
        brake: 'Brake',
        fire: 'Fire',
        dodge: 'Dodge',
        mainVolume: 'Master volume',
        shotsVolume: 'Shot volume',
        musicVolume: 'Music volume',
        mouseSensitivity: 'Mouse sensitivity',
        mouseSensitivityHint: 'The canvas center is neutral; higher sensitivity turns the ship faster.',
        back: 'Back',
        creditsTitle: 'Credits',
        creditsStory: 'World and story',
        creditsGame: 'Game design',
        creditsEngine: '3D engine',
        creditsInterface: 'Interface',
        quitTitle: 'Flight complete',
        quitMessage: 'You can safely close this browser tab.',
        prologueLaunch: 'Begin the first mission',
        prologueBack: 'Return to title',
        continue: 'Continue the story',
        retry: 'Retry this chapter',
        chapterObjective: 'OBJECTIVE',
        workshop: 'Open the planetary hangar',
        garageTitle: 'Hangar',
        garageStory: 'A small repair station operates on the Glass Moon. Rhea, Ivo, and a courier from Nacre trade rumors while you tune the ship for its next sortie.',
        garageBalance: 'Route Credits (KS)',
        garageMaterials: 'Cargo materials',
        garageParts: 'Parts storage',
        garageEmptyParts: 'No modules yet. Recover cargo and craft parts from gathered materials.',
        garageCraft: 'Craft random module',
        garageSlots: 'Ship components',
        garageInstalled: 'Installed',
        garageEmptySlot: 'No module installed',
        garageUnequip: 'Remove',
        garageExit: 'Leave hangar',
        garageLocation: 'HANGAR ON PLANET',
        garagePlanetName: 'GLASS MOON',
        garageHidePanel: 'Hide panel',
        garageShowPanel: 'Show hangar',
        garageExpandPanel: 'Expand panel',
        garageShrinkPanel: 'Collapse panel',
        garageLoading: 'Opening hangar…',
        rarityStandard: 'Standard',
        rarityRefined: 'Refined',
        rarityPrototype: 'Prototype',
        garageEquip: 'Equip',
        garageEquipped: 'Equipped',
        garageSell: 'Sell',
        garageSellHint: 'Right-click an unequipped module to sell it.',
        garageLevelRequired: 'Pilot level required',
        garageFull: 'The backpack is full. Sell or equip a part before crafting another module.',
        garageReroll: 'Recalibrate',
        garageEffect: 'Bonuses from installed parts',
        garageBack: 'Return to the story',
        menu: 'Title',
      }

  const controlLabels: Record<FlightCommand, string> = {
    pitchUp: ui.pitchUp,
    pitchDown: ui.pitchDown,
    yawLeft: ui.yawLeft,
    yawRight: ui.yawRight,
    rollLeft: ui.rollLeft,
    rollRight: ui.rollRight,
    boost: language === 'pl' ? 'Połowa mocy silników' : 'Half engine thrust',
    fullBoost: language === 'pl' ? 'Pełna moc silników' : 'Full engine thrust',
    brake: ui.brake,
    fire: ui.fire,
    dodge: ui.dodge,
  }
  const shipBonuses = getShipBonuses(progress)

  const renderScreen = () => {
  if (screen === 'exploration') {
    return (
      <>
        <PilotProgressBar experience={displayedExperience} language={language} />
        {(pauseOpen || pauseSettingsOpen) && (
          <GamePauseOverlay
            language={language}
            mode={pauseSettingsOpen ? 'settings' : 'pause'}
            settings={settings}
            controlLabels={controlLabels}
            rebindingCommand={rebindingCommand}
            onUpdateSettings={updateSettings}
            onSetRebindingCommand={setRebindingCommand}
            onResume={() => setPauseOpen(false)}
            onOpenSettings={() => {
              setPauseOpen(false)
              setPauseSettingsOpen(true)
            }}
            onBack={() => {
              setPauseSettingsOpen(false)
              setPauseOpen(true)
            }}
            onExit={exitGameplay}
          />
        )}
        {inventoryOpen && (
          <PilotInventory
            progress={progress}
            language={language}
            canSell={false}
            onClose={() => setInventoryOpen(false)}
            onEquip={(partId) => updateSavedProgress((current) => equipShipPart(current, partId))}
            onUnequip={(slot) => updateSavedProgress((current) => unequipShipPart(current, slot))}
            onSell={sellPart}
          />
        )}
      </>
    )
  }

  if (screen === 'settings') {
    return (
      <main className="main-menu utility-screen settings-screen">
        <section className="utility-content settings-content" aria-labelledby="settings-title">
          <header className="settings-header">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1 className="utility-title" id="settings-title">{ui.settingsTitle}</h1>
            </div>
            <button
              type="button"
              className="settings-close"
              aria-label={language === 'pl' ? 'Zamknij ustawienia' : 'Close settings'}
              title={language === 'pl' ? 'Zamknij ustawienia (Esc)' : 'Close settings (Esc)'}
              onClick={closeSettings}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div
            className="utility-panel settings-body"
            role="region"
            aria-label={language === 'pl' ? 'Opcje gry' : 'Game options'}
            tabIndex={0}
          >
            <label className="setting-row" htmlFor="language-setting">
              <span>{ui.language}</span>
              <select
                id="language-setting"
                value={language}
                onChange={(event) => {
                  updateSettings({ language: event.currentTarget.value === 'en' ? 'en' : 'pl' })
                }}
              >
                <option value="pl">{ui.polish}</option>
                <option value="en">{ui.english}</option>
              </select>
            </label>
            <label className="setting-row" htmlFor="graphics-setting">
              <span>{ui.graphics}</span>
              <select
                id="graphics-setting"
                value={settings.graphicsQuality}
                onChange={(event) => {
                  const quality = event.currentTarget.value
                  updateSettings({
                    graphicsQuality: quality === 'low' || quality === 'high' ? quality : 'standard',
                  })
                }}
              >
                <option value="low">{ui.low}</option>
                <option value="standard">{ui.standard}</option>
                <option value="high">{ui.high}</option>
              </select>
            </label>
            <p className="settings-hint">{ui.graphicsHint}</p>
            <label className="volume-row" htmlFor="mouse-sensitivity">
              <span>{ui.mouseSensitivity}</span>
              <input
                id="mouse-sensitivity"
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={settings.mouseSensitivity}
                onChange={(event) => updateSettings({ mouseSensitivity: Number(event.currentTarget.value) })}
              />
              <output htmlFor="mouse-sensitivity">{settings.mouseSensitivity.toFixed(1)}×</output>
            </label>
            <p className="settings-hint">{ui.mouseSensitivityHint}</p>
            <label className="volume-row" htmlFor="main-volume">
              <span>{ui.mainVolume}</span>
              <input
                id="main-volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(settings.mainVolume * 100)}
                onChange={(event) => updateSettings({ mainVolume: Number(event.currentTarget.value) / 100 })}
              />
              <output htmlFor="main-volume">{Math.round(settings.mainVolume * 100)}%</output>
            </label>
            <label className="volume-row" htmlFor="shots-volume">
              <span>{ui.shotsVolume}</span>
              <input
                id="shots-volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(settings.shotsVolume * 100)}
                onChange={(event) => updateSettings({ shotsVolume: Number(event.currentTarget.value) / 100 })}
              />
              <output htmlFor="shots-volume">{Math.round(settings.shotsVolume * 100)}%</output>
            </label>
            <label className="volume-row" htmlFor="music-volume">
              <span>{ui.musicVolume}</span>
              <input
                id="music-volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(settings.musicVolume * 100)}
                onChange={(event) => updateSettings({ musicVolume: Number(event.currentTarget.value) / 100 })}
              />
              <output htmlFor="music-volume">{Math.round(settings.musicVolume * 100)}%</output>
            </label>
            <div className="controls-reference">
              <strong>{ui.controls}</strong>
              <p>{language === 'pl' ? 'L — dziennik nawigacyjny · C — statystyki · I — ekwipunek' : 'L — navigation journal · C — statistics · I — inventory'}</p>
              <p role={rebindingCommand ? 'status' : undefined}>
                {rebindingCommand ? ui.pressKey : ui.controlsHint}
              </p>
              <div className="keybindings">
                {FLIGHT_COMMANDS.map((command) => (
                  <div className="keybinding-row" key={command}>
                    <span>{controlLabels[command]}</span>
                    <button
                      type="button"
                      className="binding-button"
                      aria-label={`${ui.rebind}: ${controlLabels[command]}`}
                      onClick={() => setRebindingCommand(command)}
                    >
                      {rebindingCommand === command
                        ? ui.pressKey
                        : getKeyLabel(settings.controls[command], language)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <footer className="settings-footer">
            <p>{language === 'pl' ? 'Zmiany zapisują się automatycznie.' : 'Changes are saved automatically.'}</p>
            <button type="button" className="primary-action utility-back" onClick={closeSettings}>
              <span>{ui.back}</span>
              <span aria-hidden="true">←</span>
            </button>
          </footer>
        </section>
      </main>
    )
  }

  if (screen === 'credits') {
    return (
      <main className="main-menu utility-screen">
        <section className="utility-content">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="utility-title">{ui.creditsTitle}</h1>
          <div className="utility-panel credits-list">
            <p><span>{ui.creditsGame}</span><strong>NEON VOID</strong></p>
            <p><span>{ui.creditsStory}</span><strong>Czarny Meridian</strong></p>
            <p><span>{ui.creditsEngine}</span><strong>Babylon.js</strong></p>
            <p><span>{ui.creditsInterface}</span><strong>React · TypeScript</strong></p>
          </div>
          <button className="primary-action utility-back" onClick={() => setScreen(returnScreen)}>
            <span>{ui.back}</span>
            <span aria-hidden="true">←</span>
          </button>
        </section>
      </main>
    )
  }

  if (screen === 'garage' && departureStationId) return (
    <div className="station-landing-status" role="status">{language === 'pl' ? 'Start · opuszczanie hangaru' : 'Takeoff · leaving hangar'}</div>
  )

  if (screen === 'garage' && !garageLanded) return (
    <div className="station-landing-status" role="status">{garageLandingStage === 'deploying'
      ? (language === 'pl' ? 'Lądowanie · rozkładanie podpór' : 'Landing · deploying landing gear')
      : garageLandingStage === 'touchdown'
        ? (language === 'pl' ? 'Podpory rozłożone · osiadanie na płycie' : 'Gear extended · touching down')
        : (language === 'pl' ? 'Lądowanie · podejście nad płytę' : 'Landing · approaching the pad')}
    </div>
  )

  if (screen === 'garage') {
    const garageVitals = getShipVitals(progress)
    const garageMaximum = getMaximumShipVitals(progress.shieldLevel, shipBonuses)
    const ambientConversation = HANGAR_CONVERSATIONS[ambientLineIndex]
    const slotLabels: Record<ShipPartSlot, string> = language === 'pl'
      ? { weapon: 'Uzbrojenie', shield: 'Osłony', engine: 'Silnik' }
      : { weapon: 'Weapons', shield: 'Shields', engine: 'Engine' }
    const rarityLabels = {
      standard: ui.rarityStandard,
      refined: ui.rarityRefined,
      prototype: ui.rarityPrototype,
    }

    return (
      <main className="planetary-garage">
        <ShipStatusHud language={language} shield={garageVitals.shield} maxShield={garageMaximum.shield} hull={garageVitals.hull} maxHull={garageMaximum.hull} />
        <div className="garage-speech-bubbles" role="status" aria-live="polite">
          {ambientConversation.map((turn, index) => {
            const crewMember = HANGAR_CREW.find((member) => member.name[language] === turn.speaker[language])
            return (
              <p
                className={`garage-speech-bubble garage-speech-${crewMember?.id ?? 'crew'}`}
                key={`${ambientLineIndex}-${index}`}
              >
                <strong>{turn.speaker[language]}</strong>
                <span>{turn.line[language]}</span>
              </p>
            )
          })}
        </div>
        <header className="garage-toolbar">
          <div>
            <span>{language === 'pl' ? 'HANGAR STACJI ORBITALNEJ' : 'ORBITAL STATION HANGAR'}</span>
            <strong>{ORION_STATIONS.find(station => station.id === dockingStationId)?.name[language]}</strong>
          </div>
          <div className="garage-toolbar-actions">
            <button
              type="button"
              className="garage-panel-toggle"
              aria-expanded={garagePanelOpen}
              aria-label={garagePanelOpen ? ui.garageHidePanel : ui.garageShowPanel}
              title={garagePanelOpen ? ui.garageHidePanel : ui.garageShowPanel}
              onClick={() => setGaragePanelOpen((open) => !open)}
            >
              <span aria-hidden="true">{garagePanelOpen ? '◉' : '◌'}</span>
            </button>
            {garagePanelOpen && (
              <button
                type="button"
                className="garage-panel-toggle"
                aria-expanded={garagePanelExpanded}
                aria-label={garagePanelExpanded ? ui.garageShrinkPanel : ui.garageExpandPanel}
                title={garagePanelExpanded ? ui.garageShrinkPanel : ui.garageExpandPanel}
                onClick={() => setGaragePanelExpanded((expanded) => !expanded)}
              >
                <span aria-hidden="true">{garagePanelExpanded ? '⤡' : '⤢'}</span>
              </button>
            )}
            <button
              type="button"
              className="garage-exit"
              aria-label={ui.garageExit}
              title={ui.garageExit}
              onClick={leaveGarage}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>
        {garagePanelOpen && (
          <section
            className={`garage-interface${garagePanelExpanded ? ' expanded' : ''}`}
            aria-label={ui.garageTitle}
          >
          <div className="garage-interface-heading">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{ui.garageTitle}</h1>
            <p>{language === 'pl' ? 'Załoga stacji naprawia i ulepsza statki. Przygotuj wyposażenie przed powrotem w głęboką przestrzeń.' : 'The station crew repairs and upgrades ships. Prepare your equipment before returning to deep space.'}</p>
            <div className="garage-balance">
              <span><MaterialArtwork kind="credits" />{ui.garageBalance}</span>
              <strong>{progress.credits} KS</strong>
            </div>
          </div>

          <section className="garage-slots" aria-labelledby="garage-slots-title">
            <h2 id="garage-slots-title">{ui.garageSlots}</h2>
            {(['weapon', 'shield', 'engine'] as const).map((slot) => {
              const part = progress.shipParts.find((item) => item.id === progress.equippedParts[slot])
              return (
                <article className={`garage-slot${part ? ` rarity-${part.rarity}` : ' empty'}`} key={slot}>
                  <PartArtwork slot={slot} rarity={part?.rarity} />
                  <div className="garage-slot-copy">
                    <strong>{slotLabels[slot]}</strong>
                    {part
                      ? <span className={`rarity-badge rarity-${part.rarity}`}>{rarityLabels[part.rarity]}</span>
                      : <span className="garage-slot-empty">{ui.garageEmptySlot}</span>}
                  </div>
                  {part && (
                    <button
                      type="button"
                      className="garage-part-action"
                      onClick={() => updateSavedProgress((current) => unequipShipPart(current, slot))}
                    >
                      {ui.garageUnequip}
                    </button>
                  )}
                </article>
              )
            })}
          </section>

          <p className="garage-active-bonuses">
            {ui.garageEffect}: DMG +{shipBonuses.damagePercent}% · SHD +{shipBonuses.shieldPoints} · HULL +{shipBonuses.hullPoints} · ENG +{shipBonuses.enginePercent}%
          </p>
          <ShipResistanceReadout resistances={getShipResistances(progress)} language={language} collapsible={false} />

          <HangarMaintenancePanel progress={progress} language={language} onRecharge={() => updateSavedProgress(rechargeShipShields)} />
          <h2 className="garage-section-title">{ui.garageMaterials}</h2>
          <div className="garage-materials">
            <p><MaterialArtwork kind="alloy" /><span>{language === 'pl' ? 'Stop metalu' : 'Alloy scrap'}</span><strong>{progress.scrapMetal}</strong></p>
            <p><MaterialArtwork kind="copper" /><span>{language === 'pl' ? 'Miedź' : 'Copper'}</span><strong>{progress.copper}</strong></p>
            <p><MaterialArtwork kind="radioactive" /><span>{language === 'pl' ? 'Pozostałość radioaktywna' : 'Radioactive residue'}</span><strong>{progress.radioactiveResidue}</strong></p>
            <p><svg className="garage-pilot-icon" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="m18 4 10 6v12l-10 9L8 22V10Z" fill="#243b4d" stroke="#91bad2" /><path d="m12 15 6 5 6-5m-12 6 6 5 6-5" stroke="#b4d8ed" strokeWidth="2" /></svg><span>{language === 'pl' ? 'Poziom pilota' : 'Pilot level'}</span><strong>{getPilotLevel(progress.experience)}</strong></p>
          </div>

          <button
            className="primary-action garage-craft"
            type="button"
            disabled={
              progress.credits < SHIP_PART_CRAFTING_COST.credits
              || progress.scrapMetal < SHIP_PART_CRAFTING_COST.scrapMetal
              || progress.copper < SHIP_PART_CRAFTING_COST.copper
              || progress.radioactiveResidue < SHIP_PART_CRAFTING_COST.radioactiveResidue
              || !canStoreShipPart(progress)
            }
            onClick={craftPart}
          >
            <span>
              {ui.garageCraft} • {SHIP_PART_CRAFTING_COST.credits} KS / {SHIP_PART_CRAFTING_COST.scrapMetal} {language === 'pl' ? 'stop' : 'alloy'} / {SHIP_PART_CRAFTING_COST.copper} Cu / {SHIP_PART_CRAFTING_COST.radioactiveResidue} R
            </span>
            <span aria-hidden="true">✦</span>
          </button>
          {!canStoreShipPart(progress) && (
            <p className="garage-insufficient" role="status">{ui.garageFull}</p>
          )}

          <h2 className="garage-section-title">{ui.garageParts}</h2>
          <p className="garage-sell-hint">{ui.garageSellHint}</p>
          {progress.shipParts.length === 0
            ? <p className="garage-empty-parts">{ui.garageEmptyParts}</p>
            : (
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
                      title={`${statLabels}${isEquipped ? '' : ` · ${ui.garageSellHint} ${getShipPartSellValue(part)} KS`}`}
                      onContextMenu={(event) => {
                        if (isEquipped) return
                        event.preventDefault()
                        sellPart(part.id)
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
                          title={canEquip ? undefined : `${ui.garageLevelRequired}: ${requiredLevel}`}
                          onClick={() => updateSavedProgress((current) => equipShipPart(current, part.id))}
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
                          onClick={() => updateSavedProgress((current) => rerollShipPart(current, part.id))}
                        >
                          {ui.garageReroll} • {SHIP_PART_REROLL_COST.credits} KS
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

          <button className="primary-action utility-back garage-back" type="button" onClick={leaveGarage}>
            <span>{ui.garageBack}</span>
            <span aria-hidden="true">←</span>
          </button>
          </section>
        )}
        <PilotProgressBar
          experience={displayedExperience}
          language={language}
        />
        {inventoryOpen && (
          <PilotInventory
            progress={progress}
            language={language}
            canSell
            onClose={() => setInventoryOpen(false)}
            onEquip={(partId) => updateSavedProgress((current) => equipShipPart(current, partId))}
            onUnequip={(slot) => updateSavedProgress((current) => unequipShipPart(current, slot))}
            onSell={sellPart}
          />
        )}
      </main>
    )
  }

  if (screen === 'quit') {
    return (
      <main className="main-menu utility-screen">
        <section className="utility-content">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="utility-title">{ui.quitTitle}</h1>
          <p className="lead quit-message">{ui.quitMessage}</p>
          <button className="primary-action utility-back" onClick={() => setScreen('title')}>
            <span>{ui.back}</span>
            <span aria-hidden="true">←</span>
          </button>
        </section>
      </main>
    )
  }

  if (screen === 'title') {
    return (
      <main className="main-menu title-screen">
        <div className="menu-grid" aria-hidden="true" />
        <section className="menu-content title-content">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lead">{copy.lead}</p>
          <nav className="title-actions" aria-label={ui.mainMenu}>
            <button className="primary-action" onClick={requestNewGame}>
              <span>{ui.newGame}</span><span aria-hidden="true">→</span>
            </button>
            <button className="menu-action" disabled={!hasSave} onClick={loadGame}>
              <span>{ui.loadGame}</span><span aria-hidden="true">↗</span>
            </button>
            {!hasSave && <p className="save-status">{ui.noSave}</p>}
            <button className="menu-action" onClick={() => openSettings('title')}>{ui.settings}</button>
            <button className="menu-action" onClick={() => openCredits('title')}>{ui.credits}</button>
            <button
              className="menu-action danger-action"
              onClick={() => {
                if (window.opener) {
                  window.close()
                  return
                }
                setScreen('quit')
              }}
            >
              {ui.quit}
            </button>
          </nav>
          <div className="title-footer">
            <span>OST / 01</span>
            <button
              className="language-button"
              type="button"
              aria-label={language === 'pl' ? 'Change language' : 'Zmień język'}
              onClick={() => updateSettings({ language: language === 'pl' ? 'en' : 'pl' })}
            >
              {language === 'pl' ? 'EN' : 'PL'}
            </button>
          </div>
        </section>
        {confirmNewGame && (
          <div className="modal-backdrop">
            <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-new-game-title">
              <p className="campaign-kicker">{ui.mainMenu}</p>
              <h2 id="confirm-new-game-title">{ui.confirmTitle}</h2>
              <p>{ui.confirmMessage}</p>
              <div className="dialog-actions">
                <button className="menu-action" onClick={() => setConfirmNewGame(false)}>{ui.cancel}</button>
                <button className="primary-action" onClick={startNewGame}>{ui.confirm}</button>
              </div>
            </section>
          </div>
        )}
      </main>
    )
  }

  return <NavigationJournal language={language} progress={progress} activeMission={activeMission} trackedStationId={trackedStationId}
    onClose={() => setScreen(journalReturnScreen)}
    onTrackMission={id => { setTrackedStationId(null); setTrackedMissionId(id) }}
    onTrackStation={setTrackedStationId} />
  }

  const worldMounted = worldSessionActive && screen !== 'title' && screen !== 'quit' && (screen !== 'garage' || departureStationId !== null) && !(screen === 'campaign' && journalReturnScreen === 'garage')
  return <>
    {worldMounted && <div className="persistent-world-layer" style={{ visibility: screen === 'exploration' ? 'visible' : 'hidden' }} aria-hidden={screen !== 'exploration'}>
      <Suspense fallback={<div className="game-loading" role="status">{language === 'pl' ? 'Ładowanie galaktyki…' : 'Loading galaxy…'}</div>}>
        <SectorCanvas key={worldSessionKey}
          language={language} graphicsQuality={settings.graphicsQuality} controls={settings.controls}
          mouseSensitivity={settings.mouseSensitivity} mainVolume={settings.mainVolume} shotsVolume={settings.shotsVolume} musicVolume={settings.musicVolume}
          shipBonuses={shipBonuses} equippedPartRarities={equippedPartRarities} progress={progress} activeMission={activeMission} trackedStationId={trackedStationId}
          paused={screen !== 'exploration' || inventoryOpen || statisticsOpen || pauseOpen || pauseSettingsOpen} renderActive={screen === 'exploration' && !statisticsOpen}
          onPlanetScan={collectPlanet} onDroneDefeated={defeatDrone} onSectorPositionChange={updateSectorPositionSaved}
          onMissionComplete={completeMission} onMissionObjectiveProgress={updateMissionObjective}
          onTrackStation={setTrackedStationId}
          onShipStatusChange={updateShipTelemetry}
          departureStationId={departureStationId} onReady={() => setDepartureWorldReady(true)} onDepartureComplete={finishDeparture}
          dockingReady={garageReady} onDockingStart={beginDocking} onDockingComplete={finishDocking} onCombatStateChange={setCombatActive}
        />
      </Suspense>
    </div>}
    {dockingStationId && <div className={screen === 'garage' ? 'persistent-garage-layer visible' : 'persistent-garage-layer'} aria-hidden={screen !== 'garage'}>
      {GarageScene && <GarageScene key={dockingStationId} equippedPartRarities={equippedPartRarities} entering={screen === 'garage'} paused={statisticsOpen || inventoryOpen}
        departing={departureStationId !== null} departureReady={departureWorldReady} onDeparted={() => setScreen('exploration')}
        onReady={() => setGarageReady(true)} onLandingStageChange={setGarageLandingStage} onLanded={() => { setGarageLanded(true); applicationAudio.current?.playUiSound('dock') }} />}
    </div>}
    <div className={screen === 'exploration' || screen === 'garage' ? 'app-screen-overlay app-screen-flight' : 'app-screen-overlay'}>{renderScreen()}</div>
    {statisticsOpen && <ShipStatisticsPanel progress={progress} telemetry={statisticsTelemetry} language={language} quality={settings.graphicsQuality} onClose={() => setStatisticsOpen(false)} />}
  </>
}

export default App
