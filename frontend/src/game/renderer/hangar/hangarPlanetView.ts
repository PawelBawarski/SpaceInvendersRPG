import { Color3, DynamicTexture, GlowLayer, MeshBuilder, Scene, StandardMaterial } from '../babylon'
import type { PlanetSite } from '../../domain/exploration'
import type { GraphicsSettings } from '../../progress/gameSettings'
import { createPlanetVisual } from '../spaceEnvironment'

/** The planet + moon vista and painted window sky seen from inside the hangar. */
export function createPlanetView(scene: Scene, glow: GlowLayer, preview: PlanetSite, graphics: GraphicsSettings): void {
  const planet = createPlanetVisual(scene, { ...preview, x: -20, y: 12, z: 64, radius: 15 }, graphics.graphicsQuality)
  planet.name = 'hangarPlanet'
  planet.rotation.z = -0.24
  const moon = createPlanetVisual(scene, {
    id: 'hangar-distant-moon', color: '#8699ad', x: 9, y: 8, z: 54, radius: 1.9,
  }, 'low')
  moon.name = 'hangarMoon'
  if (!graphics.planetAtmospheres) {
    for (const body of [planet, moon]) for (const mesh of body.getChildMeshes()) {
      if (mesh.name.startsWith('atmosphere-')) mesh.setEnabled(false)
    }
  }

  const texture = new DynamicTexture('hangarWindowSky', { width: 1024, height: 512 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createLinearGradient(0, 0, 1024, 512)
  gradient.addColorStop(0, '#050a19')
  gradient.addColorStop(0.5, '#102039')
  gradient.addColorStop(1, '#03070f')
  context.fillStyle = gradient
  context.fillRect(0, 0, 1024, 512)
  for (let index = 0; index < 280; index += 1) {
    const x = (index * 371.47) % 1024
    const y = (index * 197.83) % 512
    context.fillStyle = index % 4 === 0 ? '#80b6d9' : '#b7c9dc'
    context.globalAlpha = 0.2 + (index % 7) * 0.1
    context.fillRect(x, y, index % 21 === 0 ? 2 : 1, index % 21 === 0 ? 2 : 1)
  }
  context.globalAlpha = 1
  texture.update()
  const skyMaterial = new StandardMaterial('hangarWindowSkyMaterial', scene)
  skyMaterial.disableLighting = true
  skyMaterial.emissiveTexture = texture
  skyMaterial.emissiveColor = Color3.Black()
  skyMaterial.diffuseColor = Color3.Black()
  const sky = MeshBuilder.CreatePlane('hangarWindowSky', { width: 160, height: 80 }, scene)
  sky.position.set(0, 20, 115)
  sky.material = skyMaterial
  sky.isPickable = false
  glow.addExcludedMesh(sky)
}