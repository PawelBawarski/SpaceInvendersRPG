import { useEffect, useRef, useState } from 'react'
import {
  Color3,
  Color4,
  Engine,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from './babylon'
import type { GameLanguage } from '../i18n'
import { SHIP_INTERIOR_BOUNDS } from '../hangar/interior'
import { createOnFootState, stepOnFoot, type OnFootObstacle } from '../simulation/OnFootController'
import { advanceFootsteps, createFootstepState } from '../domain/footstepCadence'
import { playFootstep } from '../audio/footsteps'
import { getHardwareScaling } from './spaceEffectsProfile'
import type { GraphicsSettings } from '../progress/gameSettings'
import '../../styles/renderer/Concourse.scss'

interface ShipInteriorCanvasProps {
  language: GameLanguage
  graphics: GraphicsSettings
  onExit: () => void
}

const SEAT = { x: 0, z: -3.2, eye: 1.12 }
const SEAT_RANGE = 2.2
const BLEND_SPEED = 3.2

export function ShipInteriorCanvas({ language, graphics, onExit }: ShipInteriorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onExitRef = useRef(onExit)
  const [seated, setSeated] = useState(false)
  useEffect(() => { onExitRef.current = onExit }, [onExit])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(getHardwareScaling(graphics))
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.01, 0.014, 0.022, 1)

    const camera = new FreeCamera('shipInteriorCamera', new Vector3(0, 1.62, 4), scene)
    camera.minZ = 0.05
    camera.maxZ = 60
    camera.rotation.set(0, Math.PI, 0)

    const ambient = new HemisphericLight('shipAmbient', new Vector3(0, 1, 0), scene)
    ambient.intensity = 0.45
    ambient.groundColor = new Color3(0.04, 0.05, 0.07)

    const floorMat = new StandardMaterial('shipFloor', scene)
    floorMat.diffuseColor = Color3.FromHexString('#1b2733')
    const wallMat = new StandardMaterial('shipWall', scene)
    wallMat.diffuseColor = Color3.FromHexString('#243444')
    const trimMat = new StandardMaterial('shipTrim', scene)
    trimMat.diffuseColor = trimMat.emissiveColor = Color3.FromHexString('#6fd3ff')
    const seatMat = new StandardMaterial('shipSeat', scene)
    seatMat.diffuseColor = Color3.FromHexString('#3a2f2a')

    const bounds = SHIP_INTERIOR_BOUNDS
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerZ = (bounds.minZ + bounds.maxZ) / 2

    const floor = MeshBuilder.CreateBox('shipFloorMesh', { width, height: 0.2, depth }, scene)
    floor.position.set(centerX, bounds.floorY - 0.1, centerZ)
    floor.material = floorMat
    floor.isPickable = false
    const ceiling = MeshBuilder.CreateBox('shipCeiling', { width, height: 0.2, depth }, scene)
    ceiling.position.set(centerX, 2.6, centerZ)
    ceiling.material = wallMat
    ceiling.isPickable = false
    for (const side of [-1, 1]) {
      const wall = MeshBuilder.CreateBox(`shipWall-${side}`, { width: 0.3, height: 2.6, depth }, scene)
      wall.position.set(side < 0 ? bounds.minX : bounds.maxX, 1.3, centerZ)
      wall.material = wallMat
      wall.isPickable = false
      const strip = MeshBuilder.CreateBox(`shipStrip-${side}`, { width: 0.04, height: 0.06, depth: depth * 0.8 }, scene)
      strip.position.set(side < 0 ? bounds.minX + 0.2 : bounds.maxX - 0.2, 2.1, centerZ)
      strip.material = trimMat
      strip.isPickable = false
    }
    // Forward console and the pilot seat.
    const console3d = MeshBuilder.CreateBox('shipConsole', { width: width * 0.8, height: 0.5, depth: 0.6 }, scene)
    console3d.position.set(0, 0.9, bounds.maxZ - 0.6)
    console3d.material = wallMat
    console3d.isPickable = false
    const consoleGlow = MeshBuilder.CreateBox('shipConsoleGlow', { width: width * 0.6, height: 0.06, depth: 0.08 }, scene)
    consoleGlow.position.set(0, 1.15, bounds.maxZ - 0.9)
    consoleGlow.material = trimMat
    consoleGlow.isPickable = false
    const seatBase = MeshBuilder.CreateBox('shipSeatBase', { width: 0.9, height: 0.5, depth: 0.9 }, scene)
    seatBase.position.set(SEAT.x, 0.25, SEAT.z)
    seatBase.material = seatMat
    seatBase.isPickable = false
    const seatBack = MeshBuilder.CreateBox('shipSeatBack', { width: 0.9, height: 1.1, depth: 0.2 }, scene)
    seatBack.position.set(SEAT.x, 0.9, SEAT.z - 0.4)
    seatBack.material = seatMat
    seatBack.isPickable = false
    const cabinLight = new PointLight('shipCabinLight', new Vector3(0, 2.2, 0), scene)
    cabinLight.diffuse = Color3.FromHexString('#6fd3ff')
    cabinLight.intensity = 0.7
    cabinLight.range = 12

    const obstacles: OnFootObstacle[] = [
      { x: SEAT.x, z: SEAT.z, radius: 0.6 },
      { x: 0, z: bounds.maxZ - 0.6, radius: 0.7 },
    ]

    let walk = createOnFootState({ x: 0, y: 0, z: 4 }, Math.PI)
    const keys = new Set<string>()
    let yawDelta = 0
    let pitchDelta = 0
    let seatedRef = false
    let blend = 0
    let footsteps = createFootstepState()
    const setSeatedBoth = (value: boolean) => { seatedRef = value; setSeated(value) }
    const nearSeat = () => Math.hypot(walk.position.x - SEAT.x, walk.position.z - SEAT.z) <= SEAT_RANGE
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') { onExitRef.current(); return }
      if (event.code === 'KeyF' && nearSeat()) { setSeatedBoth(!seatedRef); return }
      keys.add(event.code)
    }
    const keyUp = (event: KeyboardEvent) => { keys.delete(event.code) }
    const pointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement !== canvas) return
      yawDelta += event.movementX
      pitchDelta -= event.movementY
    }
    const pointerDown = () => {
      if (document.pointerLockElement === canvas) return
      try { canvas.requestPointerLock?.()?.catch?.(() => {}) } catch { /* pointer lock unsupported */ }
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerdown', pointerDown)
    const removeListeners = () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerdown', pointerDown)
      if (document.pointerLockElement === canvas) document.exitPointerLock?.()
    }

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1)
      if (!seatedRef) {
        const prevX = walk.position.x
        const prevZ = walk.position.z
        const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
        walk = stepOnFoot(walk, {
          forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
          strafe: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
          run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
          yawDelta,
          pitchDelta,
        }, bounds, dt, obstacles)
        const step = advanceFootsteps(footsteps, Math.hypot(walk.position.x - prevX, walk.position.z - prevZ), running)
        footsteps = step.state
        if (step.stepped) playFootstep(running)
        yawDelta = 0
        pitchDelta = 0
      }
      const target = seatedRef ? 1 : 0
      blend += Math.sign(target - blend) * Math.min(Math.abs(target - blend), dt * BLEND_SPEED)
      const standX = walk.position.x
      const standY = walk.position.y
      const standZ = walk.position.z
      camera.position.set(
        standX + (SEAT.x - standX) * blend,
        standY + (SEAT.eye - standY) * blend,
        standZ + (SEAT.z - standZ) * blend,
      )
      camera.rotation.set(walk.pitch * (1 - blend), walk.yaw, 0)
    })

    engine.runRenderLoop(() => scene.render())
    const resize = () => engine.resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      removeListeners()
      scene.dispose()
      engine.dispose()
    }
  }, [graphics])

  return (
    <main className="game-shell concourse-shell" data-testid="ship-interior">
      <canvas ref={canvasRef} className="game-canvas" aria-label={language === 'pl' ? 'Wnętrze statku' : 'Ship interior'} />
      <div className="concourse-hud">
        <h1>{language === 'pl' ? 'Wnętrze statku' : 'Ship interior'}</h1>
        <p className="concourse-hint">
          WASD — {language === 'pl' ? 'ruch' : 'move'} · F — {language === 'pl' ? 'siadaj/wstawaj' : 'sit/stand'} · Esc — {language === 'pl' ? 'wyjdź' : 'exit'}
        </p>
        {seated && <p className="concourse-salvage">{language === 'pl' ? 'Siedzisz w fotelu pilota' : 'Seated in the pilot chair'}</p>}
        <button type="button" className="primary-action" onClick={onExit}>{language === 'pl' ? 'Wyjdź' : 'Exit'}</button>
      </div>
    </main>
  )
}