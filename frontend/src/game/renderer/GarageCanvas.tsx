import { gameText, type GameLanguage } from '../i18n'
import { createPlanetLandscape } from './PlanetLandscape'
import { useEffect, useRef } from 'react'
import {
  Color3,
  Color4,
  DynamicTexture,
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
  StandardMaterial,
  TransformNode,
  Vector3,
} from './babylon'
import { SHIP_PART_SLOTS, type EquippedPartRarities } from '../progress/shipParts'
import type { GraphicsSettings } from '../progress/gameSettings'
import { HANGAR_CREW, type HangarCrewMember } from '../hangar/crew'
import type { PlanetSite } from '../domain/exploration'
import { createShipVisual, setShipDrivePower, type ShipDrive } from './shipVisual'
import { showHullDamage } from './HullDamage'
import { createHangarRepair } from './HangarRepair'
import { createPlanetVisual } from './spaceEnvironment'
import { HANGAR_DEPARTURE_DURATION, HANGAR_LANDING_DURATION, sampleHangarDeparture } from '../simulation/StationApproach'
import { HANGAR_LANDED_Y, HANGAR_SHIP_SCALE, LANDING_GEAR_GEOMETRY, sampleDepartureCompression, sampleDepartureLandingGear, sampleHangarLanding, type HangarLandingStage } from '../simulation/HangarLanding'
import { createLandingGear } from './LandingGear'
import { getHardwareScaling, spaceEffectsProfile } from './spaceEffectsProfile'

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
  onReady?: () => void
  onLanded?: () => void
  onLandingStageChange?: (stage: HangarLandingStage) => void
  onDeparted?: () => void
}

export function GarageCanvas({ language, surfacePlanet, previewPlanet, graphics, equippedPartRarities, hullFraction, startsLanded = false, entering = true, paused = false, departing = false, departureReady = false, onReady, onLanded, onLandingStageChange, onDeparted }: GarageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const enteringRef = useRef(entering)
  const pausedRef = useRef(paused)
  const onReadyRef = useRef(onReady)
  const onLandedRef = useRef(onLanded)
  const onLandingStageRef = useRef(onLandingStageChange)
  const hasLandedRef = useRef(startsLanded)
  const hullRef = useRef(hullFraction)
  const departureRef = useRef({ departing, ready: departureReady, onDeparted })
  useEffect(() => {
    enteringRef.current = entering
    pausedRef.current = paused
    onReadyRef.current = onReady
    onLandedRef.current = onLanded
    onLandingStageRef.current = onLandingStageChange
    departureRef.current = { departing, ready: departureReady, onDeparted }
  }, [entering, paused, onReady, onLanded, onLandingStageChange, departing, departureReady, onDeparted])
  useEffect(() => { hullRef.current = hullFraction }, [hullFraction])
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
    if (surfacePlanet) createPlanetLandscape(scene, surfacePlanet, quality)
    else createPlanetView(scene, glow, previewPlanet, graphics)
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
    const crew = HANGAR_CREW.map((member) => createHangarCrewMember(scene, member))
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
      const transit = departureRef.current.departing || !hasLandedRef.current
      const pulse = transit ? .6 + .4 * Math.sin(idleElapsed * 5.6) ** 2 : .33
      apertureLight.intensity = .28 + pulse * .38
      for (const marker of portalSigns) marker.visibility = .35 + pulse * .65
      if (departureRef.current.departing && enteringRef.current && !pausedRef.current) {
        departureProgress = Math.min(departureRef.current.ready ? 1 : 0.82, departureProgress + Math.max(0, engine.getDeltaTime() / 1000) / HANGAR_DEPARTURE_DURATION)
        const pose = sampleHangarDeparture(departureProgress)
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
        const pose = sampleHangarLanding(p)
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
    })

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    // Compile the hidden hangar during approach, then leave the GPU to flight.
    engine.runRenderLoop(() => { if ((!pausedRef.current && enteringRef.current) || !ready) scene.render() })
    scene.executeWhenReady(() => {
      ready = true
      canvas.dataset.ready = 'true'
      onReadyRef.current?.()
    })

    return () => {
      window.removeEventListener('resize', onResize)
      scene.dispose()
      engine.dispose()
    }
  }, [weaponRarity, shieldRarity, engineRarity, armorRarity, reactorRarity, scannerRarity, surfacePlanet, previewPlanet, graphics])

  return (
    <canvas
      ref={canvasRef}
      className="garage-world"
      aria-label={gameText(language).garageScene.view}
      data-equipped-parts={SHIP_PART_SLOTS.filter((slot) => equippedPartRarities[slot]).join(',')}
    />
  )
}

