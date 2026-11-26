import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, VertexData } from './babylon'
import type { PlanetSite } from '../domain/exploration'
import type { GraphicsQuality } from '../progress/gameSettings'

const REGOLITH_REPEAT_METERS = 13
const SURFACE_ECOSYSTEM = { lowFlora: 7, standardFlora: 12, highFlora: 18, lowFauna: 2, standardFauna: 4, highFauna: 6 } as const

function mineralNoise(u: number, v: number, cells: number, seed: number) {
  const x = u * cells
  const y = v * cells
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const dx = x - ix
  const dy = y - iy
  const blendX = dx * dx * (3 - 2 * dx)
  const blendY = dy * dy * (3 - 2 * dy)
  const grain = (column: number, row: number) => {
    const number = Math.imul(column % cells + seed, 1597334677) ^ Math.imul(row % cells, 3812015801)
    return (Math.imul(number ^ (number >>> 15), 2246822519) >>> 0) / 0xffffffff
  }
  const top = grain(ix, iy) * (1 - blendX) + grain(ix + 1, iy) * blendX
  const bottom = grain(ix, iy + 1) * (1 - blendX) + grain(ix + 1, iy + 1) * blendX
  return top * (1 - blendY) + bottom * blendY
}

function createRegolithTexture(scene: Scene, planetId: string, quality: GraphicsQuality) {
  const dimension = quality === 'low' ? 128 : 256
  const texture = new DynamicTexture('regolithGrain', dimension, scene, true)
  texture.anisotropicFilteringLevel = quality === 'low' ? 2 : 4
  const seed = [...planetId].reduce((sum, character) => (Math.imul(sum, 31) + character.charCodeAt(0)) | 0, 17)
  const context = texture.getContext()
  const tile = context.getImageData(0, 0, dimension, dimension)
  for (let y = 0; y < dimension; y++) {
    for (let x = 0; x < dimension; x++) {
      const u = x / dimension
      const v = y / dimension
      const bedrock = mineralNoise(u, v, 5, seed)
      const chips = mineralNoise(u, v, 27, seed + 17)
      const fine = mineralNoise(u, v, dimension, seed + 31)
      const fault = Math.abs(mineralNoise(u, v, 11, seed + 7) + chips * .08 - .53)
      const crack = Math.max(0, 1 - fault / .021)
      const brightness = 140 + bedrock * 58 + chips * 37 + fine * 19 - crack * 37
      const pixel = (y * dimension + x) * 4
      tile.data[pixel] = brightness
      tile.data[pixel + 1] = brightness
      tile.data[pixel + 2] = brightness
      tile.data[pixel + 3] = 255
    }
  }
  context.putImageData(tile, 0, 0)
  texture.update()
  return texture
}

