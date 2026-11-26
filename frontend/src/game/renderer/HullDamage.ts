import { Color3, Mesh, type StandardMaterial, type TransformNode, VertexData } from './babylon'
import { createSceneMaterial } from './sectorDepth'

type ScarMount = readonly [x: number, y: number, z: number, size: number, angle: number]
type ScarPoint = readonly [number, number]

const LEVELS = [.78, .52, .24] as const
const CHAR = Color3.FromHexString('#151820')
const SOOT = Color3.FromHexString('#52332e')
const EMBER = Color3.FromHexString('#ed683a')
const EXPOSED_ALLOY = Color3.FromHexString('#92979a')
const OXIDIZED_EDGE = Color3.FromHexString('#b16f4d')
const FRACTURE: readonly (readonly ScarPoint[])[] = [
  [[-.92, .19], [-.38, .06], [-.18, .23], [.13, -.11], [.28, -.04], [.74, -.52]],
  [[-.38, .06], [-.28, -.22], [-.55, -.48]],
  [[.13, -.11], [.34, .21], [.58, .36]],
  [[.28, -.04], [.49, -.16], [.84, -.13]],
  [[-.18, .23], [-.15, .42], [.13, .57]],
]
const BURN_EDGE: readonly ScarPoint[] = [[-.55, -.08], [-.36, -.33], [-.03, -.26], [.54, -.35], [.44, .01], [.28, .22], [-.12, .31], [-.44, .19]]
const stages = new WeakMap<TransformNode, { meshes: Mesh[]; panels: Mesh[]; level: number }>()

export const VANTA_SCARS: readonly (readonly ScarMount[])[] = [
  [[-1.69, .172, -.58, .54, -.38], [-.49, .249, -.77, .33, 1.17], [-.045, .256, 1.56, .155, 1.48]],
  [[1.55, .181, -.64, .57, .28], [1.33, .247, .13, .29, 1.32], [.52, .248, -.32, .33, -.38]],
  [[-1.92, .129, -.83, .43, .74], [.06, .376, -.86, .39, 1.4], [.31, .23, -1.11, .31, -.32]],
]

export const CRITICAL_HULL_FRACTION = LEVELS[2]

function createScar(root: TransformNode, mounts: readonly ScarMount[], index: number, material: StandardMaterial) {
  const positions: number[] = []
  const indices: number[] = []
  const colors: number[] = []
  for (const [mountIndex, [x, y, z, size, angle]] of mounts.entries()) {
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const vertex = ([u, v]: ScarPoint, height: number, color: Color3) => {
      const vertexIndex = positions.length / 3
      positions.push(x + (u * cosine + v * sine) * size, y + height * size, z + (v * cosine - u * sine) * size)
      colors.push(color.r, color.g, color.b, 1)
      return vertexIndex
    }
    const center = vertex([-.06, .01], 0, CHAR)
    const rim = BURN_EDGE.map((point, edge) => vertex(point, 0, edge % 3 ? SOOT : OXIDIZED_EDGE))
    rim.forEach((current, offset) => indices.push(center, current, rim[(offset + 1) % rim.length]))
    for (const [branch, points] of FRACTURE.entries()) {
      const ribbon = points.map(([u, v], step) => {
        const width = step === points.length - 1 ? .009 : branch === 0 ? .047 : .025
        return [vertex([u, v - width], .007, CHAR), vertex([u, v + width], .007, CHAR)]
      })
      for (let step = 1; step < ribbon.length; step++) {
        const [a, b] = ribbon[step - 1]
        const [c, d] = ribbon[step]
        indices.push(a, b, c, c, b, d)
      }
    }
    const ember = index > 0 && mountIndex === 0 ? EMBER : OXIDIZED_EDGE
    const tip = vertex([-.22, .04], .012, CHAR)
    const first = vertex([.07, -.095], .012, ember)
    const second = vertex([.29, -.03], .012, ember)
    const third = vertex([.43, -.21], .012, CHAR)
    indices.push(tip, first, second, first, second, third)

    // Jagged pieces of plating catch the light above the torn surface.
    for (const [start, end, apex] of [[[-.48, -.26], [-.24, -.21], [-.36, -.046]], [[.24, .19], [.48, .11], [.36, -.02]]] as const) {
      const a = vertex(start, .012, SOOT)
      const b = vertex(end, .026, EXPOSED_ALLOY)
      const c = vertex(apex, .11 + index * .034, EXPOSED_ALLOY)
      indices.push(a, b, c)
    }
    for (const zOffset of [-.44, .35]) {
      const a = vertex([-.58, zOffset], .008, OXIDIZED_EDGE)
      const b = vertex([-.12, zOffset - .16], .008, CHAR)
      const c = vertex([-.16, zOffset - .09], .008, SOOT)
      indices.push(a, b, c)
    }
  }

  const data = new VertexData()
  data.positions = positions
  data.indices = indices
  data.colors = colors
  const mesh = new Mesh(`hull-damage-${index}`, root.getScene())
  data.applyToMesh(mesh)
  mesh.parent = root
  mesh.material = material
  mesh.isPickable = false
  mesh.setEnabled(false)
}

export function addHullScars(root: TransformNode, mountsByLevel: readonly (readonly ScarMount[])[]) {
  const scene = root.getScene()
  const material = createSceneMaterial(`${root.name}-scorchedHull`, scene)
  material.diffuseColor = Color3.White()
  material.disableLighting = true
  material.backFaceCulling = false
  mountsByLevel.forEach((mounts, index) => createScar(root, mounts, index, material))
  root.onDisposeObservable.addOnce(() => {
    if (scene.materials.includes(material)) material.dispose()
  })
}

/** The geometry is shared by fleet model clones. Only toggle it at hull thresholds. */
export function showHullDamage(root: TransformNode, hullFraction: number) {
  let state = stages.get(root)
  if (!state) {
    const pieces = root.getChildMeshes(true).filter((mesh): mesh is Mesh => mesh instanceof Mesh)
    const meshes = pieces.filter(mesh => mesh.name.startsWith('hull-damage-'))
    const panels = pieces.filter(mesh => typeof mesh.metadata?.breakawayStage === 'number')
    state = { meshes, panels, level: -1 }
    stages.set(root, state)
  }
  const level = LEVELS.findIndex(threshold => hullFraction > threshold)
  const count = level < 0 ? LEVELS.length : level
  if (state.level === count) return
  state.level = count
  state.meshes.forEach((mesh, index) => mesh.setEnabled(index < count))
  for (const panel of state.panels) panel.setEnabled(count < panel.metadata.breakawayStage)
}