function createHangarCrewMember(scene: Scene, member: HangarCrewMember): TransformNode {
  const root = new TransformNode(`hangarCrew-${member.id}`, scene)
  root.position.set(member.position.x, -1.08, member.position.z)
  if (member.species === 'alien') root.scaling.setAll(1.1)

  const suit = createMaterial(scene, `crewSuit-${member.id}`, member.colors.suit, '#121d27')
  suit.diffuseColor = Color3.Lerp(suit.diffuseColor, new Color3(0.1, 0.16, 0.22), .27)
  suit.emissiveColor = suit.diffuseColor.scale(.12)
  const trim = createMaterial(scene, `crewTrim-${member.id}`, member.colors.trim, '#13202a')
  trim.diffuseColor = trim.diffuseColor.scale(.88)
  trim.emissiveColor = trim.diffuseColor.scale(.2)
  const dark = createMaterial(scene, `crewArmor-${member.id}`, '#18232c', '#0b131d')
  const visorMaterial = createMaterial(scene, `crewVisorMaterial-${member.id}`, '#102b38', '#1b617b')
  visorMaterial.emissiveColor = new Color3(.025, .08, .108)
  visorMaterial.specularColor = new Color3(0.5, 0.75, 0.9)
  visorMaterial.specularPower = 120
  const oval = (name: string, material: StandardMaterial, size: [number, number, number], at: [number, number, number]) => {
    const mesh = MeshBuilder.CreateSphere(name + '-' + member.id, { diameter: 1, segments: 14 }, scene)
    mesh.parent = root
    mesh.scaling.set(...size)
    mesh.position.set(...at)
    mesh.material = material
    mesh.isPickable = false
    return mesh
  }
  if (member.species === 'robot') {
    const optic = createMaterial(scene, 'crewRobotOptic', member.colors.trim, member.colors.trim)
    optic.disableLighting = true
    optic.emissiveColor = Color3.FromHexString(member.colors.trim).scale(.85)
    suit.diffuseColor = Color3.FromHexString(member.colors.suit)
    suit.specularPower = 88
    oval('crewRobotCore', suit, [.91, .76, .68], [0, .98, 0])
    oval('crewRobotUnderbody', dark, [.61, .28, .55], [0, .64, 0])
    oval('crewRobotOpticalHousing', dark, [.68, .31, .42], [0, 1.09, .23])
    oval('crewRobotOptics', visorMaterial, [.59, .21, .36], [0, 1.09, .29])
    for (const side of [-1, 1]) {
      oval('crewRobotEye' + side, optic, [.12, .105, .07], [side * .135, 1.10, .452])
      oval('crewRobotArmJoint' + side, trim, [.22, .23, .23], [side * .44, .98, -.01])
      oval('crewRobotServo' + side, dark, [.19, .39, .22], [side * .52, .76, .04]).rotation.z = side * .32
      oval('crewRobotGripper' + side, suit, [.17, .17, .24], [side * .56, .6, .14])
    }
    const hoverRing = MeshBuilder.CreateTorus('crewHoverRing-' + member.id, { diameter: .46, thickness: .042, tessellation: 18 }, scene)
    hoverRing.parent = root
    hoverRing.position.y = .56
    hoverRing.material = optic
    return root
  }
  const avian = member.species === 'avian'
  oval('crewBody', suit, [.65, .84, .43], [0, 1.04, 0])

  const head = MeshBuilder.CreateSphere(`crewHelmet-${member.id}`, { diameter: 0.54, segments: 16 }, scene)
  if (avian) {
    const hood = createMaterial(scene, 'crewAvianHood', member.colors.skin, '#332435')
    oval('crewAvianCollar', trim, [.6, .18, .43], [0, 1.44, .01])
    head.scaling.set(.93, 1.28, .89)
    head.material = hood
    for (const side of [-1, 1]) oval('crewAvianCrest' + side, suit, [.14, .36, .27], [side * .135, 1.95, -.09]).rotation.z = -side * .32
  }
  head.position.y = 1.72
  head.parent = root
  head.material ??= dark

  const visor = MeshBuilder.CreateSphere(`crewVisor-${member.id}`, { diameter: 0.43, segments: 12 }, scene)
  visor.scaling.set(avian ? .96 : 1, avian ? .32 : .45, .4)
  visor.position.set(0, 1.75, 0.21)
  visor.parent = root
  visor.material = visorMaterial
  if (avian) {
    for (const side of [-1, 1]) oval('crewAvianEye' + side, trim, [.1, .029, .046], [side * .094, 1.756, .288]).rotation.z = side * .16
    oval('crewAvianRespirator', dark, [.19, .23, .21], [0, 1.63, .221])
  }

  oval('crewChestPlate', dark, [.48, .38, .16], [0, 1.13, .19])
  const patch = MeshBuilder.CreateBox(`crewIdentityPatch-${member.id}`, { width: 0.12, height: 0.09, depth: 0.02 }, scene)
  patch.parent = root
  patch.position.set(-0.1, 1.21, 0.245)
  patch.material = trim
  const radio = MeshBuilder.CreateBox(`crewComms-${member.id}`, { width: .095, height: .19, depth: .085 }, scene)
  radio.parent = root
  radio.position.set(.23, 1.28, .175)
  radio.material = dark
  const belt = MeshBuilder.CreateBox(`crewUtilityBelt-${member.id}`, { width: 0.59, height: 0.13, depth: 0.4 }, scene)
  belt.parent = root
  belt.position.y = 0.71
  belt.material = dark

  const legs = [-1, 1]
  for (const side of legs) {
    const arm = MeshBuilder.CreateCylinder(`crewArm-${member.id}-${side}`, {
      height: 0.76,
      diameter: 0.17,
      tessellation: 10,
    }, scene)
    arm.position.set(side * 0.37, 0.94, 0)
    arm.rotation.z = side * -0.18
    arm.parent = root
    arm.material = suit

    const leg = MeshBuilder.CreateCylinder(`crewLeg-${member.id}-${side}`, {
      height: 0.62,
      diameter: 0.22,
      tessellation: 10,
    }, scene)
    leg.position.set(side * 0.17, 0.34, 0)
    leg.parent = root
    leg.material = suit

    const boot = MeshBuilder.CreateBox(`crewBoot-${member.id}-${side}`, {
      width: 0.3,
      height: 0.15,
      depth: 0.42,
    }, scene)
    boot.position.set(side * 0.17, 0.035, 0.06)
    boot.parent = root
    boot.material = dark

    oval('crewShoulder' + side, trim, [avian ? .33 : .24, .23, .31], [side * .34, 1.29, .01]).rotation.z = side * -.12
  }

  const pack = MeshBuilder.CreateBox(`crewPack-${member.id}`, {
    width: 0.44,
    height: 0.55,
    depth: 0.24,
  }, scene)
  pack.position.set(0, 1.05, -0.34)
  pack.parent = root
  pack.material = dark

  if (member.species === 'alien') {
    for (const side of [-1, 1]) {
      const antenna = MeshBuilder.CreateCylinder(`crewAntenna-${member.id}-${side}`, {
        height: 0.42,
        diameter: 0.07,
        tessellation: 6,
      }, scene)
      antenna.position.set(side * 0.17, 2.12, -0.02)
      antenna.rotation.z = side * 0.34
      antenna.parent = root
      antenna.material = trim
      const tip = MeshBuilder.CreateSphere(`crewAntennaTip-${member.id}-${side}`, { diameter: 0.14 }, scene)
      tip.position.set(side * 0.24, 2.3, -0.02)
      tip.parent = root
      tip.material = trim
    }
  }

  return root
}

