import { gameText, localizedText, type GameLanguage } from '../i18n'
import { createPlanetLandscape } from './PlanetLandscape'
import { useEffect, useRef, useState } from 'react'
import {
  Color3,
  Color4,
  Engine,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  MeshBuilder,
  PointLight,
  Scene,
  ShadowGenerator,
  SpotLight,
  Vector3,
} from './babylon'
import { SHIP_PART_SLOTS, type EquippedPartRarities } from '../progress/shipParts'
import type { GraphicsSettings } from '../progress/gameSettings'
import { HANGAR_CREW, type HangarCrewMember } from '../hangar/crew'
import type { PlanetSite } from '../domain/exploration'
import { createShipVisual, setShipDrivePower, type ShipDrive } from './shipVisual'
import { showHullDamage } from './HullDamage'
import { createHangarRepair } from './HangarRepair'
import { createHangarStructure, createLandingMarkings, createWorkshopDetails } from './hangar/hangarStructure'
import { createPlanetView } from './hangar/hangarPlanetView'
import { HANGAR_DEPARTURE_DURATION, HANGAR_LANDING_DURATION, sampleSideHangarDeparture } from '../simulation/StationApproach'
import { HANGAR_LANDED_Y, HANGAR_SHIP_SCALE, LANDING_GEAR_GEOMETRY, sampleDepartureCompression, sampleDepartureLandingGear, sampleSideHangarLanding, type HangarLandingStage } from '../simulation/HangarLanding'
import { createLandingGear } from './LandingGear'
import { getHardwareScaling, spaceEffectsProfile } from './spaceEffectsProfile'
import { GameLoadingScreen } from '../ui/GameLoadingScreen'
import { createOnFootState, stepOnFoot } from '../simulation/OnFootController'
import { HANGAR_WALK_BOUNDS } from '../hangar/interior'
import { createCrewMaterial as createMaterial, createCrewMemberModel } from './crewModel'
import { advanceFootsteps, createFootstepState } from '../domain/footstepCadence'
import { playFootstep } from '../audio/footsteps'

/** Seconds the pilot takes to step out of the ship onto the hangar deck. */
const DISEMBARK_DURATION = 1.4
const PILOT_START = { x: 3, y: HANGAR_LANDED_Y - 0.2, z: 1.5 }
const PILOT_END = { x: 5.4, y: -1.08, z: 4.2 }

interface GarageCanvasProps {
  language: GameLanguage
  surfacePlanet?: PlanetSite
  previewPlanet: PlanetSite
  graphics: GraphicsSettings
  equippedPartRarities: EquippedPartRarities
  hullFraction: number
  startsLanded?: boolean
  entering?: boolean
  paused?: boolean
  departing?: boolean
  departureReady?: boolean
  walkMode?: boolean
  onReady?: () => void
  onLanded?: () => void
  onLandingStageChange?: (stage: HangarLandingStage) => void
  onDeparted?: () => void
  onBoardShip?: () => void
}

