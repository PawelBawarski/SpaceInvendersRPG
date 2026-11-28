import { Color3, Mesh, MeshBuilder, PointLight, Scene, TransformNode, Vector3 } from './babylon'
import type { GraphicsQuality } from '../progress/gameSettings'
import { MEGASTATION } from '../domain/megastation'
import { createSceneMaterial } from './sectorDepth'

/**
 * A colossal ring habitat visible from orbit near the start.
 * Visual-only for now: docking and the walkable concourse are wired in later phases,
 * so this deliberately stays out of the tuned station/layout invariants.
 */
export function createMegastationVisual(scene: Scene, quality: GraphicsQuality) {
  const root = new TransformNode(`megastation-${MEGASTATION.id}`, scene)
  root.position.set(MEGASTATION.x, MEGASTATION.y, MEGASTATION.z)
  const r = MEGASTATION.radius
  const tessellation = quality === 'low' ? 24 : quality === 'high' ? 64 : 40

  const hull = createSceneMaterial(`megastationHull-${MEGASTATION.id}`, scene)
  hull.diffuseColor = Color3.FromHexString('#2b3c4d')
  hull.emissiveColor = Color3.FromHexString('#060d15')
  hull.specularColor = new Color3(0.3, 0.4, 0.5)

  const trim = createSceneMaterial(`megastationTrim-${MEGASTATION.id}`, scene)
  trim.diffuseColor = Color3.FromHexString('#54697a')

  const beacon = createSceneMaterial(`megastationBeacon-${MEGASTATION.id}`, scene)
  beacon.diffuseColor = beacon.emissiveColor = Color3.FromHexString(MEGASTATION.color)

  const dark = createSceneMaterial(`megastationBay-${MEGASTATION.id}`, scene)
  dark.diffuseColor = new Color3(0.006, 0.012, 0.02)

  const attach = (mesh: Mesh, material = hull) => {
    mesh.parent = root
    mesh.material = material
    mesh.isPickable = false
    return mesh
  }

  // Main habitat ring.
  const ring = MeshBuilder.CreateTorus(`megastationRing-${MEGASTATION.id}`, {
    diameter: r * 2, thickness: r * 0.16, tessellation,
  }, scene)
  ring.rotation.x = Math.PI / 2
  attach(ring)

  // Inner light band tracing the ring.
  const band = MeshBuilder.CreateTorus(`megastationBand-${MEGASTATION.id}`, {
    diameter: r * 2, thickness: r * 0.02, tessellation,
  }, scene)
  band.rotation.x = Math.PI / 2
  band.position.y = r * 0.09
  attach(band, beacon)

  // Central hub and docking spire.
  const hub = MeshBuilder.CreateCylinder(`megastationHub-${MEGASTATION.id}`, {
    height: r * 0.5, diameterTop: r * 0.34, diameterBottom: r * 0.5, tessellation,
  }, scene)
  attach(hub)
  const spire = MeshBuilder.CreateCylinder(`megastationSpire-${MEGASTATION.id}`, {
    height: r * 0.9, diameterTop: r * 0.05, diameterBottom: r * 0.16, tessellation,
  }, scene)
  spire.position.y = r * 0.62
  attach(spire, trim)
  const spireLight = MeshBuilder.CreateSphere(`megastationSpireLight-${MEGASTATION.id}`, {
    diameter: r * 0.06, segments: quality === 'low' ? 6 : 10,
  }, scene)
  spireLight.position.y = r * 1.08
  attach(spireLight, beacon)

  // Radial spokes joining hub to ring.
  const spokeCount = quality === 'low' ? 4 : 6
  for (let index = 0; index < spokeCount; index++) {
    const angle = (index / spokeCount) * Math.PI * 2
    const spoke = MeshBuilder.CreateBox(`megastationSpoke-${index}-${MEGASTATION.id}`, {
      width: r * 0.9, height: r * 0.05, depth: r * 0.08,
    }, scene)
    spoke.position.set(Math.cos(angle) * r * 0.5, 0, Math.sin(angle) * r * 0.5)
    spoke.rotation.y = -angle
    attach(spoke, trim)
  }

  // A dark central bay so the ring reads as a station, not a solid disc.
  const bay = MeshBuilder.CreateCylinder(`megastationBayCore-${MEGASTATION.id}`, {
    height: r * 0.04, diameter: r * 0.6, tessellation,
  }, scene)
  attach(bay, dark)

  // Static geometry: merge per material to keep draw calls low.
  for (const material of [hull, trim, beacon, dark]) {
    const meshes = root.getChildMeshes().filter(mesh => mesh.material === material) as Mesh[]
    const merged = Mesh.MergeMeshes(meshes, true, true)
    if (merged) {
      merged.name = `megastationGeometry-${MEGASTATION.id}-${material.name}`
      merged.parent = root
      merged.isPickable = false
    }
    material.freeze()
  }

  const beaconLight = new PointLight(`megastationLight-${MEGASTATION.id}`, new Vector3(0, r * 0.2, 0), scene)
  beaconLight.parent = root
  beaconLight.diffuse = Color3.FromHexString(MEGASTATION.color)
  beaconLight.intensity = 1.4
  beaconLight.range = r * 6
  beaconLight.includedOnlyMeshes = root.getChildMeshes()

  root.computeWorldMatrix(true)
  for (const mesh of root.getChildMeshes()) mesh.freezeWorldMatrix()
  return root
}