function createHangarStructure(
  scene: Scene,
  wallMaterial: StandardMaterial,
  trimMaterial: StandardMaterial,
  warmLight: StandardMaterial,
  coolLight: StandardMaterial,
): void {
  for (const side of [-1, 1]) {
    const rearWall = MeshBuilder.CreateBox(`hangarRearWall${side}`, { width: 4.5, height: 12, depth: 1 }, scene)
    rearWall.position.set(side * 10.25, 4.7, 17)
    rearWall.material = wallMaterial
  }

  const rearLintel = MeshBuilder.CreateBox('hangarRearLintel', { width: 16, height: 2.5, depth: 1 }, scene)
  rearLintel.position.set(0, 9.45, 17)
  rearLintel.material = wallMaterial

  for (const side of [-1, 1]) {
    const sideWall = MeshBuilder.CreateBox(`hangarSideWall${side}`, { width: 1, height: 9, depth: 28 }, scene)
    sideWall.position.set(side * 12, 3.2, 4)
    sideWall.material = wallMaterial

    const doorwayPillar = MeshBuilder.CreateBox(`hangarDoorPillar${side}`, {
      width: 0.8,
      height: 7.5,
      depth: 1.1,
    }, scene)
    doorwayPillar.position.set(side * 10, 2.45, 10)
    doorwayPillar.material = trimMaterial

    const sideStrip = MeshBuilder.CreateBox(`hangarSideLight${side}`, {
      width: 0.08,
      height: 0.08,
      depth: 16,
    }, scene)
    sideStrip.position.set(side * 10.1, 4.8, 1)
    sideStrip.material = side === -1 ? coolLight : warmLight
    const housing = MeshBuilder.CreateBox(`hangarLampHousing${side}`, { width: .34, height: .22, depth: 16.2 }, scene)
    housing.position.set(side * 10.25, 4.87, 1)
    housing.material = trimMaterial
  }

  const upperBeam = MeshBuilder.CreateBox('hangarDoorBeam', { width: 21, height: 0.9, depth: 1.1 }, scene)
  upperBeam.position.set(0, 6.2, 10)
  upperBeam.material = trimMaterial

  for (let index = 0; index < 4; index += 1) {
    const ceilingRib = MeshBuilder.CreateBox(`hangarCeilingRib${index}`, {
      width: 24,
      height: 0.3,
      depth: 0.4,
    }, scene)
    ceilingRib.position.set(0, 8.2, index * 6 - 4)
    ceilingRib.material = trimMaterial
    const fixture = MeshBuilder.CreateBox(`hangarCeilingLamp${index}`, { width: 2.4, height: .055, depth: .25 }, scene)
    fixture.position.set(-3, 8.015, index * 6 - 4)
    fixture.material = coolLight
  }
}

