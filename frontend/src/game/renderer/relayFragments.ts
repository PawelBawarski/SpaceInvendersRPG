import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from './babylon'

/** Three drifting black-box fragments the salvage mission asks the player to recover. */
export function createRelayFragments(scene: Scene): TransformNode[] {
  const positions = [
    new Vector3(0, -2.2, 5),
    new Vector3(1.2, -1.6, 13),
    new Vector3(-1, -1.2, 22),
  ]
  return positions.map((position, index) => {
    const fragment = new TransformNode(`relayBlackBox${index}`, scene)
    fragment.position.copyFrom(position)
    const shard = MeshBuilder.CreateCylinder(`blackBoxShard${index}`, {
      height: 0.8,
      diameterTop: 0.2,
      diameterBottom: 0.8,
      tessellation: 6,
    }, scene)
    shard.parent = fragment
    shard.rotation.x = Math.PI / 2
    const material = new StandardMaterial(`blackBoxMaterial${index}`, scene)
    material.diffuseColor = new Color3(0.12, 0.35, 0.43)
    material.emissiveColor = new Color3(0.12, 0.8, 1)
    shard.material = material

    const marker = MeshBuilder.CreateTorus(`blackBoxMarker${index}`, {
      diameter: 1.3,
      thickness: 0.055,
      tessellation: 20,
    }, scene)
    marker.parent = fragment
    marker.rotation.x = Math.PI / 2
    marker.material = material
    return fragment
  })
}