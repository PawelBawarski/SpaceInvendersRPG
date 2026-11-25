import { useEffect, useRef, useState } from 'react'
import { Color3, Color4, Engine, FreeCamera, GlowLayer, HemisphericLight, Matrix, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { GameAudio } from '../audio/GameAudio'
import { DODGE_TIMING, resolveDamage } from '../domain/combat'
import { applyDamageResistance, type DamageType } from '../domain/damageTypes'
import { getDamageBearing, type DamageSource } from '../domain/damageFeedback'
import {
  distanceToPlanetSurface, findNearestPlanet, findNearbyPlanet, findNearestStation, resolveSafeFlightPosition,
  FACTIONS, ORION_PLANETS, ORION_SECTOR_BOUNDS, ORION_START_POSITION, ORION_SUN,
  type PlanetSite, type SectorPosition, type StationSite,
} from '../domain/exploration'
import { InputController, type ControlBindings } from '../input/InputController'
import { getMission, type MissionId } from '../missions/definitions'
import type { GraphicsQuality } from '../progress/gameSettings'
import type { MissionProgress } from '../progress/missionProgress'
import { getShipResistances } from '../progress/missionProgress'
import { SHIP_PART_SLOTS, type EquippedPartRarities, type ShipPartBonuses } from '../progress/shipParts'
import { advanceFlightMotion, FLIGHT_SPEEDS, getFlightTargetSpeed, integrateShipRoll, readFlightUpdate } from '../simulation/FlightSimulation'
import type { ShipTelemetry } from '../domain/shipTelemetry'
import { getShipVitals } from '../progress/shipMaintenance'
import { advanceSolarExposure, createSolarExposureState } from '../simulation/SolarExposure'
import { ShipStatusHud } from '../ui/ShipStatusHud'
import { DamageDirectionIndicator, type DamageFeedback } from '../ui/DamageDirectionIndicator'
import { createDamageNumber, updateDamageNumbers, type FloatingDamageNumber } from './DamageNumber'
import { createFlightEffects } from './FlightEffects'
import { createImpactEffect } from './ImpactEffect'
import { createPlanetScanEffect } from './PlanetScanEffect'
import { createSectorStarField } from './SectorStarField'
import { createShipVisual } from './shipVisual'
import { createSpaceEnvironment } from './spaceEnvironment'
import { createPlanetField } from './PlanetField'
import { createShipBurnEffect, createSunVisual } from './StarHazard'
import { createStationSystem } from './StationDocking'
import { createWorldCombat, type WorldCombatStatus } from './WorldCombat'
import { segmentSphereContact } from './worldCombatMath'
import { projectEnemyNameplates, type EnemyNameplate } from './EnemyNameplates'
import { spaceEffectsProfile } from './spaceEffectsProfile'
import './WorldSector.css'

interface SectorCanvasProps {
  language: 'pl' | 'en'
  graphicsQuality: GraphicsQuality
  controls: ControlBindings
  mainVolume: number
  shotsVolume: number
  musicVolume: number
  mouseSensitivity: number
  shipBonuses: ShipPartBonuses
  equippedPartRarities: EquippedPartRarities
  progress: MissionProgress
  activeMission: MissionId | null
  trackedStationId?: string | null
  paused: boolean
  renderActive?: boolean
  dockingReady: boolean
  departureStationId?: string | null
  onReady?: () => void
  onDepartureComplete?: () => void
  onPlanetScan: (planetId: string) => void
  onDroneDefeated: (droneId: string) => void
  onSectorPositionChange: (position: SectorPosition) => void
  onMissionComplete: (missionId: MissionId) => void
  onMissionObjectiveProgress: (missionId: MissionId, count: number) => void
  onDockingStart: (stationId: string) => void
  onDockingComplete: (stationId: string) => void
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
  const { language, graphicsQuality, controls, mainVolume, shotsVolume, musicVolume, mouseSensitivity,
    shipBonuses, equippedPartRarities, progress, activeMission, paused } = props
  const polish = language === 'pl'
  const live = useRef(props)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<InputController | null>(null)
  const audioRef = useRef<GameAudio | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const glowRef = useRef<GlowLayer | null>(null)
  const pendingDock = useRef<string | null>(null)
  const pendingScan = useRef<string | null>(null)
  const [initialPosition] = useState(() => resolveSafeFlightPosition({ x: progress.sectorX, y: progress.sectorY, z: progress.sectorDistance }))
  const positionRef = useRef<SectorPosition>(initialPosition)
  const [position, setPosition] = useState(initialPosition)
  const [nearestPlanet, setNearestPlanet] = useState<PlanetSite | null>(() => findNearestPlanet(initialPosition))
  const [scanDistance, setScanDistance] = useState(() => {
    const planet = findNearestPlanet(initialPosition)
    return planet ? distanceToPlanetSurface(initialPosition, planet) : 0
  })
  const [inScanRange, setInScanRange] = useState(() => findNearbyPlanet(initialPosition) !== null)
  const [station, setStation] = useState<StationSite | null>(null)
  const [vitals, setVitals] = useState(() => ({ ...getShipVitals(progress), dodge: 0 }))
  const [incomingDamage, setIncomingDamage] = useState<DamageFeedback[]>([])
  const [combat, setCombat] = useState(EMPTY_COMBAT)
  const [enemyNameplates, setEnemyNameplates] = useState<EnemyNameplate[]>([])
  const [waypoint, setWaypoint] = useState<Waypoint | null>(null)
  const [stationBeacons, setStationBeacons] = useState<StationBeacon[]>([])
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
  useEffect(() => {
    engineRef.current?.setHardwareScalingLevel(graphicsQuality === 'high' ? 0.85 : graphicsQuality === 'low' ? 1.5 : 1)
    if (glowRef.current) glowRef.current.intensity = spaceEffectsProfile(graphicsQuality).glowIntensity
  }, [graphicsQuality])
  useEffect(() => { if (paused) live.current.onSectorPositionChange({ ...positionRef.current }) }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const settings = live.current
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engineRef.current = engine
    engine.setHardwareScalingLevel(settings.graphicsQuality === 'high' ? 0.85 : settings.graphicsQuality === 'low' ? 1.5 : 1)
    const scene = new Scene(engine)
    scene.skipPointerMovePicking = true
    scene.skipPointerDownPicking = true
    scene.skipPointerUpPicking = true
    scene.clearColor = new Color4(0.001, 0.003, 0.008, 1)
    createSpaceEnvironment(scene, settings.graphicsQuality, { decorativePlanet: false, skyDiameter: ORION_SECTOR_BOUNDS.maxZ * 3 })
    const camera = new FreeCamera('sectorCamera', new Vector3(0, 6, -15), scene)
    // The chase camera stays over ten meters away; keep depth precision for large planets.
    camera.minZ = 1
    camera.maxZ = Math.max(140000, ORION_SECTOR_BOUNDS.maxZ * 2.5)
    const light = new HemisphericLight('sectorLight', new Vector3(0.3, 1, -0.25), scene)
    light.intensity = 0.34
    light.groundColor = new Color3(0.03, 0.05, 0.09)
    const effectsProfile = spaceEffectsProfile(settings.graphicsQuality)
    const glow = new GlowLayer('sectorGlow', scene, { mainTextureRatio: effectsProfile.glowRatio, blurKernelSize: effectsProfile.glowKernel })
    glow.intensity = effectsProfile.glowIntensity
    glowRef.current = glow
    const ship = new TransformNode('playerShip', scene)
    const rarityKey = (rarities: EquippedPartRarities) => SHIP_PART_SLOTS.map(slot => rarities[slot] ?? 'none').join(':')
    let appearanceKey = rarityKey(settings.equippedPartRarities)
    let appearance = createShipVisual(scene, settings.equippedPartRarities)
    appearance.name = 'playerShipAppearance'
    appearance.parent = ship
    ship.position.set(positionRef.current.x, positionRef.current.y, positionRef.current.z)
    camera.position.copyFrom(ship.position).addInPlaceFromFloats(0, 6, -15)
    camera.setTarget(ship.position.add(new Vector3(0, 0, 9)))
    const planets = createPlanetField(scene, ORION_PLANETS, settings.graphicsQuality)
    const sun = createSunVisual(scene, ORION_SUN, settings.graphicsQuality)
    const burning = createShipBurnEffect(scene, ship, settings.graphicsQuality)
    let solar = createSolarExposureState()
    let thermalTick = 0
    let thermalDamage = 0
    let resistances = getShipResistances(settings.progress)
    let previousLoadout = settings.progress.equippedParts
    const stars = createSectorStarField(scene, settings.graphicsQuality === 'high' ? 220 : settings.graphicsQuality === 'low' ? 90 : 150, ship.position)
    const baseCameraFov = camera.fov
    let effects = createFlightEffects(scene, ship, camera, settings.graphicsQuality, FLIGHT_SPEEDS.cruise)
    const stations = createStationSystem(scene, ship, camera, settings.graphicsQuality)
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
    const unlockAudio = () => audio.resume()
    window.addEventListener('keydown', unlockAudio, { once: true })
    const damageNumbers: FloatingDamageNumber[] = []
    const maximumShield = () => 100 + live.current.progress.shieldLevel * 10 + live.current.shipBonuses.shieldPoints
    const maximumHull = () => 100 + live.current.progress.shieldLevel * 5 + live.current.shipBonuses.hullPoints
    const initialVitals = getShipVitals(settings.progress)
    let shield = initialVitals.shield
    let hull = initialVitals.hull
    let speed = 0
    let collisionClock = 0
    let dodgeRemaining = 0
    let dodgeElapsed = 1
    let hudClock = 0
    let saveClock = 0
    let messageClock = 0
    let engaged = false
    let completedDocking = false
    let damageSequence = 0
    const showMessage = (pl: string, en: string) => {
      setMessage(live.current.language === 'pl' ? pl : en)
      messageClock = 5
    }
    const receiveDamage = (amount: number, type: DamageType = 'kinetic', continuous = false, source?: DamageSource) => {
      const resistedAmount = applyDamageResistance(amount, type, resistances)
      const damage = resolveDamage({ amount: resistedAmount, shield, dodgeElapsed, activeDodge: !continuous && dodgeElapsed < 0.48 })
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
        createImpactEffect(scene, ship.position, new Color3(1, 0.23, 0.12), 0.7)
        setImpactFlash(value => value + 1)
      }
    }
    const worldCombat = createWorldCombat(scene, {
      getProgress: () => live.current.progress,
      onPlayerHit: (amount, source) => receiveDamage(amount, 'kinetic', false, source),
      onEnemyDefeated: id => live.current.onDroneDefeated(id),
      onMissionComplete: id => live.current.onMissionComplete(id),
      onMissionProgress: (id, count) => live.current.onMissionObjectiveProgress(id, count),
      onMessage: showMessage,
      onShot: () => audio.playShot(),
      onImpact: () => {},
      damageNumbers,
    })
    const moveSafely = (destination: Vector3) => {
      let contact = Infinity
      let collision: PlanetSite | null = null
      for (const planet of ORION_PLANETS) {
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
      const nearest = findNearestStation(ship.position)
      const beacon = project(nearest, nearest.name[live.current.language])
      if (guide && Math.abs(guide.x - beacon.x) < 18 && Math.abs(guide.y - beacon.y) < 10) beacon.y = beacon.y > 45 ? beacon.y - 12 : beacon.y + 12
      setStationBeacons([{ ...beacon, id: nearest.id, selected: nearest.id === live.current.trackedStationId }])
    }
    const resize = () => engine.resize()
    window.addEventListener('resize', resize)
    scene.onBeforeRenderObservable.add(() => {
      updateDamageNumbers(damageNumbers)
      const current = live.current
      effects.setPaused(current.paused)
      if (current.paused) audio.updateEngine(0, 0)
      if (current.paused) burning.update(0, solar.burningIntensity, true)
      if (current.paused || current.renderActive === false) return
      const realDt = Math.min(engine.getDeltaTime() / 1000, 0.15)
      const dt = realDt
      if (previousLoadout !== current.progress.equippedParts) {
        previousLoadout = current.progress.equippedParts
        resistances = getShipResistances(current.progress)
      }
      const nextAppearanceKey = rarityKey(current.equippedPartRarities)
      if (nextAppearanceKey !== appearanceKey) {
        effects.dispose()
        appearance.dispose(false, true)
        appearance = createShipVisual(scene, current.equippedPartRarities)
        appearance.name = 'playerShipAppearance'
        appearance.parent = ship
        appearanceKey = nextAppearanceKey
        camera.fov = baseCameraFov
        effects = createFlightEffects(scene, ship, camera, current.graphicsQuality, FLIGHT_SPEEDS.cruise)
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
          current.onSectorPositionChange({ x: ship.position.x, y: ship.position.y, z: ship.position.z })
          current.onDockingStart(id)
          speed = 0
        }
      }
      const dock = stations.update(engine.getDeltaTime() / 1000, current.dockingReady)
      if (dock.active || dock.complete) {
        effects.setPaused(true)
        audio.updateEngine(0, 0)
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
            current.onSectorPositionChange({ ...positionRef.current })
            current.onDepartureComplete?.()
          } else if (!completedDocking) {
            completedDocking = true
            current.onDockingComplete(dock.stationId)
          }
        }
        return
      }
      collisionClock = Math.max(0, collisionClock - dt)
      dodgeRemaining = Math.max(0, dodgeRemaining - dt)
      dodgeElapsed += dt
      messageClock = Math.max(0, messageClock - dt)
      if (messageClock === 0) setMessage(previous => previous ? '' : previous)
      hudClock += dt
      saveClock += dt
      const commands = readFlightUpdate(command => input.isDown(command), input.readMouseFlight())
      const bonuses = current.shipBonuses
      const handling = 1 + (bonuses.handlingPercent ?? 0) / 100
      ship.rotation.x = clamp(ship.rotation.x + commands.pitch * dt * 1.1 * handling, -1.25, 1.25)
      ship.rotation.y += commands.yaw * dt * 1.25 * handling
      ship.rotation.z = integrateShipRoll(ship.rotation.z, commands.roll, dt, handling)
      ship.computeWorldMatrix(true)
      const forward = ship.getDirection(Vector3.Forward()).normalize()
      const right = ship.getDirection(Vector3.Right()).normalize()
      const previousPosition = ship.position.clone()
      const nearest = findNearestPlanet(ship.position)
      const surfaceDistance = nearest ? distanceToPlanetSurface(ship.position, nearest) : Infinity
      const motion = advanceFlightMotion(speed, getFlightTargetSpeed(commands.thrust, bonuses), dt)
      speed = motion.speed
      moveSafely(ship.position.add(forward.scale(motion.distance)))
      if (commands.dodgeRequested && dodgeRemaining <= 0) {
        dodgeRemaining = DODGE_TIMING.cooldown
        dodgeElapsed = 0
        moveSafely(ship.position.add(right.scale(commands.yaw < 0 ? -7 : 7)))
      }
      ship.position.x = clamp(ship.position.x, ORION_SECTOR_BOUNDS.minX, ORION_SECTOR_BOUNDS.maxX)
      ship.position.y = clamp(ship.position.y, ORION_SECTOR_BOUNDS.minY, ORION_SECTOR_BOUNDS.maxY)
      ship.position.z = clamp(ship.position.z, ORION_SECTOR_BOUNDS.minZ, ORION_SECTOR_BOUNDS.maxZ)
      const velocity = ship.position.subtract(previousPosition).scale(1 / Math.max(0.001, dt))
      camera.position.copyFrom(Vector3.Lerp(camera.position, ship.position.subtract(forward.scale(15)).add(new Vector3(0, 6, 0)), Math.min(1, dt * 3.5)))
      camera.setTarget(ship.position.add(forward.scale(9)))
      effects.update(dt, speed, commands.thrust)
      const engineSound = audio.updateEngine(speed / FLIGHT_SPEEDS.cruise, commands.thrust)
      if (canvas.dataset.engineSound !== engineSound.mode) canvas.dataset.engineSound = engineSound.mode
      solar = advanceSolarExposure(solar, dt, ship.position, ORION_SUN)
      thermalTick += dt
      thermalDamage += solar.thermalDamage
      if (thermalTick >= 0.5) {
        if (thermalDamage > 0) receiveDamage(thermalDamage, 'thermal', true, { position: ORION_SUN, label: ORION_SUN.name, kind: 'heat' })
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
      positionRef.current = { x: ship.position.x, y: ship.position.y, z: ship.position.z }
      stars.update(ship.position)
      planets.update(dt, ship.position)
      if (pendingScan.current) {
        const site = ORION_PLANETS.find(planet => planet.id === pendingScan.current)
        pendingScan.current = null
        if (site && findNearbyPlanet(ship.position)?.id === site.id) {
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
        canvas.dataset.flightSpeed = speed.toFixed(1)
        canvas.dataset.throttle = String(commands.thrust)
        setPosition({ ...positionRef.current })
        setNearestPlanet(nearest)
        setScanDistance(surfaceDistance)
        setInScanRange(findNearbyPlanet(ship.position) !== null)
        setStation(stations.getNearbyStation(ship.position))
        setVitals({ shield, hull, dodge: dodgeRemaining })
        current.onShipStatusChange?.({ shield, hull, speed, dodgeRemaining, burningIntensity: solar.burningIntensity })
        setCombat(status)
        setEnemyNameplates(projectEnemyNameplates(worldCombat.getNameplateTargets(), camera, ORION_PLANETS, current.language))
        setSolarHeat({ intensity: solar.burningIntensity, distance: solar.distanceToSurface, inZone: solar.inZone })
        updateWaypoint()
      }
      if (saveClock >= 0.8) {
        saveClock = 0
        current.onSectorPositionChange({ ...positionRef.current })
      }
    })
    let ready = false
    scene.executeWhenReady(() => { ready = true; canvas.dataset.ready = 'true'; live.current.onReady?.() })
    engine.runRenderLoop(() => {
      if (live.current.renderActive !== false || !ready) scene.render()
    })
    return () => {
      live.current.onShipStatusChange?.({ shield, hull, speed, dodgeRemaining, burningIntensity: solar.burningIntensity })
      live.current.onSectorPositionChange({ x: ship.position.x, y: ship.position.y, z: ship.position.z })
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', unlockAudio)
      input.dispose()
      audio.dispose()
      effects.dispose()
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
      engineRef.current = null
      glowRef.current = null
    }
  }, [])

  const tracked = activeMission && !props.trackedStationId ? getMission(activeMission) : null
  const visited = nearestPlanet ? progress.visitedPlanets.includes(nearestPlanet.id) : false
  return (
    <main className="game-shell sector-shell world-sector" data-world-position={`${Math.round(position.x)},${Math.round(position.y)},${Math.round(position.z)}`}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="Neon Void explorable space sector"
        data-equipped-parts={SHIP_PART_SLOTS.filter(slot => equippedPartRarities[slot]).join(',')} />
      {impactFlash > 0 && <div key={impactFlash} className="impact-flash" aria-hidden="true" />}
      {!docking.active && <>
        <div className="enemy-nameplates" aria-label={polish ? 'Przeciwnicy w zasięgu wzroku' : 'Visible enemies'}>
          {enemyNameplates.map(enemy => <div key={enemy.id} className={`enemy-nameplate${enemy.boss ? ' is-boss' : ''}`}
            style={{ left: `${enemy.x}%`, top: `${enemy.y}%` }} data-enemy-id={enemy.id} data-enemy-level={enemy.level}>
            <strong>{enemy.name}</strong><span>LVL {enemy.level}</span>
          </div>)}
        </div>
        <header className="game-hud sector-header world-header">
          <div className="sector-readout"><strong>ORION-7</strong><span>{polish ? 'Otwarty wszechświat' : 'Open universe'}</span></div>
        </header>
        <ShipStatusHud language={language} shield={vitals.shield} maxShield={100 + progress.shieldLevel * 10 + shipBonuses.shieldPoints}
          hull={vitals.hull} maxHull={100 + progress.shieldLevel * 5 + shipBonuses.hullPoints} dodgeRemaining={vitals.dodge} />
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
        {(solarHeat.inZone || solarHeat.intensity > 0.01) && <aside className="world-heat-warning" role="status">
          <strong>{polish ? 'ŻAR GWIAZDY · POŻAR' : 'STELLAR HEAT · BURNING'}</strong>
          <span>{formatDistance(solarHeat.distance)} {polish ? 'od powierzchni słońca' : 'from the stellar surface'}</span>
          <WorldBar label={polish ? 'Rozgrzanie statku' : 'Ship heat'} value={solarHeat.intensity * 100} maximum={100} />
        </aside>}
        {combat.boss && <aside className="world-boss-vitals" aria-label={polish ? 'Stan bossa' : 'Boss status'}>
          <strong>{combat.mission?.title[language]}</strong>
          <WorldBar label={polish ? 'Kadłub bossa' : 'Boss hull'} value={combat.boss.health} maximum={combat.boss.maximumHealth} />
          {combat.boss.maximumShield > 0 && <WorldBar label={polish ? 'Osłona bossa' : 'Boss shield'} value={combat.boss.shield} maximum={combat.boss.maximumShield} shield />}
        </aside>}
        {combat.mission ? <aside className="world-encounter">
          <span>{polish ? 'LOKALNY SYGNAŁ' : 'LOCAL SIGNAL'}</span><strong>{combat.mission.title[language]}</strong>
          <p>{combat.mission.briefing[language]}</p>
          {combat.requiredObjectives > 0 && <small>{polish ? 'Postęp' : 'Progress'}: {combat.completedObjectives} / {combat.requiredObjectives}</small>}
        </aside> : combat.engaged && combat.faction && combat.targetName ? <aside className="world-encounter world-fleet-contact" aria-label={polish ? 'Wrogi statek' : 'Hostile ship'}>
          <span>{FACTIONS[combat.faction].name[language]}</span>
          <strong>{shipArchetypeName(combat.targetName, language)}</strong>
          <WorldBar label={polish ? 'Kadłub przeciwnika' : 'Hostile hull'} value={combat.targetHealth} maximum={combat.targetMaximumHealth} />
        </aside> : tracked && <aside className="world-encounter world-tracked-objective">
          <span>{polish ? 'ŚLEDZONY SYGNAŁ' : 'TRACKED SIGNAL'}</span><strong>{tracked.title[language]}</strong>
          <p>{tracked.briefing[language]}</p>
        </aside>}
        {station ? <aside className="world-station-contact" aria-label={polish ? 'Kontakt ze stacją' : 'Station contact'}>
          <span>{polish ? 'KONTROLA LOTÓW' : 'FLIGHT CONTROL'}</span><h2>{station.name[language]}</h2>
          <p>{combat.engaged ? (polish ? 'Zgub przeciwników przed dokowaniem.' : 'Clear the hostiles before docking.') : (polish ? 'Pas podejścia otwarty. Hangar i warsztat dostępne.' : 'Approach corridor open. Hangar and workshop available.')}</p>
          <button type="button" className="sector-scan-action" disabled={combat.engaged} onClick={() => { pendingDock.current = station.id }}>
            {polish ? 'Wleć do stacji' : 'Enter station'}
          </button>
        </aside> : nearestPlanet && !combat.engaged && <aside className="world-station-contact world-planet-contact">
          <span>{polish ? 'SYGNAŁ PLANETARNY' : 'PLANETARY SIGNAL'}</span><h2>{nearestPlanet.name[language]}</h2>
          <small>{formatDistance(scanDistance)} {polish ? 'do powierzchni' : 'to surface'}</small>
          <button type="button" className="sector-scan-action" disabled={!inScanRange || visited} onClick={() => { pendingScan.current = nearestPlanet.id }}>
            {visited ? (polish ? 'Obiekt zbadany' : 'Site surveyed') : inScanRange ? (polish ? 'Zeskanuj i odzyskaj zasoby' : 'Scan and recover resources') : (polish ? 'Zbliż się, aby skanować' : 'Approach to scan')}
          </button>
        </aside>}
        {message && <p className="world-message" role="status">{message}</p>}
      </>}
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
