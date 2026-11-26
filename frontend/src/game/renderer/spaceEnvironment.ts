import {
  Color3, DirectionalLight, DynamicTexture, FresnelParameters, GlowLayer, ImageProcessingConfiguration,
  Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3,
} from './babylon'
import type { GraphicsQuality } from '../progress/gameSettings'
import type { PlanetSite } from '../domain/exploration'
import { createSceneMaterial } from './sectorDepth'

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

export function createSpaceEnvironment(scene: Scene, quality: GraphicsQuality, options: { decorativePlanet?: boolean; skyDiameter?: number; skyTint?: Color3 } = {}) {
  const size = quality === 'low' ? 1024 : 2048
  const texture = new DynamicTexture('meridianNebulaSky', { width: size, height: size / 2 }, scene, false)
  const context = texture.getContext()
  const random = randomSequence(7319)
  const base = context.createLinearGradient(0, 0, size, size / 2)
  base.addColorStop(0, '#010207')
  base.addColorStop(0.55, '#02040a')
  base.addColorStop(1, '#010106')
  context.fillStyle = base
  context.fillRect(0, 0, size, size / 2)
  const nebula = options.skyTint ?? Color3.FromHexString('#7daecf')
  const tint = `${Math.round(nebula.r * 95)},${Math.round(nebula.g * 95)},${Math.round(nebula.b * 95)}`
  for (let index = 0; index < 48; index += 1) {
    const x = size * (0.18 + random() * 0.75)
    const y = size * (0.13 + Math.sin(x / size * 6) * 0.08 + random() * 0.15)
    const radius = size * (0.035 + random() * 0.095)
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius)
    cloud.addColorStop(0, index % 3 === 0 ? 'rgba(69,45,106,.018)' : `rgba(${tint},.027)`)
    cloud.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = cloud
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  for (let index = 0; index < (quality === 'low' ? 850 : 2100); index += 1) {
    const x = random() * size
    const y = random() * size / 2
    const radius = random() > 0.98 ? 1 : 0.25 + random() * 0.4
    context.globalAlpha = (.12 + random() * .34) * .9
    context.fillStyle = index % 9 === 0 ? '#efc59e' : index % 5 === 0 ? '#82b9e4' : '#e2efff'
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
  texture.update()
  const material = createSceneMaterial('meridianSkyMaterial', scene)
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
  key.intensity = .66
  key.renderPriority = 2
  const rim = new DirectionalLight('meridianColdRim', new Vector3(0.6, 0.25, -1), scene)
  rim.diffuse = new Color3(.41, .63, 1)
  rim.intensity = .045
  scene.imageProcessingConfiguration.toneMappingEnabled = true
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  scene.imageProcessingConfiguration.exposure = .75
  scene.imageProcessingConfiguration.contrast = 1.21
  return key
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
      const cloudShape = Math.sin(y * 19 + terrain * 2.2 + seed) + Math.sin(z * 24 - x * 17 + terrain * 4) * .26
      const cloud = Math.max(0, cloudShape - 0.41) * 0.26
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
  const material = createSceneMaterial(`planetMaterial-${site.id}`, scene)
  material.diffuseTexture = texture
  material.diffuseColor = Color3.White()
  material.emissiveColor = color.scale(0.047)
  material.specularColor = color.scale(0.22)
  material.specularPower = 36
  const planet = MeshBuilder.CreateSphere(`planet-${site.id}`, {
    diameter: site.radius * 2, segments: quality === 'low' ? 24 : 48,
  }, scene)
  planet.position.set(site.x, site.y, site.z)
  planet.material = material
  addSphereLods(planet, site.radius * 2, site.radius, quality)
  const ecosystem = createOrbitalEcosystem(planet, site, quality)
  if (ecosystem.present) planet.metadata = { ...planet.metadata, updateEcosystem: ecosystem.update, surfaceLifePresent: true }

  const atmosphereMaterial = createSceneMaterial(`atmosphereMaterial-${site.id}`, scene)
  atmosphereMaterial.disableLighting = true
  atmosphereMaterial.emissiveColor = Color3.Lerp(color, new Color3(.55, .77, 1), .3).scale(.6)
  atmosphereMaterial.alpha = 0.27
  atmosphereMaterial.disableDepthWrite = true
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
    const ringMaterial = createSceneMaterial(`orbitMaterial-${site.id}`, scene)
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

function createOrbitalEcosystem(planet: Mesh, site: Pick<PlanetSite, 'id' | 'color' | 'radius'>, quality: GraphicsQuality) {
  const seed = [...site.id].reduce((value, character) => (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0, 17)
  const present = seed % 3 === 0 || ['nacre-reef', 'sable-garden', 'pale-sanctum'].some(id => site.id.endsWith(id))
  if (!present) return { present, update: (_dt: number) => {} }
  const random = randomSequence(seed)
  const floraCount = quality === 'low' ? 4 : quality === 'high' ? 9 : 6
  const faunaCount = quality === 'low' ? 1 : quality === 'high' ? 3 : 2
  const floraMaterial = createSceneMaterial(`orbitalFlora-${site.id}`, planet.getScene())
  floraMaterial.diffuseColor = Color3.Lerp(Color3.FromHexString('#60bd88'), Color3.FromHexString(site.color), .24)
  floraMaterial.emissiveColor = floraMaterial.diffuseColor.scale(.22)
  floraMaterial.specularColor = Color3.Black()
  floraMaterial.freeze()
  const faunaMaterial = createSceneMaterial(`orbitalFauna-${site.id}`, planet.getScene())
  faunaMaterial.diffuseColor = Color3.Lerp(Color3.FromHexString('#7ad4d1'), Color3.FromHexString(site.color), .25)
  faunaMaterial.emissiveColor = faunaMaterial.diffuseColor.scale(.13)
  faunaMaterial.specularColor = new Color3(.08, .12, .14)
  faunaMaterial.freeze()
  const direction = new Vector3()
  const fauna: { root: TransformNode; latitude: number; longitude: number; speed: number; phase: number }[] = []
  const setSurfaceDirection = (latitude: number, longitude: number, target: Vector3) => target.set(
    Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude),
  ).normalize()
  const orientAtSurface = (root: TransformNode, normal: Vector3) => {
    root.rotationQuaternion ??= Quaternion.Identity()
    Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, normal, root.rotationQuaternion)
  }
  for (let index = 0; index < floraCount; index++) {
    const latitude = (random() - .5) * 1.82
    const longitude = random() * Math.PI * 2
    const normal = setSurfaceDirection(latitude, longitude, direction)
    const root = new TransformNode(`orbitalFloraRoot-${site.id}-${index}`, planet.getScene())
    root.parent = planet
    const surfaceOffset = site.radius + site.radius * .0012
    root.position.set(normal.x * surfaceOffset, normal.y * surfaceOffset, normal.z * surfaceOffset)
    orientAtSurface(root, normal)
    const height = Math.max(3, site.radius * (.003 + random() * .002))
    const stalk = MeshBuilder.CreateCylinder(`orbitalFloraStem-${site.id}-${index}`, {
      height, diameterTop: height * .08, diameterBottom: height * .3, tessellation: quality === 'low' ? 4 : 5,
    }, planet.getScene())
    stalk.parent = root
    stalk.position.y = height * .48
    stalk.material = floraMaterial
    stalk.isPickable = false
    if (index % 2 === 0) {
      const bloom = MeshBuilder.CreateSphere(`orbitalFloraBloom-${site.id}-${index}`, {
        diameter: height * .34, segments: quality === 'low' ? 5 : 7,
      }, planet.getScene())
      bloom.parent = root
      bloom.position.set(height * (random() - .5) * .24, height * .92, 0)
      bloom.material = floraMaterial
      bloom.isPickable = false
    }
  }
  for (let index = 0; index < faunaCount; index++) {
    const latitude = (random() - .5) * 1.72
    const longitude = random() * Math.PI * 2
    const root = new TransformNode(`orbitalFaunaRoot-${site.id}-${index}`, planet.getScene())
    root.parent = planet
    const normal = setSurfaceDirection(latitude, longitude, direction)
    const surfaceOffset = site.radius + site.radius * .0008
    root.position.set(normal.x * surfaceOffset, normal.y * surfaceOffset, normal.z * surfaceOffset)
    orientAtSurface(root, normal)
    const body = MeshBuilder.CreateIcoSphere(`orbitalFaunaBody-${site.id}-${index}`, {
      radius: Math.max(2, site.radius * .00125), subdivisions: quality === 'low' ? 1 : 2,
    }, planet.getScene())
    body.parent = root
    body.scaling.set(1.5, .76, .92)
    body.material = faunaMaterial
    body.isPickable = false
    fauna.push({ root, latitude, longitude, speed: .035 + random() * .055, phase: random() * Math.PI * 2 })
  }
  let elapsed = 0
  return {
    present,
    update(dt: number) {
      elapsed += Math.max(0, dt)
      for (const creature of fauna) {
        const longitude = creature.longitude + elapsed * creature.speed + Math.sin(elapsed * .5 + creature.phase) * .035
        const normal = setSurfaceDirection(creature.latitude, longitude, direction)
        const surfaceOffset = site.radius + site.radius * .0008
        creature.root.position.set(normal.x * surfaceOffset, normal.y * surfaceOffset, normal.z * surfaceOffset)
        orientAtSurface(creature.root, normal)
      }
    },
  }
}
