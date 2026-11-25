import { PLANET_CONTACT_RANGE } from '../domain/planetOrbit'
import { ORBIT_ENTRY_DURATION, ORBIT_EXIT_DURATION, samplePlanetApproach } from '../simulation/PlanetApproach'
import { forwardRotation } from '../simulation/StationApproach'
import { useEffect, useRef, useState } from 'react'
import { Color3, Color4, Engine, FreeCamera, GlowLayer, HemisphericLight, Matrix, Quaternion, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { GameAudio } from '../audio/GameAudio'
import { resolveDamage } from '../domain/combat'
import { applyDamageResistance, type DamageType } from '../domain/damageTypes'
import { getDamageBearing, type DamageSource } from '../domain/damageFeedback'
import { BASE_RADAR_RANGE, projectRadarContacts, type RadarBlip } from '../domain/flightRadar'
import {
  distanceBetween, distanceToPlanetSurface, findNearestPlanet, findNearbyPlanet, findNearestStation, resolveSafeFlightPosition,
  FACTIONS, MERCHANT_COURSE_ID, ORION_START_POSITION,
  type GalaxyWorld, type PlanetSite, type SectorPosition, type StationSite,
} from '../domain/exploration'
import { InputController, type ControlBindings } from '../input/InputController'
import { getMission, type MissionId } from '../missions/definitions'
import type { GraphicsSettings } from '../progress/gameSettings'
import type { MissionProgress } from '../progress/missionProgress'
import { getShipResistances } from '../progress/missionProgress'
import { OVERDRIVE } from '../progress/pilotSkills'
import { SHIP_PART_SLOTS, type EquippedPartRarities, type ShipPartBonuses } from '../progress/shipParts'
import { advanceFlightMotion, FLIGHT_SPEEDS, getDodgeCooldown, getFlightTargetSpeed, integrateShipRoll, readFlightUpdate } from '../simulation/FlightSimulation'
import { HYPERSPACE_SECONDS, type GalaxyId } from '../domain/galaxyChart'
import { BOUNDARY_TRANSIT_SECONDS, clampGalaxyPosition, getBoundaryCourses, isGalaxyBoundary } from '../simulation/GalaxyTransit'
import type { ShipTelemetry } from '../domain/shipTelemetry'
import { getShipVitals } from '../progress/shipMaintenance'
import { advanceSolarExposure, createSolarExposureState } from '../simulation/SolarExposure'
import { ShipStatusHud } from '../ui/ShipStatusHud'
import { FlightRadar } from '../ui/FlightRadar'
import { DamageDirectionIndicator, type DamageFeedback } from '../ui/DamageDirectionIndicator'
import { createDamageNumber, updateDamageNumbers, type FloatingDamageNumber } from './DamageNumber'
import { createFlightEffects } from './FlightEffects'
import { createCombatImpacts } from './CombatImpacts'
import { createPlanetScanEffect } from './PlanetScanEffect'
import { createSectorStarField } from './SectorStarField'
import { createShipVisual, setShipDrivePower, type ShipDrive } from './shipVisual'
import { createShipHeadlights } from './ShipHeadlights'
import { createSpaceEnvironment } from './spaceEnvironment'
import { createPlanetField } from './PlanetField'
import { createShipBurnEffect, createSunVisual } from './StarHazard'
import { createStationSystem } from './StationDocking'
import { createMerchantShip } from './MerchantShip'
import { createWorldCombat, type WorldCombatStatus } from './WorldCombat'
import { segmentSphereContact } from './worldCombatMath'
import { projectEnemyNameplates, type EnemyNameplate } from './EnemyNameplates'
import { getHardwareScaling, spaceEffectsProfile } from './spaceEffectsProfile'
import { enableSectorDepth } from './sectorDepth'
import './WorldSector.css'

interface SectorCanvasProps {
  world: GalaxyWorld
  language: 'pl' | 'en'
  graphics: GraphicsSettings
  controls: ControlBindings
  mainVolume: number
  shotsVolume: number
  musicVolume: number
  mouseSensitivity: number
  shipLights: boolean
  onToggleLights: () => void
  shipBonuses: ShipPartBonuses
  equippedPartRarities: EquippedPartRarities
  progress: MissionProgress
  activeMission: MissionId | null
  trackedStationId?: string | null
  paused: boolean
  boundaryCourse: boolean
  jumpDestination: GalaxyId | null
  renderActive?: boolean
  dockingReady: boolean
  departureStationId?: string | null
  onReady?: () => void
  onDepartureComplete?: () => void
  onPlanetScan: (planetId: string) => void
  onDroneDefeated: (droneId: string, respawnAt?: number) => void
  onDroneRespawn: (droneId: string) => void
  onOrbitChange: (planetId: string | null) => void
  onSectorPositionChange: (position: SectorPosition, origin: GalaxyId) => void
  onMissionComplete: (missionId: MissionId) => void
  onMissionObjectiveProgress: (missionId: MissionId, count: number) => void
  onDockingStart: (stationId: string) => void
  onDockingComplete: (stationId: string) => void
  onBoundaryCourseFailure: () => void
  onOpenGalaxyChart: () => void
  onOpenMerchant: () => void
  onJumpComplete: (destination: GalaxyId, origin: GalaxyId) => void
  onCombatStateChange?: (active: boolean) => void
  onTrackStation?: (stationId: string) => void
  onShipStatusChange?: (telemetry: ShipTelemetry) => void
}

interface Waypoint { x: number; y: number; distance: number; name: string; behind: boolean }
interface StationBeacon extends Waypoint { id: string; selected: boolean }
const EMPTY_COMBAT: WorldCombatStatus = {
  mission: null, boss: null, completedObjectives: 0, requiredObjectives: 0,
  engaged: false, targetName: null, targetHealth: 0, targetMaximumHealth: 0, faction: null,
}

export function SectorCanvas(props: SectorCanvasProps) {
  const { world, language, graphics, controls, mainVolume, shotsVolume, musicVolume, mouseSensitivity,
    shipBonuses, equippedPartRarities, progress, paused } = props
  const polish = language === 'pl'
  const live = useRef(props)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<InputController | null>(null)
  const audioRef = useRef<GameAudio | null>(null)
  const configureGraphics = useRef<((options: GraphicsSettings) => void) | null>(null)
  const pendingDock = useRef<string | null>(null)
  const pendingScan = useRef<string | null>(null)
  const pendingOrbit = useRef<{ id: string; leaving: boolean } | null>(null)
  const pendingOverdrive = useRef(false)
  const [orbitPlanet, setOrbitPlanet] = useState(() => world.planets.find(planet => planet.id === progress.orbitPlanetId && planet.orbitalFaction) ?? null)
  const [orbitalFleet, setOrbitalFleet] = useState({ total: 0, remaining: 0 })
  const [planetTravel, setPlanetTravel] = useState({ active: false, progress: 0, leaving: false, name: '' })
  const [initialPosition] = useState(() => resolveSafeFlightPosition(clampGalaxyPosition({ x: progress.sectorX, y: progress.sectorY, z: progress.sectorDistance }, world.bounds), world.planets))
  const positionRef = useRef<SectorPosition>(initialPosition)
  const [position, setPosition] = useState(initialPosition)
  const [nearestPlanet, setNearestPlanet] = useState<PlanetSite | null>(() => findNearestPlanet(initialPosition, world.planets))
  const [scanDistance, setScanDistance] = useState(() => {
    const planet = findNearestPlanet(initialPosition, world.planets)
    return planet ? distanceToPlanetSurface(initialPosition, planet) : 0
  })
  const [inScanRange, setInScanRange] = useState(() => findNearbyPlanet(initialPosition, world.planets) !== null)
  const [station, setStation] = useState<StationSite | null>(null)
  const [vitals, setVitals] = useState(() => ({ ...getShipVitals(progress), dodge: 0 }))
  const [incomingDamage, setIncomingDamage] = useState<DamageFeedback[]>([])
  const [combat, setCombat] = useState(EMPTY_COMBAT)
  const [enemyNameplates, setEnemyNameplates] = useState<EnemyNameplate[]>([])
  const [radar, setRadar] = useState<RadarBlip[]>([])
  const [overdriveRemaining, setOverdriveRemaining] = useState(0)
  const radarRange = BASE_RADAR_RANGE * (1 + (shipBonuses.sensorRangePercent ?? 0) / 100)
  const [waypoint, setWaypoint] = useState<Waypoint | null>(null)
  const [stationBeacons, setStationBeacons] = useState<StationBeacon[]>([])
  const [merchantBeacon, setMerchantBeacon] = useState<Waypoint | null>(null)
  const [nearMerchant, setNearMerchant] = useState(false)
  const [atBoundary, setAtBoundary] = useState(false)
  const [boundaryProgress, setBoundaryProgress] = useState(0)
  const [solarHeat, setSolarHeat] = useState({ intensity: 0, distance: Infinity, inZone: false })
  const [message, setMessage] = useState('')
  const [impactFlash, setImpactFlash] = useState(0)
  const [docking, setDocking] = useState({ active: false, progress: 0, stage: 'idle', fade: 0 })
  useEffect(() => { live.current = props }, [props])
  useEffect(() => { inputRef.current?.updateSettings(controls, mouseSensitivity) }, [controls, mouseSensitivity])
  const rendering = props.renderActive !== false
  useEffect(() => {
    inputRef.current?.setSuspended(paused)
    if (paused || !rendering) {
      audioRef.current?.updateEngine(0, 0)
      if (canvasRef.current) canvasRef.current.dataset.engineSound = 'silent'
    }
  }, [paused, rendering])
  useEffect(() => { audioRef.current?.updateLevels({ main: mainVolume, shots: shotsVolume, music: musicVolume }) }, [mainVolume, shotsVolume, musicVolume])
  useEffect(() => { configureGraphics.current?.(graphics) }, [graphics])
  useEffect(() => { if (paused) live.current.onSectorPositionChange({ ...positionRef.current }, world.galaxy.id) }, [paused, world.galaxy.id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const settings = live.current
    const quality = settings.graphics.graphicsQuality
    const { galaxy, bounds, planets: planetSites, stations: stationSites, sun: sunSite, merchant: merchantSite } = settings.world
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(getHardwareScaling(settings.graphics))
    const scene = new Scene(engine)
    enableSectorDepth(scene)
    scene.skipPointerMovePicking = true
    scene.skipPointerDownPicking = true
    scene.skipPointerUpPicking = true
    scene.clearColor = new Color4(0.001, 0.003, 0.008, 1)
    createSpaceEnvironment(scene, quality, {
      decorativePlanet: false,
      skyDiameter: bounds.maxZ * 3,
      skyTint: Color3.FromHexString(galaxy.color),
    })
    const camera = new FreeCamera('sectorCamera', new Vector3(0, 6, -15), scene)
    // The chase camera stays over ten meters away; keep depth precision for large planets.
    camera.minZ = 1
    camera.maxZ = Math.max(140000, bounds.maxZ * 2.5)
    const light = new HemisphericLight('sectorLight', new Vector3(0.3, 1, -0.25), scene)
    light.intensity = 0.34
    light.groundColor = new Color3(0.03, 0.05, 0.09)
    const effectsProfile = spaceEffectsProfile(quality)
    const glow = new GlowLayer('sectorGlow', scene, { mainTextureRatio: effectsProfile.glowRatio, blurKernelSize: effectsProfile.glowKernel })
    const ship = new TransformNode('playerShip', scene)
    const setHeadlights = createShipHeadlights(scene, ship)
    let lightsOn = settings.shipLights
    setHeadlights(lightsOn)
    canvas.dataset.headlights = lightsOn ? 'on' : 'off'
    const rarityKey = (rarities: EquippedPartRarities) => SHIP_PART_SLOTS.map(slot => rarities[slot] ?? 'none').join(':')
    let appearanceKey = rarityKey(settings.equippedPartRarities)
    let appearance = createShipVisual(scene, settings.equippedPartRarities)
    appearance.name = 'playerShipAppearance'
    appearance.parent = ship
    ship.position.set(positionRef.current.x, positionRef.current.y, positionRef.current.z)
    camera.position.copyFrom(ship.position).addInPlaceFromFloats(0, 6, -15)
    camera.setTarget(ship.position.add(new Vector3(0, 0, 9)))
    const planets = createPlanetField(scene, planetSites, quality)
    const sun = createSunVisual(scene, sunSite, quality, galaxy.sunColor)
    const merchant = createMerchantShip(scene, merchantSite)
    merchant.update(ship.position)
    const burning = createShipBurnEffect(scene, ship, quality)
    let solar = createSolarExposureState()
    let thermalTick = 0
    let thermalDamage = 0
    let resistances = getShipResistances(settings.progress)
    let previousStats = settings.progress
    const stars = createSectorStarField(scene, 220, ship.position)
    const baseCameraFov = camera.fov
    let effects = createFlightEffects(scene, ship, camera, quality, FLIGHT_SPEEDS.cruise, appearance)
    const applyGraphics = (config: GraphicsSettings) => {
      const scaling = getHardwareScaling(config)
      if (engine.getHardwareScalingLevel() !== scaling) engine.setHardwareScalingLevel(scaling)
      glow.isEnabled = config.bloom
      glow.intensity = spaceEffectsProfile(config.graphicsQuality).glowIntensity
      planets.configure(config.graphicsQuality, config.planetAtmospheres)
      stars.setCount(config.graphicsQuality === 'high' ? 220 : config.graphicsQuality === 'low' ? 90 : 150)
      effects.configure(config)
    }
    configureGraphics.current = applyGraphics
    applyGraphics(settings.graphics)
    const stations = createStationSystem(scene, ship, camera, quality, stationSites)
    if (settings.departureStationId) {
      stations.beginDeparture(settings.departureStationId)
      positionRef.current = { x: ship.position.x, y: ship.position.y, z: ship.position.z }
      setDocking({ active: true, progress: 0, stage: 'departure', fade: 1 })
    }
    const input = new InputController(settings.controls, canvas, settings.mouseSensitivity)
    input.setSuspended(settings.paused)
    inputRef.current = input
    const audio = new GameAudio({ main: settings.mainVolume, shots: settings.shotsVolume, music: settings.musicVolume }, { ambient: false })
    audioRef.current = audio
    const unlockAudio = () => { void audio.resume() }
    window.addEventListener('keydown', unlockAudio, { once: true })
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    const damageNumbers: FloatingDamageNumber[] = []
    const impactEffects = createCombatImpacts(scene)
    const maximumShield = () => 100 + live.current.progress.shieldLevel * 10 + live.current.shipBonuses.shieldPoints
    const maximumHull = () => 100 + live.current.progress.shieldLevel * 5 + live.current.shipBonuses.hullPoints
    const initialVitals = getShipVitals(settings.progress)
    let shield = initialVitals.shield
    let hull = initialVitals.hull
    let speed = 0
    let collisionClock = 0
    let dodgeRemaining = 0
    let dodgeElapsed = 1
    let overdriveClock = 0
    let hudClock = 0
    let saveClock = 0
    let messageClock = 0
    let engaged = false
    let completedDocking = false
    let damageSequence = 0
    let boundaryTransit: { from: Vector3; to: Vector3; direction: Vector3; startedAt: number } | null = null
    let jumpStartedAt: number | null = null
    let jumpFinished = false
    const shipPosition = (): SectorPosition => ({ x: ship.position.x, y: ship.position.y, z: ship.position.z })
    const savePosition = () => {
      positionRef.current = shipPosition()
      live.current.onSectorPositionChange(positionRef.current, galaxy.id)
    }
    const showMessage = (pl: string, en: string) => {
      setMessage(live.current.language === 'pl' ? pl : en)
      messageClock = 5
    }
    const receiveDamage = (amount: number, type: DamageType = 'kinetic', continuous = false, source?: DamageSource) => {
      const resistedAmount = applyDamageResistance(amount, type, resistances)
      const damage = resolveDamage({ amount: resistedAmount, shield, dodgeElapsed, activeDodge: !continuous && source?.kind !== 'collision' && dodgeElapsed < 0.48 })
      shield = Math.max(0, shield - damage.shieldDamage)
      hull = Math.max(0, hull - damage.hullDamage)
      if (damage.amount <= 0) return
      if (source) {
        const bearing = getDamageBearing(ship.position, camera.getDirection(Vector3.Forward()), camera.getDirection(Vector3.Right()), source.position)
        if (bearing) {
          const hit = { ...bearing, id: ++damageSequence, createdAt: performance.now(), source }
          setIncomingDamage(previous => [...previous.filter(item => performance.now() - item.createdAt < 1400), hit].slice(-4))
        }
      }
      live.current.onShipStatusChange?.({ shield, hull, speed, dodgeRemaining, burningIntensity: solar.burningIntensity })
      damageNumbers.push(createDamageNumber(scene, ship.position, damage.amount, false, 'incoming'))
      if (!continuous) {
        const normal = source?.impact?.normal ?? (source
          ? new Vector3(source.position.x, source.position.y, source.position.z).subtractInPlace(ship.position).normalize()
          : Vector3.Backward())
        const hit = source?.impact?.position
        const point = hit ? new Vector3(hit.x, hit.y, hit.z) : ship.position.add(new Vector3(normal.x, normal.y, normal.z).scale(1.6))
        impactEffects.play(point, new Vector3(normal.x, normal.y, normal.z), 1.08, source?.kind === 'collision' ? 'collision' : damage.shieldDamage > 0 ? 'shield' : 'armor')
        setImpactFlash(value => value + 1)
      }
    }
    const worldCombat = createWorldCombat(scene, {
      getProgress: () => live.current.progress,
      onPlayerHit: (amount, source) => receiveDamage(amount, 'kinetic', false, source),
      onEnemyDefeated: (id, respawnAt) => live.current.onDroneDefeated(id, respawnAt),
      onEnemyRespawn: id => live.current.onDroneRespawn(id),
      onMissionComplete: id => live.current.onMissionComplete(id),
      onMissionProgress: (id, count) => live.current.onMissionObjectiveProgress(id, count),
      onMessage: showMessage,
      onShot: () => audio.playShot(),
      onImpact: impactEffects.play,
      onPlayerContact: safePosition => {
        const inside = resolveSafeFlightPosition(clampGalaxyPosition(safePosition, bounds), planetSites)
        const offset = new Vector3(inside.x, inside.y, inside.z).subtractInPlace(ship.position)
        ship.position.addInPlace(offset)
        camera.position.addInPlace(offset)
        speed *= .24
      },
      damageNumbers,
    }, settings.world)
    let activeOrbit = planetSites.find(planet => planet.id === settings.progress.orbitPlanetId && planet.orbitalFaction) ?? null
    if (activeOrbit) worldCombat.enterPlanetOrbit(activeOrbit.id)
    let orbitTransit: { planet: PlanetSite; from: Vector3; progress: number; leaving: boolean } | null = null
    const moveSafely = (destination: Vector3) => {
      let contact = Infinity
      let collision: PlanetSite | null = null
      for (const planet of planetSites) {
        const hit = segmentSphereContact(ship.position, destination, planet, planet.radius + 2.4)
        if (hit !== null && hit < contact) { collision = planet; contact = hit }
      }
      if (!collision) { ship.position.copyFrom(destination); return }
      const center = new Vector3(collision.x, collision.y, collision.z)
      const point = Vector3.Lerp(ship.position, destination, contact)
      const away = point.subtract(center)
      if (away.lengthSquared() < 0.01) away.set(0, 0, -1)
      ship.position.copyFrom(center.add(away.normalize().scale(collision.radius + 3.2)))
      speed = 0
      if (collisionClock <= 0) {
        receiveDamage(30, 'kinetic', false, { position: collision, label: collision.name, kind: 'collision' })
        collisionClock = 1.1
        showMessage(`Zderzenie z ${collision.name.pl}. Omiń powierzchnię planety.`, `Impact with ${collision.name.en}. Steer around the planet.`)
      }
    }
    const updateWaypoint = () => {
      const mission = !live.current.trackedStationId && live.current.activeMission ? getMission(live.current.activeMission) : null
      const navigationTarget = mission ? worldCombat.getNavigationTarget(mission.id, ship.position) : null
      const project = (site: SectorPosition, name: string): Waypoint => {
        const target = new Vector3(site.x, site.y, site.z)
        const direction = target.subtract(camera.position)
        const behind = Vector3.Dot(direction, camera.getDirection(Vector3.Forward())) < 0
        const point = Vector3.Project(target, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()))
        return { x: behind ? (Vector3.Dot(direction, camera.getDirection(Vector3.Right())) >= 0 ? 64 : 18) : clamp(point.x / engine.getRenderWidth() * 100, 18, 64),
          y: behind ? 50 : clamp(point.y / engine.getRenderHeight() * 100, 28, 58), behind,
          distance: Vector3.Distance(ship.position, target), name }
      }
      const guide = mission ? project(navigationTarget ?? mission.worldPosition, mission.title[live.current.language]) : null
      setWaypoint(guide)
      const nearest = findNearestStation(ship.position, stationSites)
      const beacon = project(nearest, nearest.name[live.current.language])
      if (guide && Math.abs(guide.x - beacon.x) < 18 && Math.abs(guide.y - beacon.y) < 10) beacon.y = beacon.y > 45 ? beacon.y - 12 : beacon.y + 12
      setStationBeacons([{ ...beacon, id: nearest.id, selected: nearest.id === live.current.trackedStationId }])
      const trader = project(merchantSite, merchantSite.name[live.current.language])
      const markers = guide ? [guide, beacon] : [beacon]
      const freeRow = [0, 13, -13, 26, -26, 39, -39].map(offset => trader.y + offset).find(y =>
        y >= 18 && y <= 76 && markers.every(marker => Math.abs(trader.x - marker.x) >= 20 || Math.abs(y - marker.y) >= 11))
      trader.y = freeRow ?? trader.y
      const trading = live.current.trackedStationId === MERCHANT_COURSE_ID
      setMerchantBeacon(trading || trader.distance < 9500 ? trader : null)
      setNearMerchant(trader.distance <= merchantSite.tradeRange)
    }
    const resize = () => engine.resize()
    window.addEventListener('resize', resize)
    scene.onBeforeRenderObservable.add(() => {
      updateDamageNumbers(damageNumbers)
      const current = live.current
      const realDt = Math.min(engine.getDeltaTime() / 1000, 0.15)
      if (current.jumpDestination) {
        const now = performance.now()
        jumpStartedAt ??= now
        effects.setPaused(false)
        effects.update(realDt, FLIGHT_SPEEDS.cruise * 2, 1, true)
        audio.updateEngine(1, 1)
        canvas.dataset.engineSound = 'acceleration'
        canvas.dataset.galaxyTransit = 'hyperspace'
        if (now - jumpStartedAt >= HYPERSPACE_SECONDS * 1000 && !jumpFinished) {
          jumpFinished = true
          current.onJumpComplete(current.jumpDestination, galaxy.id)
        }
        return
      }
      effects.setPaused(current.paused)
      if (current.paused) audio.updateEngine(0, 0)
      if (current.paused) burning.update(0, solar.burningIntensity, true)
      if (current.paused || current.renderActive === false) return
      const dt = realDt
      if (previousStats !== current.progress) {
        previousStats = current.progress
        resistances = getShipResistances(current.progress)
      }
      if (lightsOn !== current.shipLights) {
        lightsOn = current.shipLights
        setHeadlights(lightsOn)
        canvas.dataset.headlights = lightsOn ? 'on' : 'off'
      }
      impactEffects.update(dt)
      const nextAppearanceKey = rarityKey(current.equippedPartRarities)
      if (nextAppearanceKey !== appearanceKey) {
        effects.dispose()
        appearance.dispose(false, true)
        appearance = createShipVisual(scene, current.equippedPartRarities)
        appearance.name = 'playerShipAppearance'
        appearance.parent = ship
        appearanceKey = nextAppearanceKey
        camera.fov = baseCameraFov
        effects = createFlightEffects(scene, ship, camera, current.graphics.graphicsQuality, FLIGHT_SPEEDS.cruise, appearance)
        effects.configure(current.graphics)
      }
      const nextMaximumShield = maximumShield()
      const nextMaximumHull = maximumHull()
      shield = clamp(shield, 0, nextMaximumShield)
      hull = clamp(hull, 0, nextMaximumHull)
      if (pendingDock.current) {
        const id = pendingDock.current
        pendingDock.current = null
        if (!engaged && stations.beginDocking(id)) {
          current.onShipStatusChange?.({ shield, hull, speed, dodgeRemaining, burningIntensity: solar.burningIntensity })
          savePosition()
          current.onDockingStart(id)
          speed = 0
        }
      }
      const dock = stations.update(engine.getDeltaTime() / 1000, current.dockingReady)
      if (dock.active || dock.complete) {
        effects.setPaused(true)
        const power = dock.departing ? .28 + .58 * Math.sin(dock.progress * Math.PI) : .21 + .21 * Math.sin(dock.progress * Math.PI)
        setShipDrivePower(appearance.metadata.drive as ShipDrive, power, performance.now() / 1000)
        audio.updateEngine(power * .37, power * .24)
        canvas.dataset.engineSound = 'cruise'
        hudClock += realDt
        if (hudClock >= 0.1 || dock.complete) {
          hudClock = 0
          setDocking({ active: true, progress: dock.progress, stage: dock.stage, fade: dock.fade })
        }
        if (engaged) { engaged = false; current.onCombatStateChange?.(false) }
        positionRef.current = { x: ship.position.x, y: ship.position.y, z: ship.position.z }
        canvas.dataset.stationTransit = dock.departing ? 'departing' : 'docking'
        if (dock.complete && dock.stationId) {
          if (dock.departing) {
            setDocking({ active: false, progress: 1, stage: 'idle', fade: 0 })
            canvas.dataset.stationTransit = 'idle'
            savePosition()
            current.onDepartureComplete?.()
          } else if (!completedDocking) {
            completedDocking = true
            current.onDockingComplete(dock.stationId)
          }
        }
        return
      }
      if (!current.boundaryCourse && boundaryTransit) {
        boundaryTransit = null
        ship.rotationQuaternion?.toEulerAnglesToRef(ship.rotation)
        ship.rotationQuaternion = null
        input.setSuspended(false)
        savePosition()
      }
      if (current.boundaryCourse && !boundaryTransit) {
        const hazards = [...planetSites, ...stationSites, merchantSite, { ...sunSite, radius: sunSite.radius + sunSite.heatRange }]
        const from = ship.position.clone()
        const point = !engaged && !activeOrbit && !orbitTransit && !solar.inZone
          ? getBoundaryCourses(from, bounds).find(target => hazards.every(site =>
              segmentSphereContact(from, new Vector3(target.x, target.y, target.z), site, site.radius + 40) === null))
          : undefined
        if (point) {
          speed = 0
          if (Vector3.DistanceSquared(from, new Vector3(point.x, point.y, point.z)) < 0.0001) {
            savePosition()
            setAtBoundary(true)
            current.onOpenGalaxyChart()
            return
          }
          const to = new Vector3(point.x, point.y, point.z)
          boundaryTransit = { from, to, direction: to.subtract(from).normalize(), startedAt: performance.now() }
          ship.rotationQuaternion = Quaternion.FromEulerVector(ship.rotation)
          input.setSuspended(true)
          setBoundaryProgress(0)
        } else {
          current.onBoundaryCourseFailure()
          showMessage('Kurs do granicy jest zablokowany. Wyleć na otwartą przestrzeń.', 'Boundary course is blocked. Fly into open space.')
        }
      }
      if (boundaryTransit) {
        const transit = boundaryTransit
        const fraction = Math.min(1, (performance.now() - transit.startedAt) / (BOUNDARY_TRANSIT_SECONDS * 1000))
        const travelFraction = clamp((fraction - 0.13) / 0.87, 0, 1)
        const eased = travelFraction ** 2 * (3 - 2 * travelFraction)
        Vector3.LerpToRef(transit.from, transit.to, eased, ship.position)
        const facing = forwardRotation(transit.direction)
        Quaternion.SlerpToRef(ship.rotationQuaternion!, Quaternion.FromEulerAngles(facing.pitch, facing.yaw, 0),
          Math.min(1, dt * 8), ship.rotationQuaternion!)
        const direction = ship.getDirection(Vector3.Forward())
        camera.position.copyFrom(ship.position).subtractInPlace(direction.scale(17)).addInPlaceFromFloats(0, 5, -4 * Math.abs(direction.y))
        camera.setTarget(ship.position.add(direction.scale(20)))
        stars.update(ship.position)
        planets.update(dt, ship.position)
        sun.update(dt)
        merchant.update(ship.position)
        effects.update(dt, FLIGHT_SPEEDS.cruise * (0.8 + travelFraction), 1, true)
        audio.updateEngine(1, 1)
        canvas.dataset.engineSound = 'acceleration'
        canvas.dataset.galaxyTransit = 'boundary-course'
        positionRef.current = shipPosition()
        setBoundaryProgress(Math.floor(fraction * 100))
        if (fraction >= 1) {
          boundaryTransit = null
          ship.rotationQuaternion!.toEulerAnglesToRef(ship.rotation)
          ship.rotationQuaternion = null
          savePosition()
          setAtBoundary(true)
          current.onOpenGalaxyChart()
        }
        return
      }
      canvas.dataset.galaxyTransit = 'idle'
      collisionClock = Math.max(0, collisionClock - dt)
      dodgeRemaining = Math.max(0, dodgeRemaining - dt)
      dodgeElapsed += dt
      messageClock = Math.max(0, messageClock - dt)
      if (messageClock === 0) setMessage(previous => previous ? '' : previous)
      hudClock += dt
      saveClock += dt
      if (pendingOrbit.current && !orbitTransit) {
        const request = pendingOrbit.current
        pendingOrbit.current = null
        const planet = planetSites.find(site => site.id === request.id)
        if (planet?.orbitalFaction && (request.leaving || (!engaged && distanceToPlanetSurface(ship.position, planet) <= PLANET_CONTACT_RANGE))) {
          orbitTransit = { planet, from: ship.position.clone(), progress: 0, leaving: request.leaving }
          input.setSuspended(true)
          speed = 0
          ship.rotationQuaternion = Quaternion.FromEulerVector(ship.rotation)
        }
      }
      if (orbitTransit) {
        const transit = orbitTransit
        transit.progress = Math.min(1, transit.progress + realDt / (transit.leaving ? ORBIT_EXIT_DURATION : ORBIT_ENTRY_DURATION))
        const point = samplePlanetApproach(transit.planet, transit.from, transit.progress, transit.leaving)
        ship.position.set(point.x, point.y, point.z)
        const direction = transit.leaving ? ship.position.subtract(new Vector3(transit.planet.x, transit.planet.y, transit.planet.z)).normalize() : new Vector3(Math.cos(0.1), 0, Math.sin(0.1))
        const rotation = forwardRotation(direction)
        const target = Quaternion.FromEulerAngles(rotation.pitch, rotation.yaw, 0)
        Quaternion.SlerpToRef(ship.rotationQuaternion!, target, Math.min(1, realDt * 3), ship.rotationQuaternion!)
        const desiredCamera = ship.position.subtract(ship.getDirection(Vector3.Forward()).scale(18)).addInPlaceFromFloats(0, 6, 0)
        Vector3.LerpToRef(camera.position, desiredCamera, Math.min(1, realDt * 3), camera.position)
        camera.setTarget(ship.position.add(direction.scale(25)))
        stars.update(ship.position)
        planets.update(dt, ship.position)
        sun.update(dt)
        effects.update(dt, 100, 0.5)
        audio.updateEngine(0.4, 0.5)
        setPlanetTravel(previous => Math.abs(previous.progress - transit.progress) > 0.02 || !previous.active ? { active: true, progress: transit.progress, leaving: transit.leaving, name: transit.planet.name[current.language] } : previous)
        canvas.dataset.planetTransit = transit.leaving ? 'exiting' : 'entering'
        if (transit.progress >= 1) {
          activeOrbit = transit.leaving ? null : transit.planet
          if (activeOrbit) worldCombat.enterPlanetOrbit(activeOrbit.id)
          current.onOrbitChange(activeOrbit?.id ?? null)
          setOrbitPlanet(activeOrbit)
          ship.rotationQuaternion!.toEulerAnglesToRef(ship.rotation)
          ship.rotationQuaternion = null
          positionRef.current = { x: ship.position.x, y: ship.position.y, z: ship.position.z }
          savePosition()
          orbitTransit = null
          input.setSuspended(false)
          setPlanetTravel(previous => ({ ...previous, active: false }))
        }
        return
      }
      canvas.dataset.planetTransit = 'idle'
      canvas.dataset.orbitPlanet = activeOrbit?.id ?? ''
      const commands = readFlightUpdate(command => input.isDown(command), input.readMouseFlight())
      const bonuses = current.shipBonuses
      if (input.consumeTap('lights')) current.onToggleLights()
      overdriveClock = Math.max(0, overdriveClock - dt)
      const engageOverdrive = input.consumeTap('overdrive') || pendingOverdrive.current
      pendingOverdrive.current = false
      if (engageOverdrive && overdriveClock <= 0 && current.progress.pilotSkills.includes('overdrive')) overdriveClock = OVERDRIVE.cooldown
      const overdriving = overdriveClock > OVERDRIVE.cooldown - OVERDRIVE.duration
      const thrust = overdriving ? 1 : commands.thrust
      canvas.dataset.overdrive = overdriving ? 'active' : 'idle'
      const handling = 1 + (bonuses.handlingPercent ?? 0) / 100
      ship.rotation.x = clamp(ship.rotation.x + commands.pitch * dt * 1.1 * handling, -1.25, 1.25)
      ship.rotation.y += commands.yaw * dt * 1.25 * handling
      ship.rotation.z = integrateShipRoll(ship.rotation.z, commands.roll, dt, handling)
      ship.computeWorldMatrix(true)
      const forward = ship.getDirection(Vector3.Forward()).normalize()
      const right = ship.getDirection(Vector3.Right()).normalize()
      const previousPosition = ship.position.clone()
      const nearest = findNearestPlanet(ship.position, planetSites)
      const surfaceDistance = nearest ? distanceToPlanetSurface(ship.position, nearest) : Infinity
      const targetSpeed = getFlightTargetSpeed(thrust, bonuses) * (overdriving ? OVERDRIVE.speedMultiplier : 1)
      const motion = advanceFlightMotion(speed, targetSpeed, dt)
      speed = motion.speed
      moveSafely(ship.position.add(forward.scale(motion.distance)))
      if (commands.dodgeRequested && dodgeRemaining <= 0) {
        dodgeRemaining = getDodgeCooldown(bonuses)
        dodgeElapsed = 0
        moveSafely(ship.position.add(right.scale(commands.yaw < 0 ? -7 : 7)))
      }
      const inside = clampGalaxyPosition(ship.position, bounds)
      const crossedBoundary = ship.position.x !== inside.x || ship.position.y !== inside.y || ship.position.z !== inside.z
      if (crossedBoundary) {
        ship.position.set(inside.x, inside.y, inside.z)
        speed = 0
      }
      const displacement = ship.position.subtract(previousPosition)
      camera.position.addInPlace(displacement)
      const velocity = displacement.scaleInPlace(1 / Math.max(0.001, dt))
      const followDistance = 15 + Math.min(1, Math.abs(speed) / FLIGHT_SPEEDS.cruise) * 3.5
      const chasePosition = ship.position.subtract(forward.scale(followDistance)).addInPlaceFromFloats(0, 6, 0)
      Vector3.LerpToRef(camera.position, chasePosition, Math.min(1, dt * 3.5), camera.position)
      camera.setTarget(ship.position.add(forward.scale(9)))
      effects.update(dt, speed, thrust, overdriving)
      const engineSound = audio.updateEngine(speed / FLIGHT_SPEEDS.cruise, thrust)
      if (canvas.dataset.engineSound !== engineSound.mode) canvas.dataset.engineSound = engineSound.mode
      solar = advanceSolarExposure(solar, dt, ship.position, sunSite)
      thermalTick += dt
      thermalDamage += solar.thermalDamage
      if (thermalTick >= 0.5) {
        if (thermalDamage > 0) receiveDamage(thermalDamage, 'thermal', true, { position: sunSite, label: sunSite.name, kind: 'heat' })
        thermalTick = 0
        thermalDamage = 0
      }
      burning.update(dt, solar.burningIntensity)
      sun.update(dt)
      canvas.dataset.burningIntensity = solar.burningIntensity.toFixed(3)
      worldCombat.update(dt, { position: ship.position, previousPosition, velocity, forward, right,
        firing: commands.fireRequested, bonuses, weaponRarity: current.equippedPartRarities.weapon ?? 'standard' })
      const status = worldCombat.getStatus()
      if (engaged !== status.engaged) { engaged = status.engaged; current.onCombatStateChange?.(engaged) }
      if (hull <= 0) {
        hull = maximumHull()
        shield = 0
        speed = 0
        solar = createSolarExposureState()
        thermalDamage = 0
        thermalTick = 0
        burning.update(0, 0)
        ship.position.set(ORION_START_POSITION.x, ORION_START_POSITION.y, ORION_START_POSITION.z)
        camera.position.copyFrom(ship.position).addInPlaceFromFloats(0, 6, -15)
        showMessage('Holownik odprowadził statek do bezpiecznego punktu wejścia.', 'Recovery crew returned the ship to the safe entry point.')
      }
      positionRef.current = shipPosition()
      if (crossedBoundary && hull > 0 && !engaged && !activeOrbit && isGalaxyBoundary(ship.position, bounds)) {
        savePosition()
        setAtBoundary(true)
        current.onOpenGalaxyChart()
        return
      }
      stars.update(ship.position)
      planets.update(dt, ship.position)
      merchant.update(ship.position)
      if (pendingScan.current) {
        const site = planetSites.find(planet => planet.id === pendingScan.current)
        pendingScan.current = null
        if (site && findNearbyPlanet(ship.position, planetSites)?.id === site.id) {
          createPlanetScanEffect(scene, new Vector3(site.x, site.y, site.z), site.radius)
          current.onPlanetScan(site.id)
        }
      }
      if (hudClock >= 0.12) {
        hudClock = 0
        setIncomingDamage(previous => {
          const next = previous.filter(item => performance.now() - item.createdAt < 1400)
          return next.length === previous.length ? previous : next
        })
        if (activeOrbit) setOrbitalFleet(worldCombat.getPlanetOrbitStatus(activeOrbit.id))
        canvas.dataset.flightSpeed = speed.toFixed(1)
        canvas.dataset.throttle = String(thrust)
        setPosition({ ...positionRef.current })
        setNearestPlanet(nearest)
        setScanDistance(surfaceDistance)
        setInScanRange(findNearbyPlanet(ship.position, planetSites) !== null)
        setAtBoundary(!activeOrbit && isGalaxyBoundary(ship.position, bounds))
        setStation(stations.getNearbyStation(ship.position))
        setVitals({ shield, hull, dodge: dodgeRemaining })
        current.onShipStatusChange?.({ shield, hull, speed, dodgeRemaining, burningIntensity: solar.burningIntensity })
        setCombat(status)
        setOverdriveRemaining(overdriveClock)
        const range = BASE_RADAR_RANGE * (1 + (bonuses.sensorRangePercent ?? 0) / 100)
        setRadar(projectRadarContacts(ship.position, ship.rotation.y, range, [
          ...worldCombat.getRadarTargets(ship.position, range),
          ...stationSites.map(site => ({ ...site, kind: 'station' as const })),
          { ...merchantSite, id: MERCHANT_COURSE_ID, kind: 'merchant' },
        ]))
        setEnemyNameplates(projectEnemyNameplates(worldCombat.getNameplateTargets(), camera, planetSites, current.language))
        setSolarHeat({ intensity: solar.burningIntensity, distance: solar.distanceToSurface, inZone: solar.inZone })
        updateWaypoint()
      }
      if (saveClock >= 0.8) {
        saveClock = 0
        savePosition()
      }
    })
    let ready = false
    scene.executeWhenReady(() => { ready = true; canvas.dataset.ready = 'true'; live.current.onReady?.() })
    engine.runRenderLoop(() => {
      if (live.current.renderActive !== false || !ready) scene.render()
    })
    return () => {
      live.current.onShipStatusChange?.({ shield, hull, speed, dodgeRemaining, burningIntensity: solar.burningIntensity })
      savePosition()
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('pointerdown', unlockAudio)
      input.dispose()
      audio.dispose()
      effects.dispose()
      impactEffects.dispose()
      burning.dispose()
      sun.dispose()
      planets.dispose()
      worldCombat.dispose()
      stations.dispose()
      scene.dispose()
      engine.dispose()
      live.current.onCombatStateChange?.(false)
      inputRef.current = null
      audioRef.current = null
      configureGraphics.current = null
    }
  }, [])

  const visited = nearestPlanet ? progress.visitedPlanets.includes(nearestPlanet.id) : false
  const planetActions = nearestPlanet && scanDistance <= PLANET_CONTACT_RANGE && !combat.engaged ? <div className="planet-contact-actions">
    {inScanRange && !visited && <button type="button" onClick={() => { pendingScan.current = nearestPlanet.id }}>{polish ? 'Zeskanuj' : 'Scan'}</button>}
    {nearestPlanet.orbitalFaction && !orbitPlanet && <button type="button" onClick={() => { pendingOrbit.current = { id: nearestPlanet.id, leaving: false } }}>{polish ? 'Wejdź na orbitę' : 'Enter orbit'}</button>}
  </div> : null
  return (
    <main className="game-shell sector-shell world-sector" data-galaxy={world.galaxy.id} data-world-position={`${Math.round(position.x)},${Math.round(position.y)},${Math.round(position.z)}`}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="Neon Void explorable space sector"
        data-equipped-parts={SHIP_PART_SLOTS.filter(slot => equippedPartRarities[slot]).join(',')} />
      {impactFlash > 0 && <div key={impactFlash} className="impact-flash" aria-hidden="true" />}
        <ShipStatusHud language={language} shield={vitals.shield} maxShield={100 + progress.shieldLevel * 10 + shipBonuses.shieldPoints}
          hull={vitals.hull} maxHull={100 + progress.shieldLevel * 5 + shipBonuses.hullPoints} dodgeRemaining={vitals.dodge}
          dodgeDuration={getDodgeCooldown(shipBonuses)} />
      {!docking.active && !planetTravel.active && !props.boundaryCourse && !props.paused && <>
        <div className="flight-reticle" aria-hidden="true" />
        <FlightRadar language={language} galaxy={world.galaxy.name} position={position} radius={radarRange} blips={radar}
          lights={props.shipLights} lightsKey={controls.lights.replace(/^(Key|Digit)/, '')}
          overdriveKey={progress.pilotSkills.includes('overdrive') ? controls.overdrive.replace(/^(Key|Digit)/, '') : undefined}
          overdriveRemaining={overdriveRemaining} onLights={props.onToggleLights} onOverdrive={() => { pendingOverdrive.current = true }} />
      </>}
      {!docking.active && !planetTravel.active && !props.boundaryCourse && <>
        <div className="enemy-nameplates" aria-label={polish ? 'Przeciwnicy w zasięgu wzroku' : 'Visible enemies'}>
          {enemyNameplates.map(enemy => <div key={enemy.id} className={`enemy-nameplate${enemy.boss ? ' is-boss' : ''}${enemy.hit ? ' is-hit' : ''}`}
            style={{ left: `${enemy.x}%`, top: `${enemy.y}%` }} data-enemy-id={enemy.id} data-enemy-level={enemy.level}>
            <div className="enemy-nameplate-title"><strong>{enemy.name}</strong><span>LVL {enemy.level}</span></div>
            <div className="enemy-nameplate-vitals">
              <WorldBar label={`${polish ? 'Kadłub' : 'Hull'} · ${enemy.name}`} value={enemy.health} maximum={enemy.maxHealth} />
              {enemy.maxShield > 0 && <WorldBar label={`${polish ? 'Osłona' : 'Shield'} · ${enemy.name}`} value={enemy.shield} maximum={enemy.maxShield} shield />}
            </div>
          </div>)}
        </div>
        <DamageDirectionIndicator hits={incomingDamage} language={language} />
        {waypoint && <div className={`world-waypoint${waypoint.behind ? ' is-behind' : ''}`} style={{ left: `${waypoint.x}%`, top: `${waypoint.y}%` }}>
          <span className="world-waypoint-diamond" aria-hidden="true">{waypoint.behind ? waypoint.x > 50 ? '↷' : '↶' : '◇'}</span>
          <strong>{waypoint.name}</strong><small>{formatDistance(waypoint.distance)}</small>
        </div>}
        {stationBeacons.map(beacon => <button key={beacon.id} type="button"
          className={`world-hangar-beacon${beacon.selected ? ' is-selected' : ''}`}
          style={{ left: `${beacon.x}%`, top: `${beacon.y}%` }}
          data-station-id={beacon.id} data-behind={beacon.behind}
          aria-label={`${polish ? 'Hangar' : 'Hangar'}: ${beacon.name}`}
          title={`${beacon.name} · ${polish ? 'Śledź stację' : 'Track station'}`}
          onClick={() => props.onTrackStation?.(beacon.id)}>
          <span aria-hidden="true">{beacon.behind ? (beacon.x > 40 ? '↷' : '↶') : '⌂'}</span>
          <strong>{beacon.name}</strong><small>{formatDistance(beacon.distance)}</small>
        </button>)}
        {merchantBeacon && <button type="button" className="world-merchant-beacon"
          style={{ left: `${merchantBeacon.x}%`, top: `${merchantBeacon.y}%` }}
          onClick={() => props.onTrackStation?.(MERCHANT_COURSE_ID)} aria-label={`${polish ? 'Kupiec' : 'Merchant'}: ${merchantBeacon.name}`}>
          <span aria-hidden="true">{merchantBeacon.behind ? (merchantBeacon.x > 40 ? '↷' : '↶') : '◇'}</span>
          <strong>{merchantBeacon.name}</strong><small>{formatDistance(merchantBeacon.distance)}</small>
        </button>}
        {(solarHeat.inZone || solarHeat.intensity > 0.01) && <aside className="world-heat-warning" role="status">
          <strong>{polish ? 'ŻAR GWIAZDY · POŻAR' : 'STELLAR HEAT · BURNING'}</strong>
          <span>{formatDistance(solarHeat.distance)} {polish ? 'od powierzchni słońca' : 'from the stellar surface'}</span>
          <WorldBar label={polish ? 'Rozgrzanie statku' : 'Ship heat'} value={solarHeat.intensity * 100} maximum={100} />
        </aside>}
        {combat.boss && <aside className="world-boss-vitals" aria-label={polish ? 'Stan bossa' : 'Boss status'}>
          <strong>{combat.mission?.title[language]}</strong>
          {combat.boss.charging && <span className="boss-volley-status">{polish ? 'Ładuje salwę' : 'Charging volley'}</span>}
          <WorldBar label={polish ? 'Kadłub bossa' : 'Boss hull'} value={combat.boss.health} maximum={combat.boss.maximumHealth} />
          {combat.boss.maximumShield > 0 && <WorldBar label={polish ? 'Osłona bossa' : 'Boss shield'} value={combat.boss.shield} maximum={combat.boss.maximumShield} shield />}
        </aside>}
        {combat.mission && !combat.boss && !orbitPlanet ? <aside className="world-encounter">
          <span>{polish ? 'LOKALNY SYGNAŁ' : 'LOCAL SIGNAL'}</span><strong>{combat.mission.title[language]}</strong>
          {combat.requiredObjectives > 0 && <small>{polish ? 'Postęp' : 'Progress'}: {combat.completedObjectives} / {combat.requiredObjectives}</small>}
        </aside> : combat.engaged && !combat.boss && !orbitPlanet && combat.faction && combat.targetName ? <aside className="world-encounter world-fleet-contact" aria-label={polish ? 'Wrogi statek' : 'Hostile ship'}>
          <span>{FACTIONS[combat.faction].name[language]}</span>
          <strong>{shipArchetypeName(combat.targetName, language)}</strong>
          <WorldBar label={polish ? 'Kadłub przeciwnika' : 'Hostile hull'} value={combat.targetHealth} maximum={combat.targetMaximumHealth} />
        </aside> : null}
        {station ? <aside className="world-station-contact" aria-label={polish ? 'Kontakt ze stacją' : 'Station contact'}>
          <h2>{station.name[language]}</h2>
          <button type="button" className="sector-scan-action" disabled={combat.engaged} onClick={() => { pendingDock.current = station.id }}>
            {station.planetId ? (polish ? 'Wyląduj na planecie' : 'Land on planet') : (polish ? 'Wleć do stacji' : 'Enter station')}
          </button>
          {station.planetId === nearestPlanet?.id && planetActions}
        </aside> : nearestPlanet && scanDistance <= PLANET_CONTACT_RANGE && !combat.engaged && <aside className="world-station-contact world-planet-contact">
          <h2>{nearestPlanet.name[language]}</h2>
          <small>{formatDistance(scanDistance)} {polish ? 'do powierzchni' : 'to surface'}</small>
          {planetActions}
        </aside>}
        {orbitPlanet && <aside className="world-orbit-contact" aria-label={polish ? 'Orbita planety' : 'Planet orbit'}>
          <strong>{orbitPlanet.name[language]}</strong>
          <small>{FACTIONS[orbitPlanet.orbitalFaction!].name[language]} · {orbitalFleet.remaining}/{orbitalFleet.total}</small>
          <button type="button" onClick={() => { pendingOrbit.current = { id: orbitPlanet.id, leaving: true } }}>{polish ? 'Opuść orbitę' : 'Leave orbit'}</button>
        </aside>}
        {!combat.engaged && !props.paused && (nearMerchant || atBoundary) && <div className="world-transit-actions">
          {nearMerchant && <button type="button" className="sector-scan-action" onClick={() => {
            if (distanceBetween(positionRef.current, world.merchant) <= world.merchant.tradeRange) props.onOpenMerchant()
          }}>{polish ? 'Handluj z Arką Wymiany' : 'Trade with the Exchange Ark'}</button>}
          {atBoundary && <button type="button" className="sector-scan-action" onClick={props.onOpenGalaxyChart}>
            {polish ? 'Otwórz mapę galaktyk' : 'Open galaxy chart'}
          </button>}
        </div>}
        {message && <p className="world-message" role="status">{message}</p>}
      </>}
      {props.boundaryCourse && <aside className="world-docking-status">
        <strong>{polish ? 'Lot do granicy galaktyki' : 'Flight to the galaxy boundary'}</strong>
        <WorldBar label={polish ? 'Postęp lotu do granicy' : 'Boundary flight progress'} value={boundaryProgress} maximum={100} shield />
      </aside>}
      {planetTravel.active && <aside className="world-docking-status planet-transit-status">
        <strong>{planetTravel.name}</strong><span>{planetTravel.leaving ? (polish ? 'Powrót w przestrzeń' : 'Returning to space') : (polish ? 'Podejście orbitalne' : 'Orbital approach')}</span>
        <WorldBar label={polish ? 'Postęp lotu orbitalnego' : 'Orbital transit progress'} value={planetTravel.progress * 100} maximum={100} shield />
      </aside>}
      {docking.active && <>
        <div className="world-docking-shade" style={{ opacity: docking.fade }} aria-hidden="true" />
        <aside className="world-docking-status"><span>{docking.stage === 'departure' ? (polish ? 'WYLOT' : 'DEPARTURE') : (polish ? 'DOKOWANIE' : 'DOCKING')}</span>
          <strong>{docking.stage === 'departure' ? (polish ? 'Opuszczanie śluzy stacji' : 'Leaving station airlock') : docking.stage === 'waiting' ? (polish ? 'Przygotowanie hangaru' : 'Preparing hangar') : docking.stage === 'airlock' ? (polish ? 'Przelot przez śluzę' : 'Passing through airlock') : (polish ? 'Podejście do stacji' : 'Station approach')}</strong>
          <WorldBar label={docking.stage === 'departure' ? (polish ? 'Postęp wylotu' : 'Departure progress') : (polish ? 'Postęp dokowania' : 'Docking progress')} value={docking.progress * 100} maximum={100} shield />
        </aside>
      </>}
    </main>
  )
}

function WorldBar({ label, value, maximum, shield = false }: { label: string; value: number; maximum: number; shield?: boolean }) {
  return <div className={`world-meter${shield ? ' is-shield' : ''}`} role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={Math.max(0, Math.round(value))}>
    <i style={{ width: `${clamp(value / Math.max(1, maximum) * 100, 0, 100)}%` }} />
  </div>
}

function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, value)) }
function formatDistance(distance: number) { return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.ceil(Math.max(0, distance))} m` }
function shipArchetypeName(archetype: string, language: 'pl' | 'en') {
  const labels: Record<string, { pl: string; en: string }> = {
    scout: { pl: 'Zwiadowca', en: 'Scout' }, interceptor: { pl: 'Przechwytywacz', en: 'Interceptor' },
    bomber: { pl: 'Bombowiec', en: 'Bomber' }, frigate: { pl: 'Fregata', en: 'Frigate' },
  }
  return labels[archetype]?.[language] ?? archetype
}