export function GarageCanvas({ language, surfacePlanet, previewPlanet, graphics, equippedPartRarities, hullFraction, startsLanded = false, entering = true, paused = false, departing = false, departureReady = false, walkMode = false, onReady, onLanded, onLandingStageChange, onDeparted, onBoardShip }: GarageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const enteringRef = useRef(entering)
  const pausedRef = useRef(paused)
  const walkModeRef = useRef(walkMode)
  const onReadyRef = useRef(onReady)
  const onLandedRef = useRef(onLanded)
  const onLandingStageRef = useRef(onLandingStageChange)
  const onBoardShipRef = useRef(onBoardShip)
  const hasLandedRef = useRef(startsLanded)
  const hullRef = useRef(hullFraction)
  const departureRef = useRef({ departing, ready: departureReady, onDeparted })
  useEffect(() => {
    enteringRef.current = entering
    pausedRef.current = paused
    walkModeRef.current = walkMode
    onReadyRef.current = onReady
    onLandedRef.current = onLanded
    onLandingStageRef.current = onLandingStageChange
    onBoardShipRef.current = onBoardShip
    departureRef.current = { departing, ready: departureReady, onDeparted }
  }, [entering, paused, walkMode, onReady, onLanded, onLandingStageChange, departing, departureReady, onDeparted, onBoardShip])
  useEffect(() => { hullRef.current = hullFraction }, [hullFraction])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !walkMode) {
      if (canvas && document.pointerLockElement === canvas) document.exitPointerLock?.()
      return
    }
    try { canvas.requestPointerLock?.()?.catch?.(() => {}) } catch { /* needs a user gesture; window click will retry */ }
  }, [walkMode])
  const weaponRarity = equippedPartRarities.weapon
  const shieldRarity = equippedPartRarities.shield
  const engineRarity = equippedPartRarities.engine
  const armorRarity = equippedPartRarities.armor
  const reactorRarity = equippedPartRarities.reactor
  const scannerRarity = equippedPartRarities.scanner

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(getHardwareScaling(graphics))
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.004, 0.009, 0.018, 1)
    scene.imageProcessingConfiguration.toneMappingEnabled = true
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    scene.imageProcessingConfiguration.contrast = 1.14

    const camera = new FreeCamera('hangarCamera', new Vector3(3.4, 3.1, -16), scene)
    camera.minZ = 0.1
    camera.setTarget(hasLandedRef.current ? new Vector3(1.5, .4, 3) : new Vector3(3, .4, 4))

    let walk = createOnFootState({ x: 0, y: 0, z: -6 }, 0)
    const walkKeys = new Set<string>()
    let walkYawDelta = 0
    let walkPitchDelta = 0
    let walkFootsteps = createFootstepState()
    const walkKeyDown = (event: KeyboardEvent) => {
      if (!walkModeRef.current) return
      if (event.code === 'KeyF') { onBoardShipRef.current?.(); return }
      walkKeys.add(event.code)
    }
    const walkKeyUp = (event: KeyboardEvent) => { walkKeys.delete(event.code) }
    const walkPointerMove = (event: PointerEvent) => {
      if (!walkModeRef.current || document.pointerLockElement !== canvas) return
      walkYawDelta += event.movementX
      // Invert vertical look so pushing the mouse up looks up.
      walkPitchDelta -= event.movementY
    }
    const walkPointerDown = () => {
      if (!walkModeRef.current || document.pointerLockElement === canvas) return
      try { canvas.requestPointerLock?.()?.catch?.(() => {}) } catch { /* pointer lock unsupported */ }
    }
    window.addEventListener('keydown', walkKeyDown)
    window.addEventListener('keyup', walkKeyUp)
    window.addEventListener('pointermove', walkPointerMove, true)
    window.addEventListener('pointerdown', walkPointerDown, true)

    const ambient = new HemisphericLight('hangarAmbient', new Vector3(0, 1, 0), scene)
    ambient.diffuse = new Color3(0.61, 0.76, 0.89)
    ambient.groundColor = new Color3(0.06, 0.09, 0.14)
    ambient.intensity = .31
    const keyLight = new PointLight('hangarKeyLight', new Vector3(-8.6, 4.68, -2.1), scene)
    keyLight.diffuse = new Color3(0.58, 0.82, 1)
    keyLight.range = 18
    keyLight.intensity = .84
    const rimLight = new PointLight('hangarRimLight', new Vector3(9.9, 4.68, 1), scene)
    rimLight.diffuse = new Color3(1, 0.64, 0.35)
    rimLight.range = 18
    rimLight.intensity = .72
    const padLight = new SpotLight('hangarPadLight', new Vector3(-3, 7.8, 2), new Vector3(0.31, -1, -0.06), 1.2, 2, scene)
    padLight.diffuse = new Color3(0.8, 0.92, 1)
    padLight.intensity = 1.43
    padLight.range = 19
    padLight.renderPriority = 2
    const quality = graphics.graphicsQuality
    const shadows = graphics.hangarShadows ? new ShadowGenerator(quality === 'low' ? 512 : quality === 'high' ? 1536 : 1024, padLight) : null
    if (shadows) {
      shadows.usePercentageCloserFiltering = quality !== 'low'
      shadows.bias = 0.002
      shadows.normalBias = 0.04
    }
    const effectsProfile = spaceEffectsProfile(quality)
    const glow = new GlowLayer('hangarGlow', scene, { mainTextureRatio: effectsProfile.glowRatio, blurKernelSize: effectsProfile.glowKernel })
    glow.intensity = effectsProfile.glowIntensity
    glow.isEnabled = graphics.bloom

    const floorMaterial = createMaterial(scene, 'hangarFloorMaterial', '#111d28', '#101c26')
    const wallMaterial = createMaterial(scene, 'hangarWallMaterial', '#182630', '#111c25')
    const trimMaterial = createMaterial(scene, 'hangarTrimMaterial', '#425967', '#243b4a')
    const warmLight = createMaterial(scene, 'hangarWarmLightMaterial', '#ffc071', '#f0a750')
    const coolLight = createMaterial(scene, 'hangarCoolLightMaterial', '#74dfff', '#52c9f5')
    const guideLight = createMaterial(scene, 'hangarApproachGuideMaterial', '#96eafb', '#459cb3')
    warmLight.emissiveColor = Color3.FromHexString('#ffb968').scale(0.9)
    coolLight.emissiveColor = Color3.FromHexString('#68dfff').scale(0.95)

    const floor = MeshBuilder.CreateBox('hangarFloor', { width: 25, height: 0.5, depth: 34 }, scene)
    floor.position.set(0, -1.35, 5)
    floor.material = floorMaterial
    floor.receiveShadows = true

    const landingPad = MeshBuilder.CreateCylinder('landingPad', {
      diameter: 12,
      height: 0.12,
      tessellation: 48,
    }, scene)
    landingPad.position.set(0, -1.03, 1.5)
    landingPad.material = createMaterial(scene, 'landingPadMaterial', '#23333f', '#162733')
    landingPad.receiveShadows = true
    createLandingMarkings(scene, trimMaterial, coolLight)
    createHangarStructure(scene, wallMaterial, trimMaterial, warmLight, coolLight)
    const portal = MeshBuilder.CreateTorus('hangarAperture', { diameter: 13.6, thickness: .3, tessellation: quality === 'low' ? 20 : 36 }, scene)
    portal.rotation.x = Math.PI / 2
    portal.scaling.z = .48
    portal.position.set(0, 2.37, -9.1)
    portal.material = trimMaterial
    const portalSigns = [-1, 1].map(side => {
      const marker = MeshBuilder.CreateTube('hangarApproachLights' + side, { path: [
        new Vector3(side * 6.55, 2.4, -9.3), new Vector3(side * 6.1, 3.6, -9.3),
        new Vector3(side * 4.25, 4.75, -9.3), new Vector3(side * 1.8, 5.36, -9.3),
      ], radius: .045, tessellation: 6 }, scene)
      marker.material = guideLight
      return marker
    })
    const apertureLight = new SpotLight('hangarApertureLight', new Vector3(0, 5.4, -8.7),
      new Vector3(0, -1, .55).normalize(), 1.52, 2, scene)
    apertureLight.diffuse = new Color3(.38, .79, .95)
    apertureLight.range = 17
    apertureLight.intensity = .33
    createWorkshopDetails(scene, floorMaterial, trimMaterial, warmLight, coolLight)
    const surfaceLandscape = surfacePlanet ? createPlanetLandscape(scene, surfacePlanet, quality) : null
    if (!surfacePlanet) createPlanetView(scene, glow, previewPlanet, graphics)
    canvas.dataset.surfacePlanet = surfacePlanet?.id ?? ''

    const ship = createShipVisual(scene, {
      weapon: weaponRarity,
      shield: shieldRarity,
      engine: engineRarity,
      armor: armorRarity,
      reactor: reactorRarity,
      scanner: scannerRarity,
    })
    ship.name = 'hangarPlayerShip'
    ship.position.set(0, hasLandedRef.current ? HANGAR_LANDED_Y : 1.3, hasLandedRef.current ? 1.5 : -9)
    ship.scaling.setAll(HANGAR_SHIP_SCALE)
    const landingGear = createLandingGear(scene, ship, trimMaterial, warmLight)
    landingGear.update(hasLandedRef.current ? 1 : 0, hasLandedRef.current ? LANDING_GEAR_GEOMETRY.loadedCompression : 0)
    canvas.dataset.gearDeployment = hasLandedRef.current ? '1.000' : '0.000'
    canvas.dataset.gearCompression = hasLandedRef.current ? LANDING_GEAR_GEOMETRY.loadedCompression.toFixed(4) : '0.0000'
    canvas.dataset.landingStage = hasLandedRef.current ? 'landed' : 'approach'
    if (hasLandedRef.current) {
      canvas.dataset.landingState = 'landed'
      canvas.dataset.landingProgress = '1.000'
    }
    for (const mesh of ship.getChildMeshes()) {
      if (!/^(shipEngineExhaust|hull-damage-)/.test(mesh.name)) shadows?.addShadowCaster(mesh)
    }
    const crew = HANGAR_CREW.map((member) => createCrewMemberModel(scene, member))
    const startedLanded = hasLandedRef.current
    const pilotMember: HangarCrewMember = {
      id: 'hangar-pilot', name: localizedText(text => text.crew.rheaVenn), role: localizedText(text => text.crew.rheaVenn),
      species: 'human', position: { x: 0, z: 0 },
      colors: { suit: '#2f6f8f', trim: '#9fd0e6', skin: '#d9a97a' }, dialogue: [],
    }
    const pilot = createCrewMemberModel(scene, pilotMember)
    pilot.position.set(PILOT_START.x, PILOT_START.y, PILOT_START.z)
    pilot.setEnabled(startedLanded)
    if (startedLanded) pilot.position.set(PILOT_END.x, PILOT_END.y, PILOT_END.z)
    let disembarkElapsed = startedLanded ? DISEMBARK_DURATION : -1
    const technician = crew.find(member => member.name === 'hangarCrew-k-7')
    const animateRepair = technician && createHangarRepair(scene, technician, ship)
    for (const member of crew) if (member !== technician) for (const mesh of member.getChildMeshes()) shadows?.addShadowCaster(mesh)
    const shadowMap = shadows?.getShadowMap()
    if (shadowMap) shadowMap.refreshRate = hasLandedRef.current ? 0 : 1
    let idleElapsed = 0
    let landingElapsed = hasLandedRef.current ? HANGAR_LANDING_DURATION : 0
    let landingStartedAt: number | null = null
    let ready = false
    let departureProgress = 0
    let departureCompleted = false
    const departureTarget = new Vector3()
    const drive = ship.metadata.drive as ShipDrive
    let landingStage: HangarLandingStage = hasLandedRef.current ? 'landed' : 'approach'
    scene.onBeforeRenderObservable.add(() => {
      showHullDamage(ship, hullRef.current)
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1)
      idleElapsed += dt
      surfaceLandscape?.update(dt)
      const transit = departureRef.current.departing || !hasLandedRef.current
      const pulse = transit ? .6 + .4 * Math.sin(idleElapsed * 5.6) ** 2 : .33
      apertureLight.intensity = .28 + pulse * .38
      for (const marker of portalSigns) marker.visibility = .35 + pulse * .65
      if (departureRef.current.departing && enteringRef.current && !pausedRef.current) {
        departureProgress = Math.min(departureRef.current.ready ? 1 : 0.82, departureProgress + Math.max(0, engine.getDeltaTime() / 1000) / HANGAR_DEPARTURE_DURATION)
        const pose = sampleSideHangarDeparture(departureProgress)
        const gear = sampleDepartureLandingGear(departureProgress)
        const compression = sampleDepartureCompression(departureProgress)
        landingGear.update(gear, compression)
        canvas.dataset.gearDeployment = gear.toFixed(3)
        canvas.dataset.gearCompression = compression.toFixed(4)
        ship.position.set(0, pose.y, pose.z)
        ship.rotation.y = pose.yaw
        setShipDrivePower(drive, pose.power, idleElapsed)
        camera.position.set(3.4 + pose.forward * 5.2, 3.1 + pose.lift * 1.8, -16 - pose.forward * 4.6)
        departureTarget.set(0, pose.y + .15, pose.z - pose.forward * 1.8)
        camera.setTarget(departureTarget)
        if (shadowMap) shadowMap.refreshRate = 1
        canvas.dataset.landingState = 'departing'
        canvas.dataset.departureProgress = departureProgress.toFixed(3)
        canvas.style.opacity = String(1 - pose.fade)
        if (departureProgress >= 1 && !departureCompleted) {
          departureCompleted = true
          departureRef.current.onDeparted?.()
        }
      } else if (enteringRef.current && !hasLandedRef.current) {
        landingStartedAt ??= performance.now()
        landingElapsed = Math.min(HANGAR_LANDING_DURATION, (performance.now() - landingStartedAt) / 1000)
        const p = landingElapsed / HANGAR_LANDING_DURATION
        const pose = sampleSideHangarLanding(p)
        landingGear.update(pose.gear, pose.compression)
        canvas.dataset.gearDeployment = pose.gear.toFixed(3)
        canvas.dataset.gearCompression = pose.compression.toFixed(4)
        canvas.dataset.landingProgress = p.toFixed(3)
        canvas.dataset.landingStage = pose.stage
        if (pose.stage !== landingStage) { landingStage = pose.stage; onLandingStageRef.current?.(pose.stage) }
        ship.position.set(0, pose.y, pose.z)
        setShipDrivePower(drive, p >= 1 ? 0 : (1 - p) * (.18 + (1 - pose.approach) * .36), idleElapsed)
        camera.position.set(3.4 + (1 - pose.approach) * 4.8, 3.1 + (1 - pose.approach) * 2, -16 - (1 - pose.approach) * 6)
        departureTarget.set(pose.approach * 1.5, .4 + .62 * (1 - pose.approach), pose.z + 1.5)
        camera.setTarget(departureTarget)
        canvas.dataset.landingState = 'landing'
        if (p >= 1) {
          hasLandedRef.current = true
          if (!startedLanded) { pilot.setEnabled(true); disembarkElapsed = 0 }
          if (shadowMap) {
            shadowMap.refreshRate = 0
            shadowMap.resetRefreshCounter()
          }
          canvas.dataset.landingState = 'landed'
          onLandedRef.current?.()
        }
      }
      const repairing = hasLandedRef.current && !departureRef.current.departing && hullRef.current < 1
      animateRepair?.(dt, idleElapsed, repairing, camera.position)
      const repairPhase = repairing ? 'working' : 'idle'
      if (canvas.dataset.repairDrone !== repairPhase) canvas.dataset.repairDrone = repairPhase
      crew.forEach((member, index) => {
        if (member === technician) return
        member.position.y = -1.08 + Math.sin(idleElapsed * 1.3 + index * 1.7) * .026
        const facing = Math.atan2(camera.position.x - member.position.x, camera.position.z - member.position.z)
        member.rotation.y = facing + (index % 3 - 1) * .15 + Math.sin(idleElapsed * .62 + index) * .065
      })
      if (disembarkElapsed >= 0 && disembarkElapsed < DISEMBARK_DURATION) {
        disembarkElapsed = Math.min(DISEMBARK_DURATION, disembarkElapsed + dt)
        const t = disembarkElapsed / DISEMBARK_DURATION
        const eased = t * t * (3 - 2 * t)
        pilot.position.set(
          PILOT_START.x + (PILOT_END.x - PILOT_START.x) * eased,
          PILOT_START.y + (PILOT_END.y - PILOT_START.y) * eased,
          PILOT_START.z + (PILOT_END.z - PILOT_START.z) * eased,
        )
        pilot.rotation.y = Math.atan2(PILOT_END.x - PILOT_START.x, PILOT_END.z - PILOT_START.z)
      }
      if (walkModeRef.current && hasLandedRef.current && !departureRef.current.departing) {
        const prevX = walk.position.x
        const prevZ = walk.position.z
        const running = walkKeys.has('ShiftLeft') || walkKeys.has('ShiftRight')
        walk = stepOnFoot(walk, {
          forward: (walkKeys.has('KeyW') ? 1 : 0) - (walkKeys.has('KeyS') ? 1 : 0),
          strafe: (walkKeys.has('KeyD') ? 1 : 0) - (walkKeys.has('KeyA') ? 1 : 0),
          run: walkKeys.has('ShiftLeft') || walkKeys.has('ShiftRight'),
          yawDelta: walkYawDelta,
          pitchDelta: walkPitchDelta,
        }, HANGAR_WALK_BOUNDS, dt)
        const step = advanceFootsteps(walkFootsteps, Math.hypot(walk.position.x - prevX, walk.position.z - prevZ), running)
        walkFootsteps = step.state
        if (step.stepped) playFootstep(running)
        walkYawDelta = 0
        walkPitchDelta = 0
        camera.position.set(walk.position.x, walk.position.y, walk.position.z)
        const planar = Math.cos(walk.pitch)
        departureTarget.set(
          walk.position.x + Math.sin(walk.yaw) * planar,
          walk.position.y + Math.sin(walk.pitch),
          walk.position.z + Math.cos(walk.yaw) * planar,
        )
        camera.setTarget(departureTarget)
      }
    })

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    // Compile the hidden hangar during approach, then leave the GPU to flight.
    engine.runRenderLoop(() => { if ((!pausedRef.current && enteringRef.current) || !ready) scene.render() })
    scene.executeWhenReady(() => {
      ready = true
      canvas.dataset.ready = 'true'
      setSceneReady(true)
      onReadyRef.current?.()
    })

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', walkKeyDown)
      window.removeEventListener('keyup', walkKeyUp)
      window.removeEventListener('pointermove', walkPointerMove, true)
      window.removeEventListener('pointerdown', walkPointerDown, true)
      if (document.pointerLockElement === canvas) document.exitPointerLock?.()
      scene.dispose()
      engine.dispose()
    }
  }, [weaponRarity, shieldRarity, engineRarity, armorRarity, reactorRarity, scannerRarity, surfacePlanet, previewPlanet, graphics])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="garage-world"
        aria-label={gameText(language).garageScene.view}
        data-equipped-parts={SHIP_PART_SLOTS.filter((slot) => equippedPartRarities[slot]).join(',')}
      />
      {!sceneReady && <GameLoadingScreen label={gameText(language).flight.preparingHangar} />}
    </>
  )
}


