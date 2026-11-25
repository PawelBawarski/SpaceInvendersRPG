import { useEffect, useRef } from 'react'
import { ArcRotateCamera, Color3, Color4, Engine, GlowLayer, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import type { EquippedPartRarities } from '../progress/shipParts'
import type { GraphicsQuality } from '../progress/gameSettings'
import { createShipVisual } from './shipVisual'

interface ShipPreviewCanvasProps { rarities: EquippedPartRarities; quality: GraphicsQuality }

export function ShipPreviewCanvas({ rarities, quality }: ShipPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { weapon, shield, engine: engineRarity } = rarities
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new Engine(canvas, true, { adaptToDeviceRatio: true })
    engine.setHardwareScalingLevel(quality === 'low' ? 1.5 : 1)
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0, 0, 0, 0)
    const camera = new ArcRotateCamera('shipSheetCamera', -Math.PI / 2 - 0.45, Math.PI / 3.1, 8.3, new Vector3(0, 0, 0), scene)
    camera.minZ = 0.1
    camera.lowerRadiusLimit = 6
    camera.upperRadiusLimit = 12
    camera.lowerBetaLimit = 0.35
    camera.upperBetaLimit = Math.PI * 0.7
    camera.wheelPrecision = 65
    camera.panningSensibility = 0
    camera.attachControl(canvas, true)
    const light = new HemisphericLight('shipSheetLight', new Vector3(-0.5, 1, -0.5), scene)
    light.intensity = 1.05
    light.groundColor = new Color3(0.13, 0.21, 0.28)
    const glow = new GlowLayer('shipSheetGlow', scene)
    glow.intensity = 0.5
    const ship = createShipVisual(scene, { weapon, shield, engine: engineRarity })
    ship.name = 'shipSheetPreview'
    const ring = MeshBuilder.CreateTorus('shipSheetPlatform', { diameter: 6.5, thickness: 0.017, tessellation: 64 }, scene)
    ring.position.y = -0.9
    const material = new StandardMaterial('shipSheetPlatformMaterial', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.FromHexString('#39738c')
    material.alpha = 0.6
    ring.material = material
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let interacting = false
    const begin = () => { interacting = true }
    canvas.addEventListener('pointerdown', begin)
    scene.onBeforeRenderObservable.add(() => {
      if (!interacting && !reduceMotion) ship.rotation.y += Math.min(engine.getDeltaTime() / 1000, 0.1) * 0.15
    })
    const resize = () => engine.resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener('resize', resize)
    engine.runRenderLoop(() => scene.render())
    scene.executeWhenReady(() => { canvas.dataset.ready = 'true' })
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', begin)
      camera.detachControl()
      scene.dispose()
      engine.dispose()
    }
  }, [weapon, shield, engineRarity, quality])
  return <canvas ref={canvasRef} className="ship-stats-preview" aria-label="Ship statistics 3D preview"
    data-equipped-parts={Object.keys(rarities).join(',')} />
}
