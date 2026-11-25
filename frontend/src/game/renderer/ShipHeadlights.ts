import { Color3, MeshBuilder, Scene, SpotLight, TransformNode, Vector3 } from '@babylonjs/core'
import { createSceneMaterial } from './sectorDepth'

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
  const beam = new SpotLight('pilotSearchlight', new Vector3(0, .12, 1.45), new Vector3(0, -.028, 1), 1.05, 2.4, scene)
  beam.parent = root
  beam.diffuse = new Color3(.72, .88, 1)
  beam.intensity = 3.8
  beam.range = 185
  return (enabled: boolean) => {
    root.setEnabled(enabled)
    beam.setEnabled(enabled)
  }
}
