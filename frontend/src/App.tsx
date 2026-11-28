import { formatControlKey, gameText } from './game/i18n'
import { createNewCampaign, getInitialRepairStation, prepareWorld, recoverShipAtHangar } from './game/progress/worldSession'
import { RECOVERY_COMPLETE_MASK } from './game/simulation/ShipRecovery'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles/App.scss'
import { getNextCampaignMission, isMissionComplete, isMissionUnlocked, MISSIONS, type MissionId } from './game/missions/definitions'
import { FLIGHT_COMMANDS, type FlightCommand } from './game/input/InputController'
import { findNearestStation, getGalaxyWorld, ORION_SECTOR_ID, type SectorPosition } from './game/domain/exploration'
import { GALAXY_ARRIVAL, getGalaxy, type GalaxyId } from './game/domain/galaxyChart'
import {
  applyDroneLoot,
  applyPlanetLoot,
  collectCollectible,
  plantCollectible,
  uprootCollectible,
  refreshAchievements,
  completeWorldMission,
  chooseCampaignEnding,
  recordMissionObjectiveProgress,
  canStoreShipPart,
  craftRandomShipPart,
  equipShipPart,
  getShipBonuses,
  learnPilotSkill,
  unequipShipPart,
  restoreDroneSpawn,
  acceptSideMission,
  registerSideMissionKill,
  purchaseShip,
  selectShip,
  investigateSignal,
  hasMissionProgress,
  loadMissionProgress,
  rerollShipPart,
  rollDroneLoot,
  rollPlanetLoot,
  saveMissionProgress,
  sellShipPart,
  updateSectorPosition,
  SHIP_PART_CRAFTING_COST,
  type MissionProgress,
} from './game/progress/missionProgress'
import { rollAsteroidLoot } from './game/domain/asteroidBelt'
import type { SideMissionId } from './game/domain/sideMissions'
import {
  getEquippedPartRarities,
} from './game/progress/shipParts'
import { HANGAR_CONVERSATIONS, HANGAR_CREW } from './game/hangar/crew'
import PilotInventory from './game/ui/PilotInventory'
import { MaterialArtwork } from './game/ui/EquipmentArtwork'
import { GaragePartsList } from './game/ui/GaragePartsList'
import './styles/ui/GarageArtwork.scss'
import { PilotProgressBar } from './game/ui/PilotProgressBar'
import { GamePauseOverlay } from './game/ui/GamePauseOverlay'
import { GameLoadingScreen } from './game/ui/GameLoadingScreen'
import { ShipStatisticsPanel } from './game/ui/ShipStatisticsPanel'
import { ShipyardPanel } from './game/ui/ShipyardPanel'
import { HangarMaintenancePanel } from './game/ui/HangarMaintenancePanel'
import type { CameraMode } from './game/simulation/CockpitCamera'
import { COLLECTIBLES } from './game/domain/collectibles'
import { CHARACTER, INTRO_BEATS } from './game/domain/starfall'
import { ShipStatusHud } from './game/ui/ShipStatusHud'
import { NavigationJournal } from './game/ui/NavigationJournal'
import { GalaxyTravel } from './game/ui/GalaxyTravel'
import { GraphicsOptions } from './game/ui/GraphicsOptions'
import { LanguageSetting } from './game/ui/LanguageSetting'
import { MouseSensitivitySetting, VolumeSettings } from './game/ui/SettingsSliders'
import { ActionIcon, IconButton } from './game/ui/ActionIcon'
import { FixedControls } from './game/ui/FixedControls'
import { MerchantPanel } from './game/ui/MerchantPanel'
import { useApplicationAudio } from './game/audio/useApplicationAudio'
import { getShipVitals, rechargeShipShields, regenerateHangarHull, updateShipVitals } from './game/progress/shipMaintenance'
import { getMaximumShipVitals } from './game/domain/shipTelemetry'
import type { HangarLandingStage } from './game/simulation/HangarLanding'
import type { ShipTelemetry } from './game/domain/shipTelemetry'
import {
  loadGameSettings,
  saveGameSettings,
  type GameSettings,
} from './game/progress/gameSettings'

const loadSectorCanvas = () => import('./game/renderer/SectorCanvas')
const loadShipRecovery = () => import('./game/ui/ShipRecovery')
const StarfallBossCanvas = lazy(() => import('./game/renderer/StarfallBossCanvas').then(module => ({ default: module.StarfallBossCanvas })))
const MegastationInteriorCanvas = lazy(() => import('./game/renderer/MegastationInteriorCanvas').then(module => ({ default: module.MegastationInteriorCanvas })))
const IntroCutscene = lazy(() => import('./game/ui/IntroCutscene').then(module => ({ default: module.IntroCutscene })))
const ShipInteriorCanvas = lazy(() => import('./game/renderer/ShipInteriorCanvas').then(module => ({ default: module.ShipInteriorCanvas })))
const SectorCanvas = lazy(() => loadSectorCanvas().then((module) => ({
  default: module.SectorCanvas,
})))
const ShipRecovery = lazy(() => loadShipRecovery().then(module => ({ default: module.ShipRecovery })))
type GarageSceneComponent = typeof import('./game/renderer/GarageCanvas')['GarageCanvas']