/** Shared local terrain for the mechanic prologue and surface hangars. */
export function createPlanetLandscape(scene: Scene, planet: PlanetSite, quality: GraphicsQuality) {
  const color = Color3.FromHexString(planet.color)
  scene.fogMode = Scene.FOGMODE_LINEAR
  scene.fogStart = 145
  scene.fogEnd = 1080
  scene.fogColor = Color3.Lerp(Color3.FromHexString('#293a49'), color, .13)
  const groundMaterial = new StandardMaterial('surfaceGroundMaterial', scene)
  groundMaterial.diffuseColor = Color3.White()
  const regolith = createRegolithTexture(scene, planet.id, quality)
  groundMaterial.diffuseTexture = regolith
  groundMaterial.emissiveColor = color.scale(0.025)
  groundMaterial.specularColor = Color3.Black()
  const ground = createSurfaceRelief(scene, color, quality)
  ground.material = groundMaterial
  ground.receiveShadows = true
  ground.isPickable = false
  ground.freezeWorldMatrix()
  const texture = new DynamicTexture('surfaceSkyTexture', { width: 1024, height: 512 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#02040a')
  gradient.addColorStop(0.5, '#081323')
  gradient.addColorStop(0.72, '#24313a')
  gradient.addColorStop(1, '#111a23')
  context.fillStyle = gradient
  context.fillRect(0, 0, 1024, 512)
  for (let index = 0; index < 600; index++) {
    const x = index * 137.507 % 1024
    const y = index * 71.73 % 655 * .46
    context.fillStyle = index % 9 ? '#54697e' : '#b2c9d6'
    context.fillRect(x, y, 1, index % 9 ? 1 : 2)
  }
  texture.update()
  const skyMaterial = new StandardMaterial('surfaceSkyMaterial', scene)
  skyMaterial.disableLighting = true
  skyMaterial.fogEnabled = false
  skyMaterial.backFaceCulling = false
  skyMaterial.diffuseColor = Color3.Black()
  skyMaterial.emissiveColor = Color3.Black()
  skyMaterial.emissiveTexture = texture
  const sky = MeshBuilder.CreateSphere('planetSurfaceSky', { diameter: 3000, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene)
  sky.material = skyMaterial
  sky.isPickable = false
  sky.infiniteDistance = true
  sky.freezeWorldMatrix()
  const moonMaterial = new StandardMaterial('surfaceMoonMaterial', scene)
  moonMaterial.fogEnabled = false
  moonMaterial.diffuseColor = new Color3(0.25, 0.3, 0.35)
  moonMaterial.emissiveColor = new Color3(0.06, 0.09, 0.12)
  const moon = MeshBuilder.CreateSphere('surfaceMoon', { diameter: 80, segments: quality === 'low' ? 18 : 28 }, scene)
  moon.position.set(-290, 160, 700)
  moon.material = moonMaterial
  moon.isPickable = false
  moon.freezeWorldMatrix()
  const ecosystem = createSurfaceEcosystem(scene, planet, quality)
  scene.metadata = { ...scene.metadata, surfacePlanetId: planet.id, surfaceLifePresent: ecosystem.present }
  return { ground, sky, regolith, lifePresent: ecosystem.present, update: ecosystem.update }
}

function createSurfaceEcosystem(scene: Scene, planet: PlanetSite, quality: GraphicsQuality) {
  const idSeed = [...planet.id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 17)
  const supportsLife = idSeed % 3 === 0 || ['nacre-reef', 'sable-garden', 'pale-sanctum'].includes(planet.id)
  if (!supportsLife) return { present: false, update: (_dt: number) => {} }
  let seed = idSeed || 1
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000 }
  const floraCount = quality === 'low' ? SURFACE_ECOSYSTEM.lowFlora : quality === 'high' ? SURFACE_ECOSYSTEM.highFlora : SURFACE_ECOSYSTEM.standardFlora
  const faunaCount = quality === 'low' ? SURFACE_ECOSYSTEM.lowFauna : quality === 'high' ? SURFACE_ECOSYSTEM.highFauna : SURFACE_ECOSYSTEM.standardFauna
  const plantMaterial = new StandardMaterial(`surfaceFlora-${planet.id}`, scene)
  plantMaterial.diffuseColor = Color3.Lerp(Color3.FromHexString('#49aa85'), Color3.FromHexString(planet.color), .28)
  plantMaterial.emissiveColor = plantMaterial.diffuseColor.scale(.18)
  plantMaterial.specularColor = Color3.Black()
  const creatureMaterial = new StandardMaterial(`surfaceFauna-${planet.id}`, scene)
  creatureMaterial.diffuseColor = Color3.Lerp(Color3.FromHexString('#67c9d2'), Color3.FromHexString(planet.color), .22)
  creatureMaterial.emissiveColor = creatureMaterial.diffuseColor.scale(.12)
  creatureMaterial.specularColor = new Color3(.16, .2, .22)
  const plants: TransformNode[] = []
  const creatures: { root: TransformNode; x: number; z: number; phase: number; radius: number; speed: number }[] = []
  for (let index = 0; index < floraCount; index++) {
    const angle = random() * Math.PI * 2
    const radius = 110 + random() * 620
    const plant = new TransformNode(`surfaceFlora-${planet.id}-${index}`, scene)
    plant.position.set(Math.cos(angle) * radius, -1.05, Math.sin(angle) * radius)
    const stalks = quality === 'low' ? 2 : 3
    for (let stalk = 0; stalk < stalks; stalk++) {
      const height = .9 + random() * 2.1
      const crystal = MeshBuilder.CreateCylinder(`surfaceCrystal-${index}-${stalk}`, {
        height, diameterTop: .025, diameterBottom: .18 + random() * .16, tessellation: 5,
      }, scene)
      crystal.parent = plant
      crystal.position.set((random() - .5) * .32, height * .5, (random() - .5) * .32)
      crystal.rotation.z = (random() - .5) * .36
      crystal.material = plantMaterial
      crystal.isPickable = false
    }
    plants.push(plant)
  }
  for (let index = 0; index < faunaCount; index++) {
    const angle = random() * Math.PI * 2
    const radius = 150 + random() * 520
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const root = new TransformNode(`surfaceFauna-${planet.id}-${index}`, scene)
    const body = MeshBuilder.CreateSphere(`faunaBody-${index}`, { diameter: .72, segments: quality === 'low' ? 6 : 10 }, scene)
    body.parent = root
    body.scaling.set(1.45, .72, .9)
    body.material = creatureMaterial
    const head = MeshBuilder.CreateSphere(`faunaSensor-${index}`, { diameter: .37, segments: 8 }, scene)
    head.parent = root
    head.position.set(0, .12, .45)
    head.material = creatureMaterial
    for (const side of [-1, 1]) {
      const feeler = MeshBuilder.CreateCylinder(`faunaFeeler-${index}-${side}`, { height: .33, diameterTop: .025, diameterBottom: .05, tessellation: 5 }, scene)
      feeler.parent = root
      feeler.position.set(side * .16, .3, .57)
      feeler.rotation.z = side * -.4
      feeler.material = plantMaterial
    }
    for (const mesh of root.getChildMeshes()) mesh.isPickable = false
    creatures.push({ root, x, z, phase: random() * Math.PI * 2, radius: 14 + random() * 34, speed: .12 + random() * .1 })
  }
  let elapsed = 0
  return {
    present: true,
    update(dt: number) {
      elapsed += Math.max(0, dt)
      plants.forEach((plant, index) => { plant.rotation.z = Math.sin(elapsed * .7 + index * .9) * .045 })
      for (const creature of creatures) {
        const phase = elapsed * creature.speed + creature.phase
        creature.root.position.set(creature.x + Math.cos(phase) * creature.radius, 2 + Math.sin(phase * 2) * .8,
          creature.z + Math.sin(phase) * creature.radius)
        creature.root.rotation.y = -phase
      }
    },
  }
}

function createSurfaceRelief(scene: Scene, tint: Color3, quality: GraphicsQuality) {
  const rings = [4, 8, 13, 22, 35, 54, 80, 118, 167, 228, 301, 380, 435, 500, 584, 660, 770, 910, 1200, 1600]
  const sides = quality === 'low' ? 64 : quality === 'high' ? 112 : 88
  const base = Color3.Lerp(Color3.FromHexString('#273745'), tint, .31)
  const floor = -1.15
  const vertices = [0, floor, 0]
  const uv = [0, 0]
  const colors = [base.r, base.g, base.b, 1]
  const triangles: number[] = []
  const crest = (radius: number, middle: number, width: number) => Math.exp(-(((radius - middle) / width) ** 2))
  for (const [ring, radius] of rings.entries()) {
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const waves = Math.sin(.085 * x + .021 * z) * .38 + Math.cos(.14 * z - .012 * x) * .34 + Math.sin(.22 * (z + x)) * .28
      const foothill = crest(radius, 248 + Math.sin(4 * angle) * 75, 86) * (7 + 6 * Math.sin(angle * 9))
      const summit = crest(radius, 480 + Math.sin(3 * angle + 1.3) * 96, 89)
        * (52 + 31 * Math.sin(angle * 5 + 2.7) + 17 * Math.cos(angle * 13) + 10 * Math.sin(angle * 19))
      const farRidge = crest(radius, 760 + Math.cos(5 * angle) * 75, 124) * (79 + 37 * Math.sin(angle * 7 - 1.51))
      const relief = radius <= 8 ? 0 : Math.min(1, (radius - 8) / 32) * (waves * 1.95 + foothill + summit + farRidge)
      const shade = .86 + waves * .19 + Math.max(0, relief) * .002
      vertices.push(x, floor + relief, z)
      uv.push(x / REGOLITH_REPEAT_METERS, z / REGOLITH_REPEAT_METERS)
      colors.push(base.r * shade, base.g * shade, base.b * shade, 1)
      const a = 1 + ring * sides + side
      const next = 1 + ring * sides + (side + 1) % sides
      if (ring === 0) triangles.push(0, a, next)
      else triangles.push(a - sides, a, next - sides, next - sides, a, next)
    }
  }
  const normals: number[] = []
  VertexData.ComputeNormals(vertices, triangles, normals)
  const data = new VertexData()
  data.positions = vertices
  data.indices = triangles
  data.normals = normals
  data.uvs = uv
  data.colors = colors
  const ground = new Mesh('planetSurfaceGround', scene)
  data.applyToMesh(ground)
  return ground
}