function createLandingMarkings(
  scene: Scene,
  trimMaterial: StandardMaterial,
  coolLight: StandardMaterial,
): void {
  for (const side of [-1, 1]) {
    const guide = MeshBuilder.CreateBox(`landingGuide${side}`, {
      width: 0.12,
      height: 0.025,
      depth: 11,
    }, scene)
    guide.position.set(side * 4.7, -0.95, 1.5)
    guide.material = coolLight
  }

  const centerLine = MeshBuilder.CreateBox('landingCenterLine', {
    width: 0.08,
    height: 0.025,
    depth: 7,
  }, scene)
  centerLine.position.set(0, -0.95, -2.6)
  centerLine.material = trimMaterial
}

function createPlanetView(scene: Scene, glow: GlowLayer, preview: PlanetSite, graphics: GraphicsSettings): void {
  const planet = createPlanetVisual(scene, { ...preview, x: -20, y: 12, z: 64, radius: 15 }, graphics.graphicsQuality)
  planet.name = 'hangarPlanet'
  planet.rotation.z = -0.24
  const moon = createPlanetVisual(scene, {
    id: 'hangar-distant-moon', color: '#8699ad', x: 9, y: 8, z: 54, radius: 1.9,
  }, 'low')
  moon.name = 'hangarMoon'
  if (!graphics.planetAtmospheres) {
    for (const body of [planet, moon]) for (const mesh of body.getChildMeshes()) {
      if (mesh.name.startsWith('atmosphere-')) mesh.setEnabled(false)
    }
  }

  const texture = new DynamicTexture('hangarWindowSky', { width: 1024, height: 512 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createLinearGradient(0, 0, 1024, 512)
  gradient.addColorStop(0, '#050a19')
  gradient.addColorStop(0.5, '#102039')
  gradient.addColorStop(1, '#03070f')
  context.fillStyle = gradient
  context.fillRect(0, 0, 1024, 512)
  for (let index = 0; index < 280; index += 1) {
    const x = (index * 371.47) % 1024
    const y = (index * 197.83) % 512
    context.fillStyle = index % 4 === 0 ? '#80b6d9' : '#b7c9dc'
    context.globalAlpha = 0.2 + (index % 7) * 0.1
    context.fillRect(x, y, index % 21 === 0 ? 2 : 1, index % 21 === 0 ? 2 : 1)
  }
  context.globalAlpha = 1
  texture.update()
  const skyMaterial = new StandardMaterial('hangarWindowSkyMaterial', scene)
  skyMaterial.disableLighting = true
  skyMaterial.emissiveTexture = texture
  skyMaterial.emissiveColor = Color3.Black()
  skyMaterial.diffuseColor = Color3.Black()
  const sky = MeshBuilder.CreatePlane('hangarWindowSky', { width: 160, height: 80 }, scene)
  sky.position.set(0, 20, 115)
  sky.material = skyMaterial
  sky.isPickable = false
  glow.addExcludedMesh(sky)
}

function createWorkshopDetails(
  scene: Scene,
  dark: StandardMaterial,
  metal: StandardMaterial,
  amber: StandardMaterial,
  cyan: StandardMaterial,
): void {
  const box = (name: string, size: [number, number, number], position: [number, number, number], material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene)
    mesh.position.set(...position)
    mesh.material = material
    mesh.receiveShadows = true
    return mesh
  }
  for (let index = 0; index < 7; index += 1) {
    box(`hangarFloorSeam-${index}`, [24, 0.012, 0.025], [0, -1.092, -8 + index * 4], metal)
  }
  for (const side of [-1, 1]) {
    box(`hangarFloorEdge-${side}`, [0.035, 0.015, 31], [side * 8, -1.085, 4], metal)
    for (let index = 0; index < 5; index += 1) {
      const marker = box(`hangarPadCaution-${side}-${index}`, [0.24, 0.02, 0.5], [side * 5, -0.948, -3.5 + index * 2.5], amber)
      marker.rotation.y = -0.45
    }
    for (let index = 0; index < 3; index += 1) {
      const z = index * 5.5 - 1
      box(`hangarWallPanel-${side}-${index}`, [0.12, 3.2, 4.6], [side * 11.4, 1.1, z], dark)
      box(`hangarWallPanelRim-${side}-${index}`, [0.16, 0.06, 4.4], [side * 11.28, 2.6, z], metal)
    }
  }
  const padRing = MeshBuilder.CreateTorus('hangarPadOuterRing', { diameter: 11.4, thickness: 0.035, tessellation: 80 }, scene)
  padRing.position.set(0, -0.944, 1.5)
  padRing.material = cyan
  const padInnerRing = MeshBuilder.CreateTorus('hangarPadInnerRing', { diameter: 10.8, thickness: 0.025, tessellation: 80 }, scene)
  padInnerRing.position.set(0, -0.944, 1.5)
  padInnerRing.material = metal

  box('hangarWorkbench', [3.4, 0.18, 1.2], [-8, 0.1, 5], metal)
  for (const x of [-9.35, -6.65]) box(`hangarWorkbenchLeg-${x}`, [0.17, 1.15, 1], [x, -0.55, 5], dark)
  box('hangarWorkbenchConsole', [0.9, 0.5, 0.08], [-7.4, 0.5, 5.3], dark)
  box('hangarWorkbenchDisplay', [0.75, 0.29, 0.015], [-7.4, 0.53, 5.25], cyan)
  for (let index = 0; index < 3; index += 1) {
    const x = -8.8 + index * 0.62
    box(`hangarSupplyCase-${index}`, [0.5, 0.45, 0.65], [x, -0.84, 7.7], dark)
    box(`hangarSupplyLatch-${index}`, [0.12, 0.12, 0.02], [x, -0.75, 7.365], amber)
  }
}

function createMaterial(scene: Scene, name: string, color: string, emissive: string): StandardMaterial {
  const material = new StandardMaterial(name, scene)
  material.diffuseColor = Color3.FromHexString(color)
  material.emissiveColor = Color3.FromHexString(emissive).scale(0.06)
  material.specularColor = new Color3(0.3, 0.4, 0.48)
  material.specularPower = 48
  material.maxSimultaneousLights = 5
  return material
}
