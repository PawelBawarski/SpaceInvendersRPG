import { Color3, Constants, DynamicTexture, FresnelParameters, GlowLayer, Mesh, MeshBuilder, Scene, Vector3 } from './babylon'
import type { PlanetSite } from '../domain/exploration'
import type { GraphicsQuality } from '../progress/gameSettings'
import { createPlanetVisual } from './spaceEnvironment'
import { spaceEffectsProfile } from './spaceEffectsProfile'
import { createSceneMaterial } from './sectorDepth'

/** Keep distant bodies visible; allocate terrain textures only around the pilot. */
export function createPlanetField(scene: Scene, sites: readonly PlanetSite[], quality: GraphicsQuality) {
  let detailQuality = quality
  let atmospheres = true
  const glow = scene.effectLayers.find(layer => layer instanceof GlowLayer) as GlowLayer | undefined
  const template = MeshBuilder.CreateSphere('distantPlanetGeometry', { diameter: 2, segments: quality === 'low' ? 8 : 16 }, scene)
  template.setEnabled(false)
  template.isPickable = false
  const surface = new DynamicTexture('distantPlanetBands', { width: 128, height: 64 }, scene, true)
  const context = surface.getContext()
  const bands = context.getImageData(0, 0, 128, 64)
  for (let y = 0; y < bands.height; y++) {
    for (let x = 0; x < bands.width; x++) {
      const longitude = x / bands.width * Math.PI * 2
      const band = Math.sin(y * .28 + Math.sin(longitude * 2 + y * .056) * 1.1)
      const cloud = Math.sin(longitude * 5 + y * .41) * Math.cos(y * .26)
      const shade = 191 + band * 29 + cloud * 21
      const offset = (y * bands.width + x) * 4
      bands.data.set([shade, shade, shade, 255], offset)
    }
  }
  context.putImageData(bands, 0, 0)
  surface.update()
  const entries = sites.map(site => {
    const proxy = template.clone(`planet-distant-${site.id}`)!
    proxy.setEnabled(true)
    proxy.scaling.setAll(site.radius)
    proxy.position.set(site.x, site.y, site.z)
    proxy.isPickable = false
    const material = createSceneMaterial(`planet-distant-material-${site.id}`, scene)
    const color = Color3.FromHexString(site.color)
    material.diffuseColor = color.scale(.93)
    material.diffuseTexture = surface
    material.emissiveColor = color.scale(.035)
    material.specularColor = Color3.Black()
    proxy.material = material
    proxy.freezeWorldMatrix()
    material.freeze()
    glow?.addExcludedMesh(proxy)
    return { site, proxy, center: proxy.position.clone(), detail: null as Mesh | null, halo: null as Mesh | null, distance: Infinity }
  })
  let clock = 1
  const streaming = { total: sites.length, budget: spaceEffectsProfile(quality).planetBudget, detailed: 0, created: 0, halos: 0 }
  scene.metadata = { ...scene.metadata, planetStreaming: streaming }

  const makeHaze = (entry: typeof entries[number]) => {
    const haze = template.clone(`planet-haze-${entry.site.id}`)!
    const tint = Color3.FromHexString(entry.site.color)
    const material = createSceneMaterial(`distantAtmosphere-${entry.site.id}`, scene)
    material.disableLighting = true
    material.disableDepthWrite = true
    material.alphaMode = Constants.ALPHA_ADD
    material.alpha = .29
    material.emissiveColor = Color3.Lerp(tint, new Color3(.59, .8, 1), .32).scale(.56)
    material.opacityFresnelParameters = new FresnelParameters({ bias: 0, power: 3.3, leftColor: Color3.White(), rightColor: Color3.Black() })
    haze.material = material
    haze.position.copyFrom(entry.center)
    haze.scaling.setAll(entry.site.radius * 1.039)
    haze.isPickable = false
    haze.freezeWorldMatrix()
    material.freeze()
    glow?.addExcludedMesh(haze)
    return haze
  }

  return {
    configure(next: GraphicsQuality, showAtmospheres: boolean) {
      if (next !== detailQuality) {
        detailQuality = next
        streaming.budget = spaceEffectsProfile(next).planetBudget
      }
      if (atmospheres === showAtmospheres) return
      atmospheres = showAtmospheres
      clock = 1
      for (const entry of entries) {
        entry.detail?.getChildMeshes().find(mesh => mesh.name === `atmosphere-${entry.site.id}`)?.setEnabled(atmospheres)
        if (!atmospheres) entry.halo?.setEnabled(false)
      }
      if (!atmospheres) streaming.halos = 0
    },
    update(dt: number, position: Vector3) {
      clock += dt
      for (const entry of entries) if (entry.detail) {
        entry.detail.rotation.y += dt * 0.006
        const updateEcosystem = entry.detail.metadata?.updateEcosystem as ((elapsed: number) => void) | undefined
        updateEcosystem?.(dt)
      }
      if (clock < 0.35) return
      clock = 0
      for (const entry of entries) entry.distance = Vector3.Distance(position, entry.center)
      const nearby = entries.filter(entry => entry.distance - entry.site.radius < Math.max(4500, Math.min(24000, entry.site.radius * 4)))
        .sort((left, right) => left.distance - left.site.radius - (right.distance - right.site.radius)).slice(0, streaming.budget)
      for (const entry of entries) {
        if (nearby.includes(entry)) continue
        if (entry.detail) { entry.detail.dispose(false, true); entry.detail = null }
        entry.proxy.setEnabled(true)
      }
      // One procedural texture per update avoids a burst of terrain generation.
      const pending = nearby.find(entry => !entry.detail)
      if (pending) {
        pending.detail = createPlanetVisual(scene, pending.site, detailQuality)
        const detail = pending.detail
        detail.getChildMeshes().find(mesh => mesh.name === `atmosphere-${pending.site.id}`)?.setEnabled(atmospheres)
        glow?.addExcludedMesh(detail)
        detail.onDisposeObservable.addOnce(() => glow?.removeExcludedMesh(detail))
        pending.proxy.setEnabled(false)
        streaming.created += 1
      }
      streaming.detailed = entries.filter(entry => entry.detail).length
      const limit = detailQuality === 'high' ? 12 : detailQuality === 'low' ? 3 : 7
      const visible = atmospheres ? entries.filter(entry => !entry.detail && entry.site.radius / entry.distance > .006)
        .sort((a, b) => b.site.radius / b.distance - a.site.radius / a.distance).slice(0, limit) : []
      for (const entry of entries) {
        const emitting = visible.includes(entry)
        if (emitting) entry.halo ??= makeHaze(entry)
        entry.halo?.setEnabled(emitting)
      }
      streaming.halos = visible.length
    },
    dispose() {
      for (const entry of entries) {
        entry.detail?.dispose(false, true)
        glow?.removeExcludedMesh(entry.proxy)
        entry.proxy.material?.dispose()
        entry.proxy.dispose()
        if (entry.halo) { glow?.removeExcludedMesh(entry.halo); entry.halo.dispose(false, true) }
      }
      surface.dispose()
      template.dispose()
    },
  }
}
