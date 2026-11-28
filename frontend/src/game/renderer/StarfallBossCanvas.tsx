import { useEffect, useRef, useState } from 'react'
import { Color3, Color4, Engine, FreeCamera, GlowLayer, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from './babylon'
import { ARENA, blockadeX, createArena, stepArena } from '../simulation/starfallArena'
import { BOSS_BLOCKADE_COUNT } from '../simulation/starfallBoss'
import { getHardwareScaling } from './spaceEffectsProfile'
import type { GraphicsSettings } from '../progress/gameSettings'
import { gameText, type GameLanguage } from '../i18n'

interface StarfallBossCanvasProps {
  language: GameLanguage
  graphics: GraphicsSettings
  onVictory: () => void
  onDefeat: () => void
}

export function StarfallBossCanvas({ language, graphics, onVictory, onDefeat }: StarfallBossCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const callbacks = useRef({ onVictory, onDefeat })
  useEffect(() => { callbacks.current = { onVictory, onDefeat } }, [onVictory, onDefeat])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(getHardwareScaling(graphics))
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.01, 0.02, 0.05, 1)
    const camera = new FreeCamera('bossCamera', new Vector3(0, 34, -62), scene)
    camera.setTarget(new Vector3(0, 0, 70))
    camera.minZ = 0.1
    const ambient = new HemisphericLight('bossAmbient', new Vector3(0, 1, 0), scene)
    ambient.intensity = 0.5
    const glow = new GlowLayer('bossGlow', scene)
    glow.intensity = 0.6

    const emissive = (name: string, color: string) => {
      const material = new StandardMaterial(name, scene)
      material.disableLighting = true
      material.emissiveColor = Color3.FromHexString(color)
      return material
    }
    const bossMaterial = emissive('bossMaterial', '#ff5a7a')
    const blockadeMaterial = emissive('blockadeMaterial', '#ffd166')
    const coreMaterial = emissive('coreMaterial', '#8be9ff')
    const enemyMaterial = emissive('enemyMaterial', '#9b8cff')
    const playerMaterial = emissive('playerMaterial', '#7dffb0')
    const boltMaterial = emissive('boltMaterial', '#fff2a8')

    const boss = MeshBuilder.CreateSphere('boss', { diameter: 40, segments: 24 }, scene)
    boss.position.set(0, 0, ARENA.bossZ)
    boss.material = bossMaterial
    const core = MeshBuilder.CreateSphere('bossCore', { diameter: 16, segments: 16 }, scene)
    core.position.set(0, 0, ARENA.bossZ - 6)
    core.material = coreMaterial
    core.setEnabled(false)
    const blockades = Array.from({ length: BOSS_BLOCKADE_COUNT }, (_, index) => {
      const mesh = MeshBuilder.CreateBox(`blockade-${index}`, { size: 14 }, scene)
      mesh.position.set(blockadeX(index), 0, ARENA.blockadeZ)
      mesh.material = blockadeMaterial
      return mesh
    })
    const player = MeshBuilder.CreateCylinder('playerShip', { height: 6, diameterTop: 0, diameterBottom: 8, tessellation: 12 }, scene)
    player.rotation.x = Math.PI / 2
    player.position.set(0, 0, ARENA.playerZ)
    player.material = playerMaterial

    const enemyMeshes = new Map<number, ReturnType<typeof MeshBuilder.CreateBox>>()
    const boltMeshes = new Map<number, ReturnType<typeof MeshBuilder.CreateSphere>>()
    const keys = new Set<string>()
    let firing = false
    const down = (event: KeyboardEvent) => { keys.add(event.code); if (event.code === 'Space') { event.preventDefault(); firing = true } }
    const up = (event: KeyboardEvent) => { keys.delete(event.code); if (event.code === 'Space') firing = false }
    const pointerDown = () => { firing = true }
    const pointerUp = () => { firing = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    canvas.addEventListener('pointerdown', pointerDown)
    window.addEventListener('pointerup', pointerUp)

    let state = createArena()
    let settled = false
    const sync = (meshes: Map<number, any>, items: { id: number; x: number; z: number }[], factory: () => any, name: string) => {
      const live = new Set(items.map(item => item.id))
      for (const [id, mesh] of meshes) if (!live.has(id)) { mesh.dispose(); meshes.delete(id) }
      for (const item of items) {
        let mesh = meshes.get(item.id)
        if (!mesh) { mesh = factory(); mesh.name = `${name}-${item.id}`; meshes.set(item.id, mesh) }
        mesh.position.set(item.x, 0, item.z)
      }
    }

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1)
      if (!state.won && !state.lost) {
        const moveX = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0)
        state = stepArena(state, { moveX, fire: firing }, dt)
      }
      player.position.x = state.playerX
      for (let index = 0; index < blockades.length; index += 1) blockades[index].setEnabled(index >= state.blockadesDestroyed)
      core.setEnabled(state.blockadesDestroyed >= BOSS_BLOCKADE_COUNT)
      sync(enemyMeshes, state.enemies, () => MeshBuilder.CreateBox('enemy', { size: 5 }, scene), 'enemy')
      sync(boltMeshes, state.projectiles, () => MeshBuilder.CreateSphere('bolt', { diameter: 1.6, segments: 6 }, scene), 'bolt')
      for (const mesh of enemyMeshes.values()) mesh.material = enemyMaterial
      for (const mesh of boltMeshes.values()) mesh.material = boltMaterial
      canvas.dataset.blockades = String(state.blockadesDestroyed)
      canvas.dataset.core = String(state.coreHealth)
      canvas.dataset.state = state.won ? 'won' : state.lost ? 'lost' : 'playing'
      if (!settled && (state.won || state.lost)) {
        settled = true
        if (state.won) callbacks.current.onVictory()
        else callbacks.current.onDefeat()
      }
    })

    engine.runRenderLoop(() => scene.render())
    const resize = () => engine.resize()
    window.addEventListener('resize', resize)
    scene.executeWhenReady(() => { setReady(true); canvas.dataset.ready = 'true' })

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      canvas.removeEventListener('pointerdown', pointerDown)
      window.removeEventListener('pointerup', pointerUp)
      scene.dispose()
      engine.dispose()
    }
  }, [graphics])

  return <>
    <canvas ref={canvasRef} className="boss-world" aria-label={gameText(language).statistics.shipStatistics} data-testid="boss-canvas" />
    {!ready && <div className="boss-loading" role="status">{gameText(language).application.loadingGalaxy}</div>}
  </>
}