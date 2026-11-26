import { Color3, Constants, GlowLayer, Mesh, MeshBuilder, Scene, SpotLight, TransformNode, Vector3, VertexData } from './babylon'
import { createSceneMaterial } from './sectorDepth'

const SEARCHLIGHT_RANGE = 520
const SHAFT_SIDES = 14
const SHAFT_PROFILE = [
  [0, .30, .105], [12, 1.3, .042], [95, 6.3, .018], [270, 13, .008], [SEARCHLIGHT_RANGE, 24, 0],
] as const

function createSearchlightShaft(scene: Scene, root: TransformNode, position: Vector3, direction: Vector3) {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  for (const [ring, [distance, radius, alpha]] of SHAFT_PROFILE.entries()) {
    for (let side = 0; side < SHAFT_SIDES; side++) {
      const angle = side / SHAFT_SIDES * Math.PI * 2
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius + direction.y * distance, distance)
      colors.push(1, 1, 1, alpha)
      if (!ring) continue
      const index = ring * SHAFT_SIDES + side
      const next = ring * SHAFT_SIDES + (side + 1) % SHAFT_SIDES
      indices.push(index - SHAFT_SIDES, index, next, index - SHAFT_SIDES, next, next - SHAFT_SIDES)
    }
  }
  const shaft = new Mesh('pilotSearchlightShaft', scene)
  const data = new VertexData()
  data.positions = positions
  data.colors = colors
  data.indices = indices
  data.applyToMesh(shaft)
  const material = createSceneMaterial('pilotSearchlightShaftMaterial', scene)
  material.disableLighting = true
  material.disableDepthWrite = true
  material.backFaceCulling = false
  material.alphaMode = Constants.ALPHA_ADD
  material.diffuseColor = Color3.Black()
  material.emissiveColor = new Color3(.31, .56, .72)
  shaft.material = material
  shaft.parent = root
  shaft.position.copyFrom(position)
  shaft.isPickable = false
  shaft.hasVertexAlpha = true
  const glow = scene.effectLayers.find(layer => layer instanceof GlowLayer)
  if (glow instanceof GlowLayer) glow.addExcludedMesh(shaft)
}

export function createShipHeadlights(scene: Scene, ship: TransformNode) {
  const root = new TransformNode('shipHeadlights', scene)
  root.parent = ship
  const lens = createSceneMaterial('pilotHeadlightLens', scene)
  lens.disableLighting = true
  lens.emissiveColor = new Color3(.76, .92, 1)
  for (const side of [-1, 1]) {
    const lamp = MeshBuilder.CreateSphere(`pilotHeadlamp-${side}`, { diameter: .18, segments: 16 }, scene)
    lamp.parent = root
    lamp.position.set(side * .34, .17, 1.12)
    lamp.scaling.set(1.25, .42, .65)
    lamp.material = lens
    lamp.isPickable = false
  }
  const beam = new SpotLight('pilotSearchlight', new Vector3(0, .12, 1.45), new Vector3(0, -.028, 1), .72, 2.6, scene)
  beam.parent = root
  beam.diffuse = new Color3(.72, .88, 1)
  beam.intensity = 4.1
  beam.range = SEARCHLIGHT_RANGE
  beam.renderPriority = 4
  createSearchlightShaft(scene, root, beam.position, beam.direction)
  return (enabled: boolean) => {
    root.setEnabled(enabled)
    beam.setEnabled(enabled)
  }
}
