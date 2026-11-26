import { Color3, MeshBuilder, Scene, Vector3 } from './babylon'
import { createSceneMaterial } from './sectorDepth'

const STAR_COLORS = [
  { name: 'blue', emissive: '#8bcfff' },
  { name: 'gold', emissive: '#f7ad54' },
  { name: 'white', emissive: '#b9d6ff' },
] as const

export function createSectorStarField(scene: Scene, count: number, center: Vector3) {
  const batches = STAR_COLORS.flatMap((color, batchIndex) => {
    const batchCount = Math.ceil((count - batchIndex) / STAR_COLORS.length)
    if (batchCount <= 0) return []

    const material = createSceneMaterial(`sector${color.name}StarMaterial`, scene)
    material.disableLighting = true
    material.diffuseColor = Color3.Black()
    material.emissiveColor = Color3.FromHexString(color.emissive).scale(.19)
    const mesh = MeshBuilder.CreateSphere(`sectorStarBatch-${color.name}`, { diameter: 1, segments: 4 }, scene)
    mesh.material = material
    mesh.isPickable = false
    mesh.thinInstanceEnablePicking = false

    const matrices = new Float32Array(batchCount * 16)
    for (let index = 0; index < batchCount; index += 1) {
      const offset = index * 16
      const size = 0.055 + Math.random() * 0.14
      matrices[offset] = matrices[offset + 5] = matrices[offset + 10] = size
      matrices[offset + 15] = 1
      matrices[offset + 12] = center.x + (Math.random() - 0.5) * 150
      matrices[offset + 13] = center.y + (Math.random() - 0.5) * 100
      matrices[offset + 14] = center.z + 30 + Math.random() * 170
    }
    mesh.thinInstanceSetBuffer('matrix', matrices, 16, false)
    mesh.thinInstanceRefreshBoundingInfo()
    return [{ mesh, matrices, batchIndex }]
  })

  return {
    setCount(total: number) {
      for (const { mesh, matrices, batchIndex } of batches) {
        const visible = Math.min(matrices.length / 16, Math.max(0, Math.ceil((total - batchIndex) / STAR_COLORS.length)))
        if (mesh.thinInstanceCount !== visible) {
          mesh.thinInstanceCount = visible
          mesh.thinInstanceRefreshBoundingInfo()
        }
      }
    },
    update(position: Vector3) {
      for (const { mesh, matrices } of batches) {
        let changed = false
        for (let offset = 0; offset < mesh.thinInstanceCount * 16; offset += 16) {
          const x = matrices[offset + 12]
          const y = matrices[offset + 13]
          const z = matrices[offset + 14]
          if (z < position.z - 45 || z > position.z + 210
            || Math.abs(x - position.x) > 110 || Math.abs(y - position.y) > 80) {
            matrices[offset + 12] = position.x + (Math.random() - 0.5) * 150
            matrices[offset + 13] = position.y + (Math.random() - 0.5) * 100
            matrices[offset + 14] = position.z + 30 + Math.random() * 170
            changed = true
          }
        }
        if (changed) {
          mesh.thinInstanceBufferUpdated('matrix')
          mesh.thinInstanceRefreshBoundingInfo()
        }
      }
    },
  }
}
