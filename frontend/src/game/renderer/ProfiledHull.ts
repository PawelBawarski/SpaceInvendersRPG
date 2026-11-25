import { Mesh, type Scene, VertexData } from '@babylonjs/core'

/** A nose-to-tail elliptical section of a molded shell. */
export type HullSection = readonly [z: number, halfWidth: number, halfHeight: number, x?: number, y?: number]

export function createProfiledHull(scene: Scene, name: string, sections: readonly HullSection[], sides = 16): Mesh {
  const positions: number[] = []
  const indices: number[] = []
  const uvs: number[] = []
  for (const [ring, [z, width, height, x = 0, y = 0]] of sections.entries()) {
    for (let side = 0; side < sides; side++) {
      const angle = side * 2 * Math.PI / sides
      positions.push(x + width * Math.cos(angle), y + height * Math.sin(angle), z)
      uvs.push(side / sides, ring / (sections.length - 1))
    }
  }
  for (let ring = 0; ring < sections.length - 1; ring++) {
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side
      const b = ring * sides + (side + 1) % sides
      indices.push(a, a + sides, b, b, a + sides, b + sides)
    }
  }
  const [first, last] = [sections[0], sections[sections.length - 1]]
  const cap = sections.length * sides
  positions.push(first[3] ?? 0, first[4] ?? 0, first[0], last[3] ?? 0, last[4] ?? 0, last[0])
  uvs.push(.5, 0, .5, 1)
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides
    const end = (sections.length - 1) * sides
    indices.push(cap, side, next, cap + 1, end + next, end + side)
  }
  const normals: number[] = []
  VertexData.ComputeNormals(positions, indices, normals)
  const data = new VertexData()
  data.positions = positions
  data.indices = indices
  data.normals = normals
  data.uvs = uvs
  const mesh = new Mesh(name, scene)
  data.applyToMesh(mesh)
  return mesh
}
