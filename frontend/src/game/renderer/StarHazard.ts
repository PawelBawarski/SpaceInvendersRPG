import {
  Color3, Color4, Constants, DynamicTexture, GlowLayer, Mesh, MeshBuilder, ParticleSystem,
  PointLight, Scene, TransformNode, Vector3,
} from '@babylonjs/core'
import type { GraphicsQuality } from '../progress/gameSettings'
import type { SolarHeatSource } from '../simulation/SolarExposure'
import { createSceneMaterial, usesSectorDepth } from './sectorDepth'

/** A distant emissive star illuminates only its local danger zone. */
export function createSunVisual(scene: Scene, star: SolarHeatSource, quality: GraphicsQuality, color = '#ffc278') {
  const tint = Color3.FromHexString(color)
  const haloColor = (alpha: number) => `rgba(${Math.round(tint.r * 255)}, ${Math.round(tint.g * 255)}, ${Math.round(tint.b * 255)}, ${alpha})`
  const root = new TransformNode('orionSun', scene)
  root.position.set(star.x, star.y, star.z)
  root.metadata = { radius: star.radius, heatRange: star.heatRange }
  const texture = new DynamicTexture('orionSunSurfaceTexture', { width: 512, height: 256 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, tint.toHexString())
  gradient.addColorStop(0.38, Color3.Lerp(tint, Color3.White(), .62).toHexString())
  gradient.addColorStop(0.67, tint.toHexString())
  gradient.addColorStop(1, tint.scale(.69).toHexString())
  context.fillStyle = gradient
  context.fillRect(0, 0, 512, 256)
  let seed = 7919
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  for (let index = 0; index < 1350; index++) {
    const x = random() * 512
    const y = random() * 256
    context.fillStyle = index % 4 === 0 ? 'rgba(255,245,181,.15)' : 'rgba(151,60,13,.07)'
    context.beginPath()
    context.arc(x, y, 1 + random() * 4, 0, Math.PI * 2)
    context.fill()
  }
  texture.update()
  const material = createSceneMaterial('orionSunSurfaceMaterial', scene)
  material.disableLighting = true
  material.diffuseColor = Color3.Black()
  material.emissiveColor = Color3.Black()
  material.emissiveTexture = texture
  const sphere = MeshBuilder.CreateSphere('orionSunCore', {
    diameter: star.radius * 2, segments: quality === 'low' ? 16 : 24,
  }, scene)
  sphere.parent = root
  sphere.material = material
  sphere.isPickable = false

  const coronaTexture = new DynamicTexture('orionSunCoronaTexture', { width: 256, height: 256 }, scene, false)
  const coronaContext = coronaTexture.getContext()
  const coronaGradient = coronaContext.createRadialGradient(128, 128, 0, 128, 128, 126)
  coronaGradient.addColorStop(0, haloColor(.45))
  coronaGradient.addColorStop(0.27, haloColor(.30))
  coronaGradient.addColorStop(0.39, haloColor(.13))
  coronaGradient.addColorStop(0.7, haloColor(.035))
  coronaGradient.addColorStop(1, haloColor(0))
  coronaContext.fillStyle = coronaGradient
  coronaContext.fillRect(0, 0, 256, 256)
  coronaTexture.hasAlpha = true
  coronaTexture.update()
  const coronaMaterial = createSceneMaterial('orionSunCoronaMaterial', scene)
  coronaMaterial.disableLighting = true
  coronaMaterial.diffuseColor = Color3.Black()
  coronaMaterial.emissiveColor = Color3.Black()
  coronaMaterial.emissiveTexture = coronaTexture
  coronaMaterial.opacityTexture = coronaTexture
  coronaMaterial.alphaMode = Constants.ALPHA_ADD
  coronaMaterial.disableDepthWrite = true
  coronaMaterial.backFaceCulling = false
  const corona = MeshBuilder.CreatePlane('orionSunCorona', { size: star.radius * 7 }, scene)
  corona.parent = root
  corona.material = coronaMaterial
  corona.billboardMode = Mesh.BILLBOARDMODE_ALL
  corona.isPickable = false
  // The corona already contains its halo; a second bloom pass washes out the surface.
  const glow = scene.effectLayers.find(layer => layer instanceof GlowLayer) as GlowLayer | undefined
  glow?.addExcludedMesh(sphere)
  glow?.addExcludedMesh(corona)
  sphere.onDisposeObservable.addOnce(() => glow?.removeExcludedMesh(sphere))
  corona.onDisposeObservable.addOnce(() => glow?.removeExcludedMesh(corona))

  const heatLight = new PointLight('orionSunHeatLight', root.position.clone(), scene)
  heatLight.diffuse = tint.scale(.95)
  heatLight.intensity = 1.8
  heatLight.range = star.radius + star.heatRange
  let elapsed = 0
  return {
    root,
    update(dt: number) {
      elapsed += Math.max(0, dt)
      sphere.rotation.y += Math.max(0, dt) * 0.012
      corona.visibility = 0.93 + Math.sin(elapsed * 0.45) * 0.05
    },
    dispose() {
      root.dispose(false, false)
      material.dispose()
      coronaMaterial.dispose()
      texture.dispose()
      coronaTexture.dispose()
      heatLight.dispose()
    },
  }
}

/** Reusable ship-local flames: any future thermal attack can supply intensity. */
export function createShipBurnEffect(scene: Scene, ship: TransformNode, quality: GraphicsQuality) {
  const texture = new DynamicTexture('shipBurnTexture', { width: 64, height: 64 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,246,191,1)')
  gradient.addColorStop(0.22, 'rgba(255,157,30,.95)')
  gradient.addColorStop(0.58, 'rgba(212,49,8,.5)')
  gradient.addColorStop(1, 'rgba(70,13,1,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  texture.hasAlpha = true
  texture.update()
  const capacity = quality === 'low' ? 24 : quality === 'high' ? 72 : 48
  const emitter = MeshBuilder.CreateBox('shipBurnEmitter', { size: 0.01 }, scene)
  emitter.parent = ship
  emitter.isVisible = false
  emitter.isPickable = false
  const flames = new ParticleSystem('shipBurnFlames', capacity, scene)
  flames.useLogarithmicDepth = usesSectorDepth(scene)
  flames.particleTexture = texture
  flames.emitter = emitter
  flames.createBoxEmitter(new Vector3(-0.3, 0.4, -1.4), new Vector3(0.3, 1.4, -0.5),
    new Vector3(-1.5, 0.1, -1.3), new Vector3(1.5, 0.28, 0.9))
  flames.isLocal = true
  flames.blendMode = ParticleSystem.BLENDMODE_ADD
  flames.color1 = new Color4(1, 0.55, 0.12, 0.85)
  flames.color2 = new Color4(1, 0.18, 0.025, 0.6)
  flames.colorDead = new Color4(0.25, 0.015, 0.005, 0)
  flames.minLifeTime = 0.14
  flames.maxLifeTime = 0.42
  flames.minSize = 0.14
  flames.maxSize = 0.45
  flames.minEmitPower = 0.7
  flames.maxEmitPower = 2.2
  flames.emitRate = 0
  flames.updateSpeed = 0.012
  flames.addSizeGradient(0, 0.4)
  flames.addSizeGradient(0.4, 1.3)
  flames.addSizeGradient(1, 0)
  const ember = new PointLight('shipBurnLight', new Vector3(0, 0.7, 0), scene)
  ember.parent = ship
  ember.diffuse = new Color3(1, 0.27, 0.035)
  ember.range = 7
  ember.intensity = 0
  ember.setEnabled(false)
  let running = false
  let elapsed = 0
  return {
    update(dt: number, intensity: number, paused = false) {
      if (!paused) elapsed += Math.max(0, dt)
      const value = Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0
      flames.updateSpeed = paused ? 0 : 0.012
      flames.emitRate = value > 0 ? (quality === 'low' ? 32 : 60) * value : 0
      ember.intensity = value * (0.8 + Math.sin(elapsed * 19) * 0.16)
      ember.setEnabled(value > 0.01)
      if (value > 0 && !running) { flames.start(); running = true }
      if (value === 0 && running) { flames.stop(); running = false }
      ship.metadata ??= {}
      ship.metadata.burningIntensity = value
    },
    dispose() {
      flames.dispose(false)
      emitter.dispose()
      texture.dispose()
      ember.dispose()
    },
  }
}
