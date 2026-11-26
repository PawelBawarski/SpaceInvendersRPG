import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from './babylon'
import type { MerchantSite } from '../domain/exploration'
import { createSceneMaterial } from './sectorDepth'

export function createMerchantShip(scene: Scene, site: MerchantSite) {
  const root = new TransformNode('exchangeArk', scene)
  const metal = (name: string, color: string, strength: number) => {
    const material = createSceneMaterial(`exchangeArk-${name}`, scene)
    material.diffuseColor = Color3.FromHexString(color)
    material.emissiveColor = material.diffuseColor.scale(strength)
    material.specularColor = new Color3(0.47, 0.51, 0.55)
    return material
  }
  const hull = metal('hull', '#526878', 0.12)
  const recess = metal('frame', '#182835', 0.14)
  const cargo = metal('cargo', '#a1774b', 0.16)
  const light = metal('lights', '#88e8df', 0.85)
  const cylinder = (name: string, x: number, y: number, z: number, length: number, nose: number, tail: number, material: StandardMaterial, facets = 12) => {
    const mesh = MeshBuilder.CreateCylinder(name, { height: length, diameterTop: nose, diameterBottom: tail, tessellation: facets }, scene)
    mesh.rotation.x = Math.PI / 2
    mesh.position.set(x, y, z)
    mesh.parent = root
    mesh.material = material
    return mesh
  }
  const box = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number, material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene)
    mesh.position.set(x, y, z)
    mesh.parent = root
    mesh.material = material
    return mesh
  }
  cylinder('arkKeel', 0, 0, -.06, 1.86, .28, .71, hull, 8).scaling.z = .63
  cylinder('arkCommandBridge', 0, .18, .55, .45, .33, .46, recess, 8).scaling.z = .45
  box('arkBridgeWindow', 0, .21, .7, .29, .028, .13, light)
  box('arkCargoTruss', 0, 0, -.05, 1.18, .13, .9, recess)
  for (const side of [-1, 1]) {
    cylinder('arkCargoColumn', side * .46, .02, -.07, 1.5, .27, .42, hull, 8)
    for (let index = 0; index < 4; index++) {
      const z = -.46 + index * .29
      box('arkCargoContainer', side * .47, .14, z, .27, .18, .22, cargo)
      box('arkCargoSignal', side * .61, .15, z, .018, .025, .095, light)
      box('arkCargoLatch', side * .47, .237, z, .24, .025, .035, recess)
    }
    const engine = cylinder('arkEngine', side * .4, 0, -.89, .34, .33, .4, recess)
    engine.scaling.z = .87
    cylinder('arkDriveCore', side * .4, 0, -1.064, .038, .28, .3, light)
    const arm = box('arkAntenna', side * .63, .17, .44, .025, .36, .025, hull)
    arm.rotation.z = -side * .5
    box('arkNavigationLight', side * .71, .33, .44, .04, .04, .05, light)
  }
  for (const material of [hull, recess, cargo, light]) {
    const pieces = root.getChildMeshes().filter(mesh => mesh.material === material) as Mesh[]
    const combined = Mesh.MergeMeshes(pieces, true, true)
    if (combined) { combined.parent = root; combined.isPickable = false }
    material.freeze()
  }
  root.position.set(site.x, site.y, site.z)
  root.rotation.y = -0.42
  root.scaling.setAll(site.radius)
  root.setEnabled(false)
  return {
    update(position: Vector3) { root.setEnabled(Vector3.DistanceSquared(position, root.position) < 16000 ** 2) },
  }
}
