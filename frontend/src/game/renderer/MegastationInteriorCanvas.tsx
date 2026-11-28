import { useEffect, useRef, useState } from 'react'
import {
  Color3,
  Color4,
  Engine,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from './babylon'
import { createCrewMemberModel } from './crewModel'
import type { GameLanguage } from '../i18n'
import { MEGASTATION } from '../domain/megastation'
import {
  findNearbyMegastationNpc,
  getMegastationNpcPlacements,
  MEGASTATION_CONCOURSE_BOUNDS,
  type MegastationNpcPlacement,
} from '../domain/megastationInterior'
import { findNearbyPickup, MEGASTATION_PICKUPS, type MegastationPickup } from '../domain/megastationPickups'
import { createOnFootState, stepOnFoot, type OnFootObstacle } from '../simulation/OnFootController'
import { advanceFootsteps, createFootstepState } from '../domain/footstepCadence'
import { playFootstep } from '../audio/footsteps'
import { getHardwareScaling } from './spaceEffectsProfile'
import type { GraphicsSettings } from '../progress/gameSettings'
import '../../styles/renderer/Concourse.scss'

interface MegastationInteriorCanvasProps {
  language: GameLanguage
  graphics: GraphicsSettings
  acceptedSideMissionIds: readonly string[]
  completedSideMissionIds: readonly string[]
  onAcceptSideMission: (id: string) => void
  onExit: () => void
}

const NPC_COLORS = ['#8fd0ff', '#ffd27f', '#9dffb0', '#ff9db0', '#c7a6ff', '#ffe08a']
const PICKUP_COLOR = '#ffd98a'

export function MegastationInteriorCanvas({ language, graphics, acceptedSideMissionIds, completedSideMissionIds, onAcceptSideMission, onExit }: MegastationInteriorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onExitRef = useRef(onExit)
  const [nearby, setNearby] = useState<MegastationNpcPlacement | null>(null)
  const [nearbyPickup, setNearbyPickup] = useState<MegastationPickup | null>(null)
  const [collected, setCollected] = useState<string[]>([])
  const collectedRef = useRef<string[]>([])
  useEffect(() => { onExitRef.current = onExit }, [onExit])
  useEffect(() => { collectedRef.current = collected }, [collected])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(getHardwareScaling(graphics))
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.01, 0.014, 0.024, 1)

    const camera = new FreeCamera('concourseCamera', new Vector3(0, 1.62, 16), scene)
    camera.minZ = 0.1
    camera.maxZ = 220
    camera.rotation.set(0, Math.PI, 0)

    const ambient = new HemisphericLight('concourseAmbient', new Vector3(0, 1, 0), scene)
    ambient.intensity = 0.5
    ambient.groundColor = new Color3(0.05, 0.06, 0.08)

    const glow = new GlowLayer('concourseGlow', scene, { blurKernelSize: 24 })
    glow.intensity = 0.5

    const floorMat = new StandardMaterial('concourseFloor', scene)
    floorMat.diffuseColor = Color3.FromHexString('#1b2733')
    floorMat.specularColor = new Color3(0.1, 0.12, 0.15)
    const wallMat = new StandardMaterial('concourseWall', scene)
    wallMat.diffuseColor = Color3.FromHexString('#243444')
    const trimMat = new StandardMaterial('concourseTrim', scene)
    trimMat.diffuseColor = trimMat.emissiveColor = Color3.FromHexString(MEGASTATION.color)
    const alcoveMat = new StandardMaterial('concourseAlcove', scene)
    alcoveMat.diffuseColor = Color3.FromHexString('#2c3f52')

    // The concourse now extends into a second room through a central doorway.
    const bounds = { ...MEGASTATION_CONCOURSE_BOUNDS, maxZ: 34 }
    const width = bounds.maxX - bounds.minX
    const depth = bounds.maxZ - bounds.minZ
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerZ = (bounds.minZ + bounds.maxZ) / 2

    const floor = MeshBuilder.CreateBox('concourseFloorMesh', { width, height: 0.2, depth }, scene)
    floor.position.set(centerX, bounds.floorY - 0.1, centerZ)
    floor.material = floorMat
    floor.isPickable = false

    const ceiling = MeshBuilder.CreateBox('concourseCeiling', { width, height: 0.2, depth }, scene)
    ceiling.position.set(centerX, 4.4, centerZ)
    ceiling.material = wallMat
    ceiling.isPickable = false

    for (const side of [-1, 1]) {
      const wall = MeshBuilder.CreateBox(`concourseWall-${side}`, { width: 0.4, height: 4.4, depth }, scene)
      wall.position.set(side < 0 ? bounds.minX : bounds.maxX, 2.2, centerZ)
      wall.material = wallMat
      wall.isPickable = false
      const strip = MeshBuilder.CreateBox(`concourseStrip-${side}`, { width: 0.05, height: 0.08, depth: depth * 0.9 }, scene)
      strip.position.set(side < 0 ? bounds.minX + 0.25 : bounds.maxX - 0.25, 2.8, centerZ)
      strip.material = trimMat
      strip.isPickable = false
      // Raised side alcoves give the concourse distinct rooms off the main aisle.
      for (const end of [-1, 1]) {
        const alcove = MeshBuilder.CreateBox(`concourseAlcove-${side}-${end}`, { width: 4.4, height: 0.3, depth: 6 }, scene)
        alcove.position.set(side * 10.4, 0.15, end * 10)
        alcove.material = alcoveMat
        alcove.isPickable = false
      }
    }
    for (const end of [-1, 1]) {
      const wall = MeshBuilder.CreateBox(`concourseEnd-${end}`, { width, height: 4.4, depth: 0.4 }, scene)
      wall.position.set(centerX, 2.2, end < 0 ? bounds.minZ : bounds.maxZ)
      wall.material = wallMat
      wall.isPickable = false
    }
    // Partition between the main hall and the aft room, with a central doorway.
    const partitionZ = 20
    const doorway = 4
    const segmentWidth = (width - doorway) / 2
    const partitionObstacles: OnFootObstacle[] = []
    for (const side of [-1, 1]) {
      const segment = MeshBuilder.CreateBox(`concoursePartition-${side}`, { width: segmentWidth, height: 4.4, depth: 0.4 }, scene)
      segment.position.set(centerX + side * (doorway / 2 + segmentWidth / 2), 2.2, partitionZ)
      segment.material = wallMat
      segment.isPickable = false
      const count = Math.ceil(segmentWidth / 1.2)
      for (let index = 0; index < count; index += 1) {
        const x = centerX + side * (doorway / 2 + (index + 0.5) * (segmentWidth / count))
        partitionObstacles.push({ x, z: partitionZ, radius: 0.9 })
      }
    }
    const lintel = MeshBuilder.CreateBox('concourseDoorLintel', { width: doorway + 0.6, height: 1.2, depth: 0.5 }, scene)
    lintel.position.set(centerX, 3.8, partitionZ)
    lintel.material = trimMat
    lintel.isPickable = false

    const placements = getMegastationNpcPlacements()
    const npcActors: { root: TransformNode; baseZ: number; facing: number; seed: number; patrol: boolean; x: number; z: number }[] = []
    placements.forEach((placement, index) => {
      const color = Color3.FromHexString(NPC_COLORS[index % NPC_COLORS.length])
      const root = createCrewMemberModel(scene, {
        id: placement.npc.id,
        name: placement.npc.name,
        role: placement.npc.role,
        species: placement.npc.species,
        colors: placement.npc.colors,
        position: { x: placement.x, z: placement.z },
        dialogue: placement.npc.dialogue,
      })
      root.rotation.y = placement.facing
      npcActors.push({ root, baseZ: placement.z, facing: placement.facing, seed: index * 1.7, patrol: index % 3 === 0, x: placement.x, z: placement.z })
      const light = new PointLight(`concourseNpcLight-${index}`, new Vector3(placement.x, 2.2, placement.z), scene)
      light.diffuse = color
      light.intensity = 0.5
      light.range = 6
    })

    const pickupMat = new StandardMaterial('concoursePickupMat', scene)
    pickupMat.diffuseColor = pickupMat.emissiveColor = Color3.FromHexString(PICKUP_COLOR)
    const pickupMeshes = new Map<string, Mesh>()
    MEGASTATION_PICKUPS.forEach((pickup, index) => {
      const mesh = MeshBuilder.CreatePolyhedron(`concoursePickup-${pickup.id}`, { type: 1, size: 0.32 }, scene)
      mesh.position.set(pickup.x, 1.1, pickup.z)
      mesh.material = pickupMat
      mesh.isPickable = false
      pickupMeshes.set(pickup.id, mesh)
      const light = new PointLight(`concoursePickupLight-${index}`, new Vector3(pickup.x, 1.4, pickup.z), scene)
      light.diffuse = Color3.FromHexString(PICKUP_COLOR)
      light.intensity = 0.6
      light.range = 4
    })

    const pickupObstacles: OnFootObstacle[] = MEGASTATION_PICKUPS.map(pickup => ({ x: pickup.x, z: pickup.z, radius: 0.45 }))
    // Aft room dressing: cargo crates and a warm light so it reads as a real second room.
    for (const [index, x] of [-6, 6].entries()) {
      const crate = MeshBuilder.CreateBox(`concourseCrate-${index}`, { width: 1.6, height: 1.2, depth: 1.6 }, scene)
      crate.position.set(x, 0.6, 28)
      crate.material = alcoveMat
      crate.isPickable = false
      pickupObstacles.push({ x, z: 28, radius: 1.1 })
    }
    const roomLight = new PointLight('concourseAftLight', new Vector3(0, 3.2, 27), scene)
    roomLight.diffuse = Color3.FromHexString('#ffd9a0')
    roomLight.intensity = 0.8
    roomLight.range = 14
    let obstacles: OnFootObstacle[] = [...pickupObstacles, ...partitionObstacles]
    let actorClock = 0
    let footsteps = createFootstepState()

    let walk = createOnFootState({ x: 0, y: 0, z: 16 }, Math.PI)
    const keys = new Set<string>()
    let yawDelta = 0
    let pitchDelta = 0
    let nearPickupId: string | null = null
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') { onExitRef.current(); return }
      if (event.code === 'KeyF' && nearPickupId && !collectedRef.current.includes(nearPickupId)) {
        const id = nearPickupId
        collectedRef.current = [...collectedRef.current, id]
        setCollected(collectedRef.current)
        const mesh = pickupMeshes.get(id)
        if (mesh) mesh.setEnabled(false)
        nearPickupId = null
        setNearbyPickup(null)
        return
      }
      keys.add(event.code)
    }
    const keyUp = (event: KeyboardEvent) => { keys.delete(event.code) }
    const pointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement !== canvas) return
      yawDelta += event.movementX
      // Invert vertical look so pushing the mouse up looks up.
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

    let lastNearbyId: string | null = null
    let lastPickupId: string | null = null
    const removeListeners = () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerdown', pointerDown)
      if (document.pointerLockElement === canvas) document.exitPointerLock?.()
    }

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1)
      actorClock += dt
      // NPCs walk the aisle, face each other to talk, and lean in to repair.
      for (const actor of npcActors) {
        const t = actorClock + actor.seed
        if (actor.patrol) {
          actor.z = actor.baseZ + Math.sin(t * 0.32) * 1.6
          actor.root.position.z = actor.z
          actor.root.rotation.y = actor.facing + (Math.cos(t * 0.32) >= 0 ? 0 : Math.PI)
          actor.root.rotation.x = 0
        } else {
          let nearest: typeof actor | null = null
          let best = Infinity
          for (const other of npcActors) {
            if (other === actor) continue
            const distance = Math.hypot(other.x - actor.x, other.z - actor.z)
            if (distance < best) { best = distance; nearest = other }
          }
          if (nearest) actor.root.rotation.y = Math.atan2(nearest.x - actor.x, nearest.z - actor.z)
          actor.root.rotation.x = Math.max(0, Math.sin(t * 0.7)) * 0.18
        }
        actor.root.position.x = actor.x
      }
      obstacles = [...pickupObstacles, ...partitionObstacles, ...npcActors.map(actor => ({ x: actor.x, z: actor.z, radius: 0.55 }))]
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
      camera.position.set(walk.position.x, walk.position.y, walk.position.z)
      camera.rotation.set(walk.pitch, walk.yaw, 0)
      const near = findNearbyMegastationNpc({ x: walk.position.x, z: walk.position.z })
      const nearId = near?.npc.id ?? null
      if (nearId !== lastNearbyId) {
        lastNearbyId = nearId
        setNearby(near)
      }
      const pickup = findNearbyPickup({ x: walk.position.x, z: walk.position.z }, collectedRef.current)
      const pickupId = pickup?.id ?? null
      nearPickupId = pickupId
      if (pickupId !== lastPickupId) {
        lastPickupId = pickupId
        setNearbyPickup(pickup)
      }
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
    <main className="game-shell concourse-shell" data-testid="megastation-interior">
      <canvas ref={canvasRef} className="game-canvas" aria-label={MEGASTATION.name[language]} />
      <div className="concourse-hud">
        <h1>{MEGASTATION.name[language]}</h1>
        <p className="concourse-hint">
          WASD — {language === 'pl' ? 'ruch' : 'move'} · Shift — {language === 'pl' ? 'bieg' : 'run'} · F — {language === 'pl' ? 'podnieś / wejdź' : 'pick up / board'} · Esc — {language === 'pl' ? 'wyjdź' : 'exit'}
        </p>
        <p className="concourse-salvage">{language === 'pl' ? 'Znaleziska' : 'Salvage'}: {collected.length} / {MEGASTATION_PICKUPS.length}</p>
        {nearbyPickup && <div className="concourse-pickup-prompt" role="status"><kbd>F</kbd> {nearbyPickup.label[language]}</div>}
        {nearby && (
          <aside className="concourse-dialogue" role="dialog" aria-label={nearby.npc.name[language]}>
            <h2>{nearby.npc.name[language]}</h2>
            <small>{nearby.npc.role[language]}</small>
            {nearby.npc.dialogue.map((line, index) => <p key={index}>{line[language]}</p>)}
            {nearby.npc.sideMissionId && !completedSideMissionIds.includes(nearby.npc.sideMissionId) && (
              acceptedSideMissionIds.includes(nearby.npc.sideMissionId)
                ? <em>{language === 'pl' ? 'Zlecenie w toku' : 'Contract in progress'}</em>
                : <button type="button" className="primary-action" onClick={() => onAcceptSideMission(nearby.npc.sideMissionId!)}>
                    {language === 'pl' ? 'Przyjmij zlecenie' : 'Accept contract'}
                  </button>
            )}
            {nearby.npc.sideMissionId && completedSideMissionIds.includes(nearby.npc.sideMissionId) && (
              <em>{language === 'pl' ? 'Zlecenie ukończone' : 'Contract completed'}</em>
            )}
          </aside>
        )}
        <button type="button" className="primary-action" onClick={onExit}>{language === 'pl' ? 'Wróć do statku' : 'Return to ship'}</button>
      </div>
    </main>
  )
}