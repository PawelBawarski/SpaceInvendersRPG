import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, VertexData } from '@babylonjs/core'
import type { PlanetSite } from '../domain/exploration'
import type { GraphicsQuality } from '../progress/gameSettings'

/** Shared local terrain for the mechanic prologue and surface hangars. */
export function createPlanetLandscape(scene: Scene, planet: PlanetSite, quality: GraphicsQuality) {
  const color = Color3.FromHexString(planet.color)
  scene.fogMode = Scene.FOGMODE_LINEAR
  scene.fogStart = 145
  scene.fogEnd = 1080
  scene.fogColor = Color3.Lerp(Color3.FromHexString('#293a49'), color, .13)
  const groundMaterial = new StandardMaterial('surfaceGroundMaterial', scene)
  groundMaterial.diffuseColor = Color3.White()
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
  scene.metadata = { ...scene.metadata, surfacePlanetId: planet.id }
  return { ground, sky }
}

function createSurfaceRelief(scene: Scene, tint: Color3, quality: GraphicsQuality) {
  const rings = [4, 8, 13, 22, 35, 54, 80, 118, 167, 228, 301, 380, 435, 500, 584, 660, 770, 910, 1200, 1600]
  const sides = quality === 'low' ? 64 : quality === 'high' ? 112 : 88
  const base = Color3.Lerp(Color3.FromHexString('#273745'), tint, .31)
  const floor = -1.15
  const vertices = [0, floor, 0]
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
  data.colors = colors
  const ground = new Mesh('planetSurfaceGround', scene)
  data.applyToMesh(ground)
  return ground
}