type Screen = 'intro' | 'prologue' | 'boss' | 'title' | 'campaign' | 'garage' | 'shipInterior' | 'exploration' | 'megastation' | 'settings' | 'credits' | 'quit'
type ReturnScreen = 'title' | 'campaign' | 'exploration'
const HANGAR_REPAIR_TICK_MS = 500
/** How often (ms) the hangar ambient crew conversation advances. */
const HANGAR_AMBIENT_LINE_MS = 9000

function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [interiorReturn, setInteriorReturn] = useState<Screen>('garage')
  const [prologueLaunching, setPrologueLaunching] = useState(false)
  const [introOpen, setIntroOpen] = useState(true)
  const [journalReturnScreen, setJournalReturnScreen] = useState<'exploration' | 'garage'>('exploration')
  const [returnScreen, setReturnScreen] = useState<ReturnScreen>('title')
  const [settings, setSettings] = useState(loadGameSettings)
  const [progress, setProgress] = useState(() => prepareWorld(loadMissionProgress()))
  const [hasSave, setHasSave] = useState(hasMissionProgress)
  const [confirmNewGame, setConfirmNewGame] = useState(false)
  const [garagePanelOpen, setGaragePanelOpen] = useState(true)
  const [shipyardOpen, setShipyardOpen] = useState(false)
  const [garageWalkMode, setGarageWalkMode] = useState(false)
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase')
  const [radioOn, setRadioOn] = useState(true)
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
  const dockingStationRef = useRef<string | null>(null)
  const [garageReady, setGarageReady] = useState(false)
  const [garageLanded, setGarageLanded] = useState(false)
  const [garageLandingStage, setGarageLandingStage] = useState<HangarLandingStage>('approach')
  const [departureStationId, setDepartureStationId] = useState<string | null>(null)
  const [departureWorldReady, setDepartureWorldReady] = useState(false)
  const [GarageScene, setGarageScene] = useState<GarageSceneComponent | null>(null)
  const [combatActive, setCombatActive] = useState(false)
  const [merchantOpen, setMerchantOpen] = useState(false)
  const [galaxyChartOpen, setGalaxyChartOpen] = useState(false)
  const [jumpDestination, setJumpDestination] = useState<GalaxyId | null>(null)
  const [boundaryCourse, setBoundaryCourse] = useState(false)
  const [boundaryReleaseId, setBoundaryReleaseId] = useState(0)
  const routeActive = galaxyChartOpen || jumpDestination !== null || boundaryCourse
  const language = settings.language
  useEffect(() => { document.documentElement.lang = language }, [language])
  const world = useMemo(() => getGalaxyWorld(progress.sectorId, progress.worldSeed), [progress.sectorId, progress.worldSeed])
  const applicationAudio = useApplicationAudio(screen, { main: settings.mainVolume, shots: settings.shotsVolume, music: settings.musicVolume })
  const repairStation = progress.initialRepairRequired ? getInitialRepairStation(world) : undefined
  const navigationStationId = repairStation?.id ?? trackedStationId
  const activeMission = !progress.initialRepairRequired && world.galaxy.id === ORION_SECTOR_ID
    ? trackedMissionId && !isMissionComplete(progress, trackedMissionId) && isMissionUnlocked(progress, trackedMissionId)
      ? trackedMissionId : getNextCampaignMission(progress)
    : null
  const displayedExperience = progress.experience
  const equippedPartRarities = getEquippedPartRarities(progress.shipParts, progress.equippedParts)
  const updateShipTelemetry = useCallback((telemetry: ShipTelemetry) => { shipTelemetryRef.current = telemetry }, [])
  const setDockingStation = useCallback((id: string | null) => {
    dockingStationRef.current = id
    setDockingStationId(id)
  }, [])

  const updateSettings = useCallback((change: Partial<GameSettings>) => {
    const next = { ...settings, ...change }
    saveGameSettings(next)
    setSettings(next)
  }, [settings])

  const closeGalaxyChart = useCallback(() => {
    setJumpDestination(null)
    setGalaxyChartOpen(false)
    setBoundaryCourse(false)
    setBoundaryReleaseId(id => id + 1)
  }, [])

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
    }, HANGAR_AMBIENT_LINE_MS)
    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen !== 'campaign' && screen !== 'exploration' && screen !== 'garage') return
    const toggleJournal = (event: KeyboardEvent) => {
      if ((event.code !== 'KeyL' && event.code !== 'KeyM') || event.repeat || rebindingCommand || statisticsOpen || inventoryOpen || pauseOpen || pauseSettingsOpen || merchantOpen || routeActive) return
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
  }, [screen, journalReturnScreen, rebindingCommand, statisticsOpen, inventoryOpen, pauseOpen, pauseSettingsOpen, departureStationId, garageLanded, dockingStationId, merchantOpen, routeActive])

  useEffect(() => {
    if (screen !== 'campaign' && screen !== 'exploration' && screen !== 'garage') return

    const handleStatisticsShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && statisticsOpen) {
        event.preventDefault()
        event.stopImmediatePropagation()
        setStatisticsOpen(false)
        return
      }
      if (event.code !== 'KeyC' || event.repeat || rebindingCommand || pauseOpen || pauseSettingsOpen || merchantOpen || routeActive) return
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
  }, [screen, statisticsOpen, rebindingCommand, pauseOpen, pauseSettingsOpen, garageLanded, dockingStationId, departureStationId, merchantOpen, routeActive])

  useEffect(() => {
    if (screen !== 'exploration' && screen !== 'garage') return
    const handleInventoryShortcut = (event: KeyboardEvent) => {
      if (event.code === 'KeyI' && !event.repeat && !combatActive && !rebindingCommand && !departureStationId
        && (screen === 'garage' ? garageLanded : !dockingStationId) && !merchantOpen && !routeActive && !pauseOpen && !pauseSettingsOpen) {
        const target = event.target
        if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
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
  }, [combatActive, dockingStationId, inventoryOpen, screen, garageLanded, departureStationId, rebindingCommand, merchantOpen, routeActive, pauseOpen, pauseSettingsOpen])

  useEffect(() => {
    if (screen !== 'exploration') return
    const handleFlightToggles = (event: KeyboardEvent) => {
      if (event.repeat || rebindingCommand || statisticsOpen || inventoryOpen || pauseOpen || pauseSettingsOpen || merchantOpen || routeActive) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (event.code === 'KeyV') {
        event.preventDefault()
        setCameraMode(mode => mode === 'chase' ? 'cockpit' : 'chase')
      } else if (event.code === 'KeyR') {
        event.preventDefault()
        setRadioOn(on => !on)
      }
    }
    window.addEventListener('keydown', handleFlightToggles, true)
    return () => window.removeEventListener('keydown', handleFlightToggles, true)
  }, [screen, rebindingCommand, statisticsOpen, inventoryOpen, pauseOpen, pauseSettingsOpen, merchantOpen, routeActive])

  const showShipStatistics = () => {
    setStatisticsTelemetry(screen === 'garage' ? null : shipTelemetryRef.current)
    setInventoryOpen(false)
    setStatisticsOpen(true)
  }

  useEffect(() => {
    if (screen !== 'exploration') return

    const handlePauseShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || rebindingCommand || dockingStationRef.current) return
      event.preventDefault()
      if (jumpDestination) return
      if (galaxyChartOpen || merchantOpen || boundaryCourse) {
        closeGalaxyChart()
        setMerchantOpen(false)
        return
      }
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
  }, [inventoryOpen, pauseSettingsOpen, rebindingCommand, screen, galaxyChartOpen, merchantOpen, boundaryCourse, jumpDestination, closeGalaxyChart])

  const startNewGame = () => {
    void loadShipRecovery()
    const fresh = createNewCampaign()
    setPrologueLaunching(false)
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
    setDockingStation(null)
    setGarageReady(false)
    setGarageLanded(false)
    setCombatActive(false)
    setDepartureStationId(null)
    setDepartureWorldReady(false)
    setWorldSessionActive(false)
    setWorldSessionKey(key => key + 1)
    setScreen('intro')
  }

  const exitGameplay = () => {
    setStatisticsOpen(false)
    setPauseOpen(false)
    setPauseSettingsOpen(false)
    setInventoryOpen(false)
    setDepartureStationId(null)
    setDepartureWorldReady(false)
    setWorldSessionActive(false)
    setDockingStation(null)
    setScreen('title')
  }

  const requestNewGame = () => {
    if (hasSave) {
      setConfirmNewGame(true)
      return
    }
    startNewGame()
  }

  const prepareHangar = useCallback((id: string, landed: boolean) => {
    setInventoryOpen(false)
    setStatisticsOpen(false)
    setPauseOpen(false)
    setPauseSettingsOpen(false)
    setGarageReady(false)
    setGarageLanded(landed)
    setGaragePanelOpen(true)
    setGaragePanelExpanded(false)
    setGarageLandingStage(landed ? 'landed' : 'approach')
    setDockingStation(id)
    // Mount the prepared scene before switching away from the flight view during docking.
    void import('./game/renderer/GarageCanvas').then(module => {
      setGarageScene(() => module.GarageCanvas)
    })
  }, [setDockingStation])

  const loadGame = () => {
    if (!hasSave) return
    let savedProgress = prepareWorld(loadMissionProgress())
    if (savedProgress.prologueComplete) void loadSectorCanvas()
    else void loadShipRecovery()
    const savedStation = savedProgress.recoveryStationId
      ? getGalaxyWorld(savedProgress.sectorId, savedProgress.worldSeed).stations.find(station => station.id === savedProgress.recoveryStationId)
      : undefined
    if (!savedStation && savedProgress.recoveryStationId) {
      savedProgress = { ...savedProgress, recoveryStationId: null }
      saveMissionProgress(savedProgress)
    }
    setPrologueLaunching(false)
    setProgress(savedProgress)
    setStatisticsOpen(false)
    shipTelemetryRef.current = null
    setInventoryOpen(false)
    setDepartureStationId(null)
    setDepartureWorldReady(false)
    setWorldSessionActive(savedProgress.prologueComplete)
    setWorldSessionKey(key => key + 1)
    setCombatActive(false)
    if (savedStation) {
      prepareHangar(savedStation.id, true)
      setScreen('garage')
    } else {
      setDockingStation(null)
      setGarageReady(false)
      setGarageLanded(false)
      setScreen(savedProgress.prologueComplete ? 'exploration' : 'prologue')
    }
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
    const next = refreshAchievements(update(current))
    if (next === current) return
    saveMissionProgress(next)
    setProgress(next)
    setHasSave(true)
  }, [])

  useEffect(() => {
    const inHangar = screen === 'garage' || (screen === 'campaign' && journalReturnScreen === 'garage')
    if (!inHangar || !garageLanded || departureStationId) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const seconds = Math.max(0, (now - previous) / 1000)
      previous = now
      updateSavedProgress(current => regenerateHangarHull(current, seconds))
    }, HANGAR_REPAIR_TICK_MS)
    return () => window.clearInterval(timer)
  }, [screen, journalReturnScreen, garageLanded, departureStationId, updateSavedProgress])

  const collectPlanet = useCallback((planetId: string) => {
    updateSavedProgress(current => {
      let next = applyPlanetLoot(current, planetId, rollPlanetLoot())
      if (current.initialRepairRequired) return next
      const seed = [...planetId].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0)
      next = collectCollectible(next, COLLECTIBLES[seed % COLLECTIBLES.length].id)
      for (const mission of MISSIONS) {
        if (mission.objective === 'survey-planet' && mission.sectorTarget?.id === planetId) next = completeWorldMission(next, mission.id)
      }
      return next
    })
  }, [updateSavedProgress])

  const defeatDrone = useCallback((droneId: string, respawnAt?: number) => {
    updateSavedProgress(current => registerSideMissionKill(applyDroneLoot(current, droneId, rollDroneLoot(), respawnAt)))
  }, [updateSavedProgress])

  const defeatAsteroid = useCallback((asteroidId: string, beltId: string) => {
    updateSavedProgress(current => {
      const belt = world.asteroidBelts.find(site => site.id === beltId)
      const loot = rollAsteroidLoot(belt ?? { id: beltId, x: 0, y: 0, z: 0, innerRadius: 0, outerRadius: 0, count: 0, resourceProfile: 'ferrous' })
      return applyDroneLoot(current, `asteroid:${asteroidId}`, loot)
    })
  }, [updateSavedProgress, world])

  const completeMission = useCallback((id: MissionId) => {
    updateSavedProgress(current => completeWorldMission(current, id))
  }, [updateSavedProgress])

  const updateMissionObjective = useCallback((id: MissionId, count: number) => {
    updateSavedProgress(current => recordMissionObjectiveProgress(current, id, count))
  }, [updateSavedProgress])

  const beginDocking = useCallback((id: string) => {
    if (world.stations.some(station => station.id === id)) prepareHangar(id, false)
  }, [prepareHangar, world.stations])

  const recoverDestroyedShip = useCallback((position: SectorPosition, origin: GalaxyId) => {
    if (origin !== world.galaxy.id) return
    const station = findNearestStation(position, world.stations)
    let recovered = false
    updateSavedProgress(current => {
      if (current.sectorId !== origin || current.recoveryStationId) return current
      recovered = true
      return recoverShipAtHangar(current, station)
    })
    if (!recovered) return
    shipTelemetryRef.current = null
    setCombatActive(false)
    setMerchantOpen(false)
    setGalaxyChartOpen(false)
    setBoundaryCourse(false)
    setJumpDestination(null)
    setDepartureStationId(null)
    setDepartureWorldReady(false)
    prepareHangar(station.id, true)
    setScreen('garage')
  }, [prepareHangar, updateSavedProgress, world])

  const finishDocking = useCallback((id: string) => {
    if (id === dockingStationId && garageReady) setScreen('garage')
  }, [dockingStationId, garageReady])

  const leaveGarage = useCallback(() => {
    if (!garageLanded || departureStationId || progress.initialRepairRequired) return
    const station = world.stations.find(site => site.id === dockingStationId)
    if (!station) return
    updateSavedProgress(current => updateSectorPosition(current.recoveryStationId ? { ...current, recoveryStationId: null } : current,
      world.galaxy.id, station.launchPosition.z, station.launchPosition.x, station.launchPosition.y))
    setInventoryOpen(false)
    setStatisticsOpen(false)
    setGarageWalkMode(false)
    shipTelemetryRef.current = null
    setDepartureWorldReady(false)
    void loadSectorCanvas()
    setDepartureStationId(station.id)
    setCombatActive(false)
    setWorldSessionKey(key => key + 1)
  }, [dockingStationId, garageLanded, departureStationId, progress.initialRepairRequired, updateSavedProgress, world])

  const finishDeparture = useCallback(() => {
    setDepartureStationId(null)
    setDockingStation(null)
    setGarageReady(false)
    setGarageLanded(false)
  }, [setDockingStation])

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

  const updateSectorPositionSaved = useCallback((position: SectorPosition, origin: GalaxyId) => {
    updateSavedProgress((current) => {
      if (current.sectorId !== origin || current.recoveryStationId) return current
      const next = updateSectorPosition(current, origin, position.z, position.x, position.y)
      return shipTelemetryRef.current ? updateShipVitals(next, shipTelemetryRef.current) : next
    })
  }, [updateSavedProgress])

  const showGalaxyChart = useCallback(() => {
    if (progress.initialRepairRequired) return
    setBoundaryCourse(false)
    setGalaxyChartOpen(true)
  }, [progress.initialRepairRequired])

  const finishGalaxyJump = useCallback((destination: GalaxyId, origin: GalaxyId) => {
    const lastTelemetry = shipTelemetryRef.current
    updateSavedProgress(current => {
      if (current.sectorId !== origin || destination === origin) return current
      const withVitals = lastTelemetry ? updateShipVitals(current, lastTelemetry) : current
      return { ...updateSectorPosition(withVitals, destination, GALAXY_ARRIVAL.z, GALAXY_ARRIVAL.x, GALAXY_ARRIVAL.y), orbitPlanetId: null }
    })
    setTrackedStationId(null)
    setJumpDestination(null)
    setGalaxyChartOpen(false)
    setCombatActive(false)
    shipTelemetryRef.current = null
  }, [updateSavedProgress])

  const craftPart = () => {
    updateSavedProgress((current) => craftRandomShipPart(current, `module-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`))
  }

  const sellPart = (partId: string) => {
    updateSavedProgress((current) => sellShipPart(current, partId))
  }

  const copy = gameText(language).application.copy

  const ui = gameText(language).application.ui

  const controlLabels: Record<FlightCommand, string> = {
    pitchUp: ui.pitchUp,
    pitchDown: ui.pitchDown,
    yawLeft: ui.yawLeft,
    yawRight: ui.yawRight,
    rollLeft: ui.rollLeft,
    rollRight: ui.rollRight,
    boost: gameText(language).application.halfEngineThrust,
    fullBoost: gameText(language).application.fullEngineThrust,
    brake: ui.brake,
    fire: ui.fire,
    dodge: ui.dodge,
    lights: gameText(language).application.shipHeadlights,
    overdrive: gameText(language).application.driveOvercharge,
  }
  const shipBonuses = getShipBonuses(progress)
  const hangarMaximum = getMaximumShipVitals(progress.shieldLevel, shipBonuses)
  const hangarVitals = getShipVitals(progress, hangarMaximum)

  const renderScreen = () => {
  if (screen === 'shipInterior') return <Suspense fallback={<GameLoadingScreen label={gameText(language).application.loadingGalaxy} />}>
    <ShipInteriorCanvas language={language} graphics={settings} onExit={() => setScreen(interiorReturn)} />
  </Suspense>
  if (screen === 'intro') return <Suspense fallback={<GameLoadingScreen label={gameText(language).application.loadingGalaxy} />}>
    <IntroCutscene language={language} onDone={() => setScreen('prologue')} />
  </Suspense>
  if (screen === 'megastation') return <Suspense fallback={<GameLoadingScreen label={gameText(language).application.loadingGalaxy} />}>
    <MegastationInteriorCanvas language={language} graphics={settings}
      acceptedSideMissionIds={progress.sideMissions?.accepted ?? []}
      completedSideMissionIds={progress.sideMissions?.completed ?? []}
      onAcceptSideMission={id => updateSavedProgress(current => acceptSideMission(current, id as SideMissionId))}
      onExit={() => setScreen('exploration')} />
  </Suspense>
  if (screen === 'boss') return <Suspense fallback={<GameLoadingScreen label={gameText(language).application.loadingGalaxy} />}>
    <StarfallBossCanvas language={language} graphics={settings}
      onVictory={() => setScreen('prologue')} onDefeat={() => setScreen('prologue')} />
  </Suspense>
  if (screen === 'prologue') return <Suspense fallback={<GameLoadingScreen label={gameText(language).application.loadingTheSurface} />}>
    <ShipRecovery planet={world.planets[0]} language={language} worldSeed={progress.worldSeed} repairMask={progress.repairMask} graphics={settings}
      launching={prologueLaunching} worldReady={departureWorldReady} volume={settings.mainVolume}
      onRepair={mask => updateSavedProgress(current => ({ ...current, repairMask: current.repairMask | mask }))}
      onLaunch={() => { if (progress.repairMask !== RECOVERY_COMPLETE_MASK) return; void loadSectorCanvas(); setDepartureWorldReady(false); setPrologueLaunching(true); setWorldSessionActive(true) }}
      onFinished={() => { updateSavedProgress(current => ({ ...current, prologueComplete: true })); setScreen('exploration'); setPrologueLaunching(false) }}
      onExit={exitGameplay} />
    {introOpen && !prologueLaunching && <div className="intro-sequence" role="dialog" aria-modal="true" aria-label={CHARACTER.name[language]}
      style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(3,6,14,0.86)', padding: 24 }}>
      <div className="intro-card" style={{ maxWidth: 560, display: 'grid', gap: 12 }}>
        <p className="eyebrow">{CHARACTER.role[language]}</p>
        <h2>{CHARACTER.name[language]}</h2>
        {INTRO_BEATS.map((beat, index) => <p key={index}>{beat[language]}</p>)}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="primary-action" autoFocus onClick={() => setIntroOpen(false)}>{gameText(language).application.prologueContinue}</button>
        </div>
      </div>
    </div>}
  </Suspense>
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
            quality={settings.graphicsQuality}
            hullFraction={hangarVitals.hull / hangarMaximum.hull}
            canSell={false}
            canRefit={false}
            onOpenStatistics={showShipStatistics}
            onClose={() => setInventoryOpen(false)}
            onEquip={(partId) => updateSavedProgress((current) => equipShipPart(current, partId))}
            onUnequip={(slot) => updateSavedProgress((current) => unequipShipPart(current, slot))}
            onSell={sellPart}
          />
        )}
        {merchantOpen && <MerchantPanel language={language} merchant={world.merchant} progress={progress} onClose={() => setMerchantOpen(false)} onTrade={updateSavedProgress} />}
        {galaxyChartOpen && <GalaxyTravel language={language} origin={world.galaxy} jumpingTo={jumpDestination ? getGalaxy(jumpDestination) : null}
          onClose={closeGalaxyChart} onCancelJump={closeGalaxyChart} onJump={setJumpDestination} />}
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
            <IconButton icon="close" className="settings-close" label={gameText(language).application.closeSettings} onClick={closeSettings} />
          </header>
          <div
            className="utility-panel settings-body"
            role="region"
            aria-label={gameText(language).application.gameOptions}
            tabIndex={0}
          >
            <LanguageSetting language={language} className="setting-row" onChange={selected => updateSettings({ language: selected })} />
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
            <GraphicsOptions settings={settings} onChange={updateSettings} />
            <MouseSensitivitySetting settings={settings} onChange={updateSettings} />
            <p className="settings-hint">{ui.mouseSensitivityHint}</p>
            <VolumeSettings settings={settings} onChange={updateSettings} />
            <div className="controls-reference">
              <strong>{ui.controls}</strong>
              <FixedControls language={language} />
              <p role={rebindingCommand ? 'status' : undefined}>
                {rebindingCommand ? ui.pressKey : ui.controlsHint}
              </p>
              <div className="keybindings">
                {FLIGHT_COMMANDS.map((command) => (
                  <div className={`keybinding-row${rebindingCommand === command ? ' is-rebinding' : ''}`} key={command}>
                    <span>{controlLabels[command]}</span>
                    <button
                      type="button"
                      className={`binding-button${rebindingCommand === command ? ' is-rebinding' : ''}`}
                      aria-label={`${ui.rebind}: ${controlLabels[command]}`}
                      onClick={() => setRebindingCommand(command)}
                    >
                      {rebindingCommand === command
                        ? ui.pressKey
                        : formatControlKey(settings.controls[command], language)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <footer className="settings-footer">
            <p>{gameText(language).application.changesAreSavedAutomatically}</p>
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
            <p><span>{ui.creditsGame}</span><strong>{gameText(language).common.projectName}</strong></p>
            <p><span>{ui.creditsStory}</span><strong>{gameText(language).application.creditsChapter}</strong></p>
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
    <div className="station-landing-status" role="status">{gameText(language).application.takeoffLeavingHangar}</div>
  )

  if (screen === 'garage' && !garageLanded) return (
    <div className="station-landing-status" role="status">{garageLandingStage === 'deploying'
      ? (gameText(language).application.landingDeployingLandingGear)
      : garageLandingStage === 'touchdown'
        ? (gameText(language).application.gearExtendedTouchingDown)
        : (gameText(language).application.landingApproachingThePad)}
    </div>
  )

  if (screen === 'garage') {
    const ambientConversation = HANGAR_CONVERSATIONS[ambientLineIndex]
    const dock = world.stations.find(station => station.id === dockingStationId)

    return (
      <main className="planetary-garage">
        <ShipStatusHud language={language} shield={hangarVitals.shield} maxShield={hangarMaximum.shield} hull={hangarVitals.hull} maxHull={hangarMaximum.hull} />
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
            <span>{dock?.planetId ? (gameText(language).application.planetaryHangar)
              : (gameText(language).application.orbitalStationHangar)}</span>
            <strong>{dock?.name[language]}</strong>
          </div>
          <div className="garage-toolbar-actions">
            <IconButton icon="journal" label={gameText(language).journal.navigationJournal}
              onClick={() => { setJournalReturnScreen('garage'); setScreen('campaign') }} />
            <IconButton icon="stats" label={gameText(language).statistics.shipStatistics} onClick={showShipStatistics} />
            <IconButton icon="inventory" label={gameText(language).statistics.inventory} onClick={() => setInventoryOpen(true)} />
            <IconButton icon="shipyard" label={language === 'pl' ? 'Stocznia' : 'Shipyard'} onClick={() => setShipyardOpen(true)} />
            {garageLanded && !departureStationId && (
              <IconButton icon="walk" className="garage-panel-toggle" label={garageWalkMode ? ui.garageExitWalk : ui.garageWalk}
                aria-pressed={garageWalkMode} onClick={() => { setGarageWalkMode(walk => !walk); setGaragePanelOpen(false) }} />
            )}
            <IconButton icon="panel" className="garage-panel-toggle" label={garagePanelOpen ? ui.garageHidePanel : ui.garageShowPanel}
              aria-expanded={garagePanelOpen} onClick={() => setGaragePanelOpen(open => !open)} />
            {garagePanelOpen && (
              <IconButton icon={garagePanelExpanded ? 'collapse' : 'expand'} className="garage-panel-toggle"
                label={garagePanelExpanded ? ui.garageShrinkPanel : ui.garageExpandPanel}
                aria-expanded={garagePanelExpanded} onClick={() => setGaragePanelExpanded(expanded => !expanded)} />
            )}
            <IconButton icon="close" className="garage-exit" label={ui.garageExit}
              tooltip={progress.initialRepairRequired ? gameText(language).maintenance.initialRepairLock : ui.garageExit}
              disabled={progress.initialRepairRequired} onClick={leaveGarage} />
          </div>
        </header>
        {garagePanelOpen && (
          <section
            className={`garage-interface${garagePanelExpanded ? ' expanded' : ''}`}
            aria-label={ui.garageTitle}
          >
          <div className="garage-interface-heading">
            <p className="eyebrow">{world.galaxy.name}</p>
            <h1>{ui.garageTitle}</h1>
            <p>{gameText(language).application.theStationCrewRepairsAndUpgrades}</p>
            <div className="garage-balance">
              <span><MaterialArtwork kind="credits" />{ui.garageBalance}</span>
              <strong>{progress.credits} KS</strong>
            </div>
          </div>

          <HangarMaintenancePanel progress={progress} language={language} onRecharge={() => updateSavedProgress(rechargeShipShields)} />

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
              {ui.garageCraft} • {SHIP_PART_CRAFTING_COST.credits} KS / {SHIP_PART_CRAFTING_COST.scrapMetal} {gameText(language).application.alloy} / {SHIP_PART_CRAFTING_COST.copper} Cu / {SHIP_PART_CRAFTING_COST.radioactiveResidue} R
            </span>
            <span aria-hidden="true">✦</span>
          </button>
          {!canStoreShipPart(progress) && (
            <p className="garage-insufficient" role="status">{ui.garageFull}</p>
          )}

          <GaragePartsList
            progress={progress}
            language={language}
            onEquip={(partId) => updateSavedProgress((current) => equipShipPart(current, partId))}
            onReroll={(partId) => updateSavedProgress((current) => rerollShipPart(current, partId))}
            onSell={sellPart}
          />

          <button className="primary-action utility-back garage-back" type="button" disabled={progress.initialRepairRequired} onClick={leaveGarage}>
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
            quality={settings.graphicsQuality}
            hullFraction={hangarVitals.hull / hangarMaximum.hull}
            canSell
            canRefit={screen === 'garage'}
            onOpenStatistics={showShipStatistics}
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
        <section className="menu-content title-content">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lead">{copy.lead}</p>
          <nav className="title-actions" aria-label={ui.mainMenu}>
            <button className="primary-action" onClick={requestNewGame}>
              <span>{ui.newGame}</span><ActionIcon icon="arrow" />
            </button>
            <button className="menu-action" disabled={!hasSave} onClick={loadGame}>
              <span>{ui.loadGame}</span><ActionIcon icon="inventory" />
            </button>
            {!hasSave && <p className="save-status">{ui.noSave}</p>}
            <button className="menu-action" onClick={() => openSettings('title')}>{ui.settings}<ActionIcon icon="settings" /></button>
            <button className="menu-action" onClick={() => openCredits('title')}>{ui.credits}<ActionIcon icon="info" /></button>
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
              {ui.quit}<ActionIcon icon="exit" />
            </button>
          </nav>
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

  return <NavigationJournal language={language} progress={progress} world={world} activeMission={activeMission} trackedStationId={navigationStationId}
    onClose={() => setScreen(journalReturnScreen)}
    onTrackMission={id => { setTrackedStationId(null); setTrackedMissionId(id) }}
    onChooseEnding={ending => updateSavedProgress(current => chooseCampaignEnding(current, ending))}
    onTrackStation={setTrackedStationId}
    onBoundaryCourse={!progress.initialRepairRequired && journalReturnScreen === 'exploration' && !combatActive && !world.planets.some(planet => planet.id === progress.orbitPlanetId)
      ? () => { setBoundaryCourse(true); setScreen('exploration') } : undefined} />
  }

  const worldMounted = worldSessionActive && screen !== 'title' && screen !== 'quit' && (screen !== 'garage' || departureStationId !== null) && !(screen === 'campaign' && journalReturnScreen === 'garage')
  return <>
    {worldMounted && <div className="persistent-world-layer" style={{ visibility: screen === 'exploration' ? 'visible' : 'hidden' }} aria-hidden={screen !== 'exploration'}>
      <Suspense fallback={<GameLoadingScreen label={gameText(language).application.loadingGalaxy} />}>
        <SectorCanvas key={`${world.galaxy.id}:${worldSessionKey}`} world={world}
          language={language} graphics={settings} controls={settings.controls}
          shipLights={settings.shipLights} onToggleLights={() => updateSettings({ shipLights: !settings.shipLights })}
          mouseSensitivity={settings.mouseSensitivity} mainVolume={settings.mainVolume} shotsVolume={settings.shotsVolume} musicVolume={radioOn ? settings.musicVolume : 0}
          cameraMode={cameraMode}
          shipBonuses={shipBonuses} equippedPartRarities={equippedPartRarities} progress={progress} activeMission={activeMission}
          trackedStationId={navigationStationId} repairStation={repairStation}
          paused={screen !== 'exploration' || inventoryOpen || statisticsOpen || pauseOpen || pauseSettingsOpen || merchantOpen || galaxyChartOpen}
          renderActive={screen === 'exploration' && !statisticsOpen && !inventoryOpen} boundaryCourse={boundaryCourse} boundaryReleaseId={boundaryReleaseId} jumpDestination={jumpDestination}
          onBoundaryCourseFailure={() => setBoundaryCourse(false)} onOpenGalaxyChart={showGalaxyChart}
          onJumpComplete={finishGalaxyJump} onOpenMerchant={() => setMerchantOpen(true)}
          onPlanetScan={collectPlanet} onDroneDefeated={defeatDrone}
          onDroneRespawn={id => updateSavedProgress(current => restoreDroneSpawn(current, id))}
          onAsteroidDestroyed={defeatAsteroid}
          onOrbitChange={id => updateSavedProgress(current => ({ ...current, orbitPlanetId: id }))} onSectorPositionChange={updateSectorPositionSaved}
          onMissionComplete={completeMission} onMissionObjectiveProgress={updateMissionObjective}
          onTrackStation={setTrackedStationId}
          onShipStatusChange={updateShipTelemetry} onShipDestroyed={recoverDestroyedShip}
          departureStationId={departureStationId} onReady={() => setDepartureWorldReady(true)} onDepartureComplete={finishDeparture}
          dockingReady={garageReady} onDockingStart={beginDocking} onDockingComplete={finishDocking} onCombatStateChange={setCombatActive}
          onBoardMegastation={() => setScreen('megastation')}
          onEnterInterior={() => { setInteriorReturn('exploration'); setScreen('shipInterior') }}
          onInvestigateSignal={id => updateSavedProgress(current => investigateSignal(current, id))}
        />
      </Suspense>
    </div>}
    {dockingStationId && <div className={screen === 'garage' ? 'persistent-garage-layer visible' : 'persistent-garage-layer'} aria-hidden={screen !== 'garage'}>
      {GarageScene && <GarageScene key={dockingStationId} language={language} graphics={settings} previewPlanet={world.planets[0]} equippedPartRarities={equippedPartRarities}
        hullFraction={hangarVitals.hull / hangarMaximum.hull} startsLanded={progress.recoveryStationId === dockingStationId}
        surfacePlanet={world.planets.find(planet => planet.id === world.stations.find(site => site.id === dockingStationId)?.planetId)}
        entering={screen === 'garage'} paused={statisticsOpen || inventoryOpen} walkMode={garageWalkMode}
        departing={departureStationId !== null} departureReady={departureWorldReady} onDeparted={() => { setGarageWalkMode(false); setScreen('exploration') }}
        onBoardShip={() => { setInteriorReturn('garage'); setScreen('shipInterior') }}
        onReady={() => setGarageReady(true)} onLandingStageChange={setGarageLandingStage} onLanded={() => { setGarageLanded(true); applicationAudio.current?.playUiSound('dock') }} />}
    </div>}
    <div className={`app-screen-overlay${screen === 'campaign' ? ' app-screen-journal' : screen === 'exploration' || screen === 'garage' ? ' app-screen-flight' : ''}`}>{renderScreen()}</div>
    {shipyardOpen && <ShipyardPanel language={language} progress={progress}
      onBuy={id => updateSavedProgress(current => purchaseShip(current, id))}
      onSelect={id => updateSavedProgress(current => selectShip(current, id))}
      onClose={() => setShipyardOpen(false)} />}
    {statisticsOpen && <ShipStatisticsPanel progress={progress} telemetry={statisticsTelemetry} language={language} quality={settings.graphicsQuality}
      onClose={() => setStatisticsOpen(false)} onLearn={skill => updateSavedProgress(current => learnPilotSkill(current, skill))}
      onPlant={(id, slot) => updateSavedProgress(current => plantCollectible(current, id, slot))}
      onUproot={slot => updateSavedProgress(current => uprootCollectible(current, slot))}
      onOpenInventory={combatActive || screen === 'campaign' ? undefined : () => { setStatisticsOpen(false); setInventoryOpen(true) }} />}
  </>
}

export default App
