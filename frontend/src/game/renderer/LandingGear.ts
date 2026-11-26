import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode } from './babylon'
import { LANDING_GEAR_GEOMETRY } from '../simulation/HangarLanding'

/** Articulated gear shares the ship transform and shadow map, including its moving feet. */
export function createLandingGear(scene: Scene, ship: TransformNode, metal: StandardMaterial, caution: StandardMaterial) {
  const geometry = LANDING_GEAR_GEOMETRY
  const pistonMaterial = new StandardMaterial('hangarLandingPistonMaterial', scene)
  pistonMaterial.diffuseColor = Color3.FromHexString('#becfdc')
  pistonMaterial.specularColor = Color3.FromHexString('#a5cce3')
  pistonMaterial.specularPower = 96
  const legs = [[-1.3, -0.55], [1.3, -0.55], [0, 1.22]].map(([x, z], index) => {
    const pivot = new TransformNode(`hangarLandingGear-${index}`, scene)
    pivot.parent = ship
    pivot.position.set(x, geometry.mountY, z)
    const housing = MeshBuilder.CreateCylinder(`hangarLandingStrut-${index}`, { height: geometry.housingLength, diameter: 0.13, tessellation: 10 }, scene)
    housing.parent = pivot
    housing.position.y = -geometry.housingLength / 2
    housing.material = metal
    const piston = MeshBuilder.CreateCylinder(`hangarLandingPiston-${index}`, { height: geometry.pistonLength, diameter: 0.075, tessellation: 10 }, scene)
    piston.parent = pivot
    piston.material = pistonMaterial
    const foot = MeshBuilder.CreateBox(`hangarLandingFoot-${index}`, { width: 0.42, height: geometry.footHeight, depth: 0.55 }, scene)
    foot.parent = pivot
    foot.material = metal
    const marker = MeshBuilder.CreateBox(`hangarLandingFootMark-${index}`, { width: 0.34, height: 0.025, depth: 0.08 }, scene)
    marker.parent = foot
    marker.position.set(0, geometry.footHeight / 2 + 0.013, -0.17)
    marker.material = caution
    for (const mesh of pivot.getChildMeshes()) mesh.isPickable = false
    return { pivot, piston, foot }
  })
  let previous = -1
  let previousCompression = -1
  return {
    update(deployment: number, compression = 0) {
      const amount = Math.max(0, Math.min(1, deployment))
      const compressed = Math.max(0, Math.min(geometry.maximumCompression, compression)) * amount
      if (amount === previous && compressed === previousCompression) return
      previous = amount
      previousCompression = compressed
      const extension = geometry.stroke * amount - compressed
      for (const { pivot, piston, foot } of legs) {
        pivot.setEnabled(amount > 0)
        pivot.rotation.x = (1 - amount) * Math.PI / 2
        piston.position.y = -geometry.housingLength - extension + geometry.pistonLength / 2
        foot.position.y = -geometry.housingLength - extension
        foot.rotation.x = -pivot.rotation.x
      }
    },
  }
}
