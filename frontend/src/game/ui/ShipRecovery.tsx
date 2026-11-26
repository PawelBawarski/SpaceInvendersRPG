import { gameText, type GameLanguage } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { Color3, Color4, DirectionalLight, Engine, FreeCamera, GlowLayer, HemisphericLight, ImageProcessingConfiguration, Mesh, MeshBuilder, Scene, ShadowGenerator, SpotLight, StandardMaterial, Vector3, VertexBuffer, VertexData } from '../renderer/babylon'
import type { PlanetSite } from '../domain/exploration'
import { GameAudio } from '../audio/GameAudio'
import type { GraphicsSettings } from '../progress/gameSettings'
import { createPlanetLandscape } from '../renderer/PlanetLandscape'
import { createShipVisual } from '../renderer/shipVisual'
import { showHullDamage } from '../renderer/HullDamage'
import { IconButton } from './ActionIcon'
import { createLandingGear } from '../renderer/LandingGear'
import { createFlightEffects } from '../renderer/FlightEffects'
import { createShipBurnEffect } from '../renderer/StarHazard'
import { getHardwareScaling, spaceEffectsProfile } from '../renderer/spaceEffectsProfile'
import { HANGAR_LANDED_Y, HANGAR_SHIP_SCALE, LANDING_GEAR_GEOMETRY } from '../simulation/HangarLanding'
import { RECOVERY_COMPLETE_MASK, RECOVERY_LAUNCH_DURATION, sampleRecoveryLaunch } from '../simulation/ShipRecovery'
import { BASE_SHIP_VITALS, FIRST_FLIGHT_VITALS } from '../domain/shipTelemetry'
import { LaunchDiagnostics } from './LaunchDiagnostics'
import '../../styles/ui/ShipRecovery.scss'
import { GameLoadingScreen } from './GameLoadingScreen'

const WRECK_HULL_FRACTION = .24

function profileBasalt(rock: Mesh, phase: number) {
  const positions = rock.getVerticesData(VertexBuffer.PositionKind)!
  const normals = new Array<number>(positions.length)
  for (let index = 0; index < positions.length; index += 3) {
    const [x, y, z] = [positions[index], positions[index + 1], positions[index + 2]]
    const fracture = Math.sin(x * 5 + z * 7 + phase) * .13 + Math.cos(y * 8 - z * 5) * .11
    positions[index] = x * (1 + fracture) + y * .21
    positions[index + 1] = y * (1 + fracture) + x * .15
    positions[index + 2] = z * (1 + fracture)
  }
  VertexData.ComputeNormals(positions, rock.getIndices()!, normals)
  rock.setVerticesData(VertexBuffer.PositionKind, positions)
  rock.setVerticesData(VertexBuffer.NormalKind, normals)
}

interface Props {
  planet: PlanetSite
  graphics: GraphicsSettings
  language: GameLanguage
  worldSeed: number
  repairMask: number
  launching: boolean
  worldReady: boolean
  volume: number
  onRepair: (mask: number) => void
  onLaunch: () => void
  onFinished: () => void
  onExit: () => void
}

