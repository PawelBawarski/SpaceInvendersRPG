import { Color3, GlowLayer, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'
import type { PlanetSite } from '../domain/exploration'
import type { GraphicsQuality } from '../progress/gameSettings'
import { createPlanetVisual } from './spaceEnvironment'
import { spaceEffectsProfile } from './spaceEffectsProfile'

/** Keep distant bodies visible; allocate terrain textures only around the pilot. */
export function createPlanetField(scene: Scene, sites: readonly PlanetSite[], quality: GraphicsQuality) {
  const budget = spaceEffectsProfile(quality).planetBudget
  const glow = scene.effectLayers.find(layer => layer instanceof GlowLayer) as GlowLayer | undefined
  const template = MeshBuilder.CreateSphere('distantPlanetGeometry', { diameter: 2, segments: quality === 'low' ? 8 : 16 }, scene)
  template.setEnabled(false)
  template.isPickable = false
  const entries = sites.map(site => {
    const proxy = template.clone(`planet-distant-${site.id}`)!
    proxy.setEnabled(true)
    proxy.scaling.setAll(site.radius)
    proxy.position.set(site.x, site.y, site.z)
    proxy.isPickable = false
    const material = new StandardMaterial(`planet-distant-material-${site.id}`, scene)
    const color = Color3.FromHexString(site.color)
    material.diffuseColor = color.scale(0.65)
    material.emissiveColor = color.scale(0.012)
    material.specularColor = Color3.Black()
    proxy.material = material
    proxy.freezeWorldMatrix()
    material.freeze()
    glow?.addExcludedMesh(proxy)
    return { site, proxy, center: proxy.position.clone(), detail: null as Mesh | null, distance: Infinity }
  })
  let clock = 1
  const streaming = { total: sites.length, budget, detailed: 0, created: 0 }
  scene.metadata = { ...scene.metadata, planetStreaming: streaming }

  return {
    update(dt: number, position: Vector3) {
      clock += dt
      for (const entry of entries) if (entry.detail) entry.detail.rotation.y += dt * 0.006
      if (clock < 0.35) return
      clock = 0
      for (const entry of entries) entry.distance = Vector3.Distance(position, entry.center)
      const nearby = entries.filter(entry => entry.distance - entry.site.radius < Math.max(4500, Math.min(24000, entry.site.radius * 4)))
        .sort((left, right) => left.distance - left.site.radius - (right.distance - right.site.radius)).slice(0, budget)
      for (const entry of entries) {
        if (nearby.includes(entry)) continue
        if (entry.detail) { entry.detail.dispose(false, true); entry.detail = null }
        entry.proxy.setEnabled(true)
      }
      // One procedural texture per update avoids a burst of terrain generation.
      const pending = nearby.find(entry => !entry.detail)
      if (pending) {
        pending.detail = createPlanetVisual(scene, pending.site, quality)
        const detail = pending.detail
        glow?.addExcludedMesh(detail)
        detail.onDisposeObservable.addOnce(() => glow?.removeExcludedMesh(detail))
        pending.proxy.setEnabled(false)
        streaming.created += 1
      }
      streaming.detailed = entries.filter(entry => entry.detail).length
    },
    dispose() {
      for (const entry of entries) { entry.detail?.dispose(false, true); glow?.removeExcludedMesh(entry.proxy); entry.proxy.dispose(false, true) }
      template.dispose()
    },
  }
}
