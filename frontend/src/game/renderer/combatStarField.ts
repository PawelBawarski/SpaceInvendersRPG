import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from './babylon'

/** Builds a merged, three-tone starfield dome used by the combat scene. */
export function createStarField(scene: Scene, starCount: number): TransformNode {
  const field = new TransformNode('starField', scene)
  const materials = [new Color3(0.62, 0.78, 1), new Color3(1, 0.7, 0.42), new Color3(0.9, 0.95, 1)].map((color, index) => {
    const material = new StandardMaterial(`starMaterial${index}`, scene)
    material.disableLighting = true
    material.emissiveColor = color
    return material
  })
  for (let i = 0; i < starCount; i += 1) {
    const star = MeshBuilder.CreateSphere(`star${i}`, { diameter: 0.025 + (i % 4) * 0.012, segments: 3 }, scene)
    star.parent = field
    star.position.set(
      ((i * 37) % 40) - 20,
      ((i * 71) % 30) - 15,
      ((i * 53) % 80) - 10,
    )
    star.material = materials[i % materials.length]
    star.isPickable = false
  }
  for (const material of materials) {
    const stars = field.getChildMeshes().filter((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.material === material)
    const combined = Mesh.MergeMeshes(stars, true, true)
    if (combined) {
      combined.parent = field
      combined.isPickable = false
    }
  }
  return field
}