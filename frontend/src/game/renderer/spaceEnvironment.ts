import {
  Color3, DirectionalLight, DynamicTexture, FresnelParameters, GlowLayer, ImageProcessingConfiguration,
  Mesh, MeshBuilder, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core'
import type { GraphicsQuality } from '../progress/gameSettings'
import type { PlanetSite } from '../domain/exploration'

function randomSequence(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function addSphereLods(mesh: Mesh, diameter: number, planetRadius: number, quality: GraphicsQuality): void {
  const levels = [
    { distance: planetRadius * 12, segments: quality === 'low' ? 16 : 24 },
    { distance: planetRadius * 35, segments: quality === 'high' ? 16 : 12 },
  ]

  for (const { distance, segments } of levels) {
    const lod = MeshBuilder.CreateSphere(`${mesh.name}-lod-${segments}`, { diameter, segments }, mesh.getScene())
    lod.parent = mesh
    lod.material = mesh.material
    lod.isPickable = false
    mesh.addLODLevel(distance, lod)
  }
}

export function createSpaceEnvironment(scene: Scene, quality: GraphicsQuality, options: { decorativePlanet?: boolean; skyDiameter?: number } = {}): void {
  const size = quality === 'low' ? 1024 : 2048
  const texture = new DynamicTexture('meridianNebulaSky', { width: size, height: size / 2 }, scene, false)
  const context = texture.getContext()
  const random = randomSequence(7319)
  const base = context.createLinearGradient(0, 0, size, size / 2)
  base.addColorStop(0, '#000102')
  base.addColorStop(0.55, '#010309')
  base.addColorStop(1, '#000103')
  context.fillStyle = base
  context.fillRect(0, 0, size, size / 2)
  for (let index = 0; index < 48; index += 1) {
    const x = size * (0.18 + random() * 0.75)
    const y = size * (0.13 + Math.sin(x / size * 6) * 0.08 + random() * 0.15)
    const radius = size * (0.035 + random() * 0.095)
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius)
    cloud.addColorStop(0, index % 3 === 0 ? 'rgba(75,44,110,0.025)' : 'rgba(24,65,95,0.025)')
    cloud.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = cloud
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  for (let index = 0; index < (quality === 'low' ? 850 : 2100); index += 1) {
    const x = random() * size
    const y = random() * size / 2
    const radius = random() > 0.98 ? 1 : 0.25 + random() * 0.4
    context.globalAlpha = 0.15 + random() * 0.45
    context.fillStyle = index % 9 === 0 ? '#efc59e' : index % 5 === 0 ? '#82b9e4' : '#e2efff'
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
  texture.update()
  const material = new StandardMaterial('meridianSkyMaterial', scene)
  material.disableLighting = true
  material.emissiveTexture = texture
  material.emissiveColor = Color3.Black()
  material.diffuseColor = Color3.Black()
  material.backFaceCulling = false
  const sky = MeshBuilder.CreateSphere('meridianSkyDome', { diameter: options.skyDiameter ?? 2800, segments: 24 }, scene)
  sky.material = material
  sky.infiniteDistance = true
  sky.isPickable = false

  const distantWorld = options.decorativePlanet === false ? null : createPlanetVisual(scene, {
    id: 'distant-meridian', color: '#547087', radius: 115, x: 245, y: 125, z: 720,
  }, quality)
  if (distantWorld) {
  distantWorld.name = 'meridianDistantWorld'
  distantWorld.infiniteDistance = true
  distantWorld.isPickable = false
  if (distantWorld.material instanceof StandardMaterial) {
    distantWorld.material.diffuseColor.setAll(0.38)
    distantWorld.material.emissiveColor = Color3.FromHexString('#547087').scale(0.002)
    distantWorld.material.specularColor.setAll(0.03)
  }
  for (const mesh of distantWorld.getChildMeshes()) {
    if (mesh.material instanceof StandardMaterial && mesh.material !== distantWorld.material) mesh.material.alpha = 0.08
  }
  }
  scene.onBeforeRenderObservable.addOnce(() => {
    for (const layer of scene.effectLayers) {
      if (!(layer instanceof GlowLayer)) continue
      layer.addExcludedMesh(sky)
      if (distantWorld) layer.addExcludedMesh(distantWorld)
      for (const mesh of distantWorld?.getChildMeshes() ?? []) {
        if (mesh instanceof Mesh) layer.addExcludedMesh(mesh)
      }
    }
  })

  const key = new DirectionalLight('meridianStarlight', new Vector3(-0.6, -0.45, 0.75), scene)
  key.diffuse = new Color3(0.7, 0.83, 1)
  key.intensity = 1
  const rim = new DirectionalLight('meridianWarmRim', new Vector3(0.6, 0.25, -1), scene)
  rim.diffuse = new Color3(1, 0.6, 0.35)
  rim.intensity = 0.22
  scene.imageProcessingConfiguration.toneMappingEnabled = true
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  scene.imageProcessingConfiguration.exposure = 0.9
  scene.imageProcessingConfiguration.contrast = 1.18
}

export function createPlanetVisual(
  scene: Scene,
  site: Pick<PlanetSite, 'id' | 'color' | 'radius' | 'x' | 'y' | 'z'>,
  quality: GraphicsQuality,
): Mesh {
  const width = quality === 'low' ? 256 : 512
  const height = width / 2
  const texture = new DynamicTexture(`surface-${site.id}`, { width, height }, scene, true)
  const context = texture.getContext()
  const pixels = context.getImageData(0, 0, width, height)
  const color = Color3.FromHexString(site.color)
  const seed = site.id.split('').reduce((sum, letter) => sum + letter.charCodeAt(0), 0) * 0.01
  for (let py = 0; py < height; py += 1) {
    const latitude = (py / height - 0.5) * Math.PI
    for (let px = 0; px < width; px += 1) {
      const longitude = px / width * Math.PI * 2
      const x = Math.cos(longitude) * Math.cos(latitude)
      const y = Math.sin(latitude)
      const z = Math.sin(longitude) * Math.cos(latitude)
      const terrain = Math.sin(x * 7 + Math.sin(z * 5 + seed)) * Math.cos(y * 9 - z * 3)
        + Math.sin(z * 17 + x * 11 + seed) * 0.34 + Math.sin(y * 38 + z * 21) * 0.13
      const cloud = Math.max(0, Math.sin(y * 19 + terrain * 2.2 + seed) - 0.3) * 0.24
      const ice = Math.max(0, Math.abs(y) - 0.76) * 1.8
      const brightness = 0.4 + (terrain + 1.5) / 3 * 0.58
      const offset = (py * width + px) * 4
      pixels.data[offset] = Math.min(255, (color.r * brightness + cloud + ice) * 255)
      pixels.data[offset + 1] = Math.min(255, (color.g * brightness + cloud + ice) * 255)
      pixels.data[offset + 2] = Math.min(255, (color.b * brightness + cloud + ice) * 255)
      pixels.data[offset + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  texture.update()
  const material = new StandardMaterial(`planetMaterial-${site.id}`, scene)
  material.diffuseTexture = texture
  material.diffuseColor = Color3.White()
  material.emissiveColor = color.scale(0.025)
  material.specularColor = color.scale(0.22)
  material.specularPower = 36
  const planet = MeshBuilder.CreateSphere(`planet-${site.id}`, {
    diameter: site.radius * 2, segments: quality === 'low' ? 24 : 48,
  }, scene)
  planet.position.set(site.x, site.y, site.z)
  planet.material = material
  addSphereLods(planet, site.radius * 2, site.radius, quality)

  const atmosphereMaterial = new StandardMaterial(`atmosphereMaterial-${site.id}`, scene)
  atmosphereMaterial.disableLighting = true
  atmosphereMaterial.emissiveColor = color.scale(0.45)
  atmosphereMaterial.alpha = 0.16
  atmosphereMaterial.opacityFresnelParameters = new FresnelParameters({
    bias: 0, power: 3, leftColor: Color3.White(), rightColor: Color3.Black(),
  })
  const atmosphere = MeshBuilder.CreateSphere(`atmosphere-${site.id}`, {
    diameter: site.radius * 2.065, segments: quality === 'low' ? 24 : 40,
  }, scene)
  atmosphere.parent = planet
  atmosphere.material = atmosphereMaterial
  atmosphere.isPickable = false
  addSphereLods(atmosphere, site.radius * 2.065, site.radius, quality)
  if (site.id === 'glass-moon' || site.id === 'quiet-foundry' || site.id === 'nacre-reef') {
    const ringMaterial = new StandardMaterial(`orbitMaterial-${site.id}`, scene)
    ringMaterial.diffuseColor = color.scale(0.8)
    ringMaterial.emissiveColor = color.scale(0.09)
    ringMaterial.alpha = 0.32
    for (let index = 0; index < 5; index += 1) {
      const ring = MeshBuilder.CreateTorus(`orbit-${site.id}-${index}`, {
        diameter: site.radius * (2.7 + index * 0.08), thickness: site.radius * 0.013,
        tessellation: quality === 'high' ? 48 : quality === 'low' ? 24 : 32,
      }, scene)
      ring.parent = planet
      ring.rotation.z = 0.35
      ring.rotation.x = 0.25
      ring.material = ringMaterial
      ring.isPickable = false
    }
  }
  return planet
}
