import { useEffect, useRef, useState } from 'react'
import { Color3, Color4, DirectionalLight, Engine, FreeCamera, GlowLayer, HemisphericLight, Mesh, MeshBuilder, Scene, ShadowGenerator, SpotLight, StandardMaterial, Vector3 } from '@babylonjs/core'
import type { PlanetSite } from '../domain/exploration'
import { GameAudio } from '../audio/GameAudio'
import type { GraphicsSettings } from '../progress/gameSettings'
import { createPlanetLandscape } from '../renderer/PlanetLandscape'
import { createShipVisual } from '../renderer/shipVisual'
import { createLandingGear } from '../renderer/LandingGear'
import { createFlightEffects } from '../renderer/FlightEffects'
import { createShipBurnEffect } from '../renderer/StarHazard'
import { getHardwareScaling, spaceEffectsProfile } from '../renderer/spaceEffectsProfile'
import { HANGAR_LANDED_Y, HANGAR_SHIP_SCALE, LANDING_GEAR_GEOMETRY } from '../simulation/HangarLanding'
import { RECOVERY_LAUNCH_DURATION, sampleRecoveryLaunch } from '../simulation/ShipRecovery'
import { LaunchDiagnostics } from './LaunchDiagnostics'
import './ShipRecovery.css'

interface Props {
  planet: PlanetSite
  graphics: GraphicsSettings
  language: 'pl' | 'en'
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
  const pl = language === 'pl'
  const live = useRef(props)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [discovered, setDiscovered] = useState(false)
  const [launchProgress, setLaunchProgress] = useState(0)
  useEffect(() => { live.current = props }, [props])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const graphics = live.current.graphics
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(getHardwareScaling(graphics))
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.004, 0.008, 0.015, 1)
    const camera = new FreeCamera('recoveryCamera', new Vector3(17, 8, -22), scene)
    camera.minZ = 0.1
    camera.maxZ = 4000
    camera.setTarget(new Vector3(0, 0, 1.5))
    const ambient = new HemisphericLight('recoveryAmbient', Vector3.Up(), scene)
    ambient.diffuse = Color3.FromHexString('#b7cee3')
    ambient.intensity = 0.62
    ambient.groundColor = new Color3(0.07, 0.11, 0.15)
    const workLight = new SpotLight('recoveryWorkLight', new Vector3(-4.8, 6.5, -4.5),
      new Vector3(.48, -.74, .5).normalize(), 1.55, 2, scene)
    workLight.diffuse = Color3.FromHexString('#ffdfb4')
    workLight.range = 22
    workLight.intensity = .93
    const moonlight = new DirectionalLight('recoveryMoonlight', new Vector3(.46, -.71, .53), scene)
    moonlight.diffuse = Color3.FromHexString('#8cb6e2')
    moonlight.intensity = .65
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
    basalt.specularColor = new Color3(.035, .045, .056)
    const fragments = Array.from({ length: 16 }, (_, index) => {
      const rock = MeshBuilder.CreateIcoSphere('recoveryRock', { radius: 1, subdivisions: 2 + index % 2, flat: false }, scene)
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
    scene.executeWhenReady(() => { canvas.dataset.ready = 'true' })
    engine.runRenderLoop(() => scene.render())
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      effects.dispose(); burn.dispose(); audio.dispose(); scene.dispose(); engine.dispose()
    }
  }, [planet])
  return <main className="ship-recovery" aria-label={pl ? 'Odnalezienie i naprawa statku' : 'Ship discovery and repair'}>
    <canvas ref={canvasRef} className="recovery-canvas" aria-label={pl ? 'Statek na powierzchni planety' : 'Ship on planetary surface'} />
    <header><span>MERIDIAN / {planet.name[language]}</span><h1>{launching ? (pl ? 'Ku gwiazdom' : 'Into the stars') : discovered ? (pl ? 'Jeszcze poleci' : 'She will fly again') : (pl ? 'Sygnał w pyle' : 'A signal in the dust')}</h1>
      <p>{launching ? (pl ? 'Vanta odzyskuje niebo.' : 'Vanta takes back the sky.') : discovered ? (pl ? 'Znalazłeś Vantę. Przywróć połączenia, zanim ruszysz w przestrzeń.' : 'You found Vanta. Restore the connections before taking flight.') : (pl ? 'Samotny mechanik. Porzucony zwiadowca. Początek drogi.' : 'A lone mechanic. An abandoned scout. A new beginning.')}</p>
    </header>
    {!launching && <button type="button" className="recovery-exit" onClick={onExit} aria-label={pl ? 'Wróć do menu' : 'Return to menu'}>×</button>}
    {discovered && !launching && <LaunchDiagnostics mask={repairMask} language={language} onRepair={onRepair} onLaunch={onLaunch} />}
    {launching && <div className="recovery-launch-status" role="status"><span>{pl ? 'Start z powierzchni' : 'Surface departure'}</span><div role="progressbar" aria-label={pl ? 'Postęp startu' : 'Launch progress'} aria-valuenow={Math.round(launchProgress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${launchProgress * 100}%` }}/></div></div>}
    <div className="recovery-fade" style={{ opacity: sampleRecoveryLaunch(launchProgress).fade }} aria-hidden="true" />
  </main>
}