export function ShipRecovery(props: Props) {
  const { planet, language, repairMask, launching, onRepair, onLaunch, onExit } = props
  const live = useRef(props)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [discovered, setDiscovered] = useState(false)
  const [launchProgress, setLaunchProgress] = useState(0)
  const [sceneReady, setSceneReady] = useState(false)
  useEffect(() => { live.current = props }, [props])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const graphics = live.current.graphics
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(getHardwareScaling(graphics))
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.004, 0.008, 0.015, 1)
    scene.imageProcessingConfiguration.toneMappingEnabled = true
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
    scene.imageProcessingConfiguration.exposure = .86
    scene.imageProcessingConfiguration.contrast = 1.19
    const camera = new FreeCamera('recoveryCamera', new Vector3(17, 8, -22), scene)
    camera.minZ = 0.1
    camera.maxZ = 4000
    camera.setTarget(new Vector3(0, 0, 1.5))
    const ambient = new HemisphericLight('recoveryAmbient', Vector3.Up(), scene)
    ambient.diffuse = Color3.FromHexString('#b7cee3')
    ambient.intensity = .43
    ambient.groundColor = new Color3(0.07, 0.11, 0.15)
    const workLight = new SpotLight('recoveryWorkLight', new Vector3(-4.8, 6.5, -4.5),
      new Vector3(.48, -.74, .5).normalize(), 1.55, 2, scene)
    workLight.diffuse = Color3.FromHexString('#ffdfb4')
    workLight.range = 22
    workLight.intensity = 1.24
    const moonlight = new DirectionalLight('recoveryMoonlight', new Vector3(.46, -.71, .53), scene)
    moonlight.diffuse = Color3.FromHexString('#8cb6e2')
    moonlight.intensity = .53
    const quality = graphics.graphicsQuality
    const profile = spaceEffectsProfile(quality)
    const glow = new GlowLayer('recoveryGlow', scene, { mainTextureRatio: profile.glowRatio, blurKernelSize: profile.glowKernel })
    glow.intensity = profile.glowIntensity
    glow.isEnabled = graphics.bloom
    const landscape = createPlanetLandscape(scene, planet, quality)
    glow.addExcludedMesh(landscape.sky)
    glow.addExcludedMesh(landscape.ground)
    const metal = new StandardMaterial('recoveryMetal', scene)
    metal.diffuseColor = Color3.FromHexString('#344553')
    metal.specularColor = Color3.FromHexString('#4f697d')
    metal.specularPower = 95
    const accent = new StandardMaterial('recoveryAccent', scene)
    accent.diffuseColor = Color3.FromHexString('#c79b61')
    accent.emissiveColor = new Color3(0.15, 0.08, 0.02)
    const pad = MeshBuilder.CreateCylinder('recoveryPad', { diameterTop: 12.5, diameterBottom: 13.3, height: .18, tessellation: 56 }, scene)
    pad.position.set(0, -1.06, 1.5)
    pad.material = metal
    pad.receiveShadows = true
    const deckMarks = []
    for (const diameter of [8.6, 11.9]) {
      const ring = MeshBuilder.CreateTorus('recoveryDeckGuide', { diameter, thickness: .037, tessellation: 48 }, scene)
      ring.position.set(0, -.962, 1.5)
      ring.material = accent
      deckMarks.push(ring)
    }
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6
      const marker = MeshBuilder.CreateCylinder('recoveryDeckMarker', { diameter: .15, height: .05, tessellation: 10 }, scene)
      marker.position.set(Math.sin(angle) * 5.8, -.952, 1.5 + Math.cos(angle) * 5.8)
      marker.material = accent
      deckMarks.push(marker)
    }
    Mesh.MergeMeshes(deckMarks, true)?.freezeWorldMatrix()
    const basalt = new StandardMaterial('recoveryBasalt', scene)
    basalt.diffuseColor = Color3.Lerp(Color3.FromHexString(planet.color), new Color3(.19, .23, .27), .7)
    basalt.diffuseTexture = landscape.regolith
    basalt.specularColor = new Color3(.035, .045, .056)
    const fragments = Array.from({ length: 16 }, (_, index) => {
      const rock = MeshBuilder.CreateIcoSphere('recoveryRock', { radius: 1, subdivisions: 2 + index % 2, flat: false }, scene)
      profileBasalt(rock, index * .71)
      const side = index < 11 ? -1 : 1
      const size = .3 + (index * 7 % 9) * .1
      rock.scaling.set(size * (1.2 + index % 3 * .23), size * (.39 + index % 4 * .11), size)
      rock.rotation.set(index * .26, index * .79, index * .13)
      rock.position.set(side * (7 + index % 5 * 1.21), -1.16, index * 1.57 % 15 - 7.5)
      rock.material = basalt
      return rock
    })
    Mesh.MergeMeshes(fragments, true)?.freezeWorldMatrix()
    const ship = createShipVisual(scene, {})
    ship.name = 'recoveryShip'
    ship.position.set(0, HANGAR_LANDED_Y, 1.5)
    ship.scaling.setAll(HANGAR_SHIP_SCALE)
    const gear = createLandingGear(scene, ship, metal, accent)
    gear.update(1, LANDING_GEAR_GEOMETRY.loadedCompression)
    const shadow = graphics.hangarShadows ? new ShadowGenerator(quality === 'low' ? 512 : 1024, workLight) : null
    const shadowMap = shadow?.getShadowMap()
    if (shadow && shadowMap) {
      shadow.bias = .002
      shadow.normalBias = .035
      shadow.usePercentageCloserFiltering = quality !== 'low'
      for (const mesh of ship.getChildMeshes()) if (!mesh.name.startsWith('shipEngineExhaust')) shadow.addShadowCaster(mesh)
      shadowMap.refreshRate = 0
    }
    const burn = createShipBurnEffect(scene, ship, 'low')
    const effects = createFlightEffects(scene, ship, camera, 'low', 292.5)
    effects.configure(graphics)
    const audio = new GameAudio({ main: live.current.volume, shots: 0, music: 0 }, { ambient: false })
    const unlock = () => { void audio.resume() }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    let elapsed = 0
    let launch = 0
    let completed = false
    let announced = false
    let uiClock = 0
    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.1, engine.getDeltaTime() / 1000)
      const current = live.current
      landscape.update(dt)
      showHullDamage(ship, current.repairMask === RECOVERY_COMPLETE_MASK ? FIRST_FLIGHT_VITALS.hull / BASE_SHIP_VITALS.hull : WRECK_HULL_FRACTION)
      elapsed += dt
      uiClock += dt
      canvas.dataset.repairMask = String(current.repairMask)
      audio.updateLevels({ main: current.volume, shots: 0, music: 0 })
      if (elapsed > 2.5 && !announced) { announced = true; setDiscovered(true) }
      if (!current.launching) {
        const t = Math.min(1, elapsed / 2.5)
        camera.position.set(17 - 8 * t, 8 - 3.8 * t, -22 + 8 * t)
        camera.setTarget(new Vector3(2.1, 0.3, 1.5))
        burn.update(dt, current.repairMask & 1 ? 0 : 0.16)
        effects.update(dt, 0, 0)
        audio.updateEngine(0, 0)
        return
      }
      launch = Math.min(current.worldReady ? 1 : 0.84, launch + dt / RECOVERY_LAUNCH_DURATION)
      if (shadowMap?.refreshRate === 0) shadowMap.refreshRate = 1
      const pose = sampleRecoveryLaunch(launch)
      ship.position.set(0, HANGAR_LANDED_Y + pose.lift + pose.distance * 0.38, 1.5 + pose.distance)
      ship.rotation.x = pose.pitch
      gear.update(pose.gear, (1 - Math.min(1, launch / 0.12)) * LANDING_GEAR_GEOMETRY.loadedCompression)
      burn.update(dt, 0)
      effects.update(dt, 80 + launch * 200, 1)
      audio.updateEngine(0.3 + launch * 0.7, 1)
      camera.position.copyFrom(ship.position).addInPlaceFromFloats(10 - launch * 7, 4 + launch * 3, -16)
      camera.setTarget(ship.position.add(new Vector3(0, 2, 8)))
      canvas.dataset.launchProgress = launch.toFixed(3)
      if (uiClock > 0.04) { uiClock = 0; setLaunchProgress(launch) }
      if (launch >= 1 && !completed) { completed = true; current.onFinished() }
    })
    const resize = () => engine.resize()
    window.addEventListener('resize', resize)
    scene.executeWhenReady(() => { canvas.dataset.ready = 'true'; setSceneReady(true) })
    engine.runRenderLoop(() => scene.render())
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      effects.dispose(); burn.dispose(); audio.dispose(); scene.dispose(); engine.dispose()
    }
  }, [planet])
  return <main className="ship-recovery" aria-label={gameText(language).recovery.shipDiscoveryAndRepair}>
    <canvas ref={canvasRef} className="recovery-canvas" aria-label={gameText(language).recovery.shipOnPlanetarySurface} />
    {!sceneReady && <GameLoadingScreen label={gameText(language).application.loadingTheSurface} />}
    <header><span>MERIDIAN / {planet.name[language]}</span><h1>{launching ? (gameText(language).recovery.intoTheStars) : discovered ? (gameText(language).recovery.sheWillFlyAgain) : (gameText(language).recovery.aSignalInTheDust)}</h1>
      <p>{launching ? (gameText(language).recovery.vantaTakesBackTheSky) : discovered ? (gameText(language).recovery.youFoundVantaRestoreTheConnections) : (gameText(language).recovery.aLoneMechanicAnAbandonedScout)}</p>
    </header>
    {!launching && <IconButton icon="close" className="recovery-exit" onClick={onExit} label={gameText(language).recovery.returnToMenu} />}
    {discovered && !launching && <aside className="recovery-log" aria-label={gameText(language).application.copy.prologueTitle}>
      <span>{gameText(language).application.copy.prologueKicker}</span>
      <h2>{gameText(language).application.copy.prologueTitle}</h2>
      <p>{gameText(language).application.copy.prologueStory}</p>
      <blockquote>{gameText(language).application.copy.prologueTransmission}</blockquote>
      <strong>{gameText(language).application.copy.prologueObjective}</strong>
    </aside>}
    {discovered && !launching && <LaunchDiagnostics mask={repairMask} language={language} seed={props.worldSeed} onRepair={onRepair} onLaunch={onLaunch} />}
    {launching && <div className="recovery-launch-status" role="status"><span>{gameText(language).recovery.surfaceDeparture}</span><div role="progressbar" aria-label={gameText(language).recovery.launchProgress} aria-valuenow={Math.round(launchProgress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${launchProgress * 100}%` }}/></div></div>}
    <div className="recovery-fade" style={{ opacity: sampleRecoveryLaunch(launchProgress).fade }} aria-hidden="true" />
  </main>
}
