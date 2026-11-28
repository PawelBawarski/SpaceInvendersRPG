import { Color3, FreeCamera, Mesh, MeshBuilder, PointLight, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from './babylon'
import { ALL_HANGARS, type SectorPosition, type StationSite } from '../domain/exploration'
import type { GraphicsQuality } from '../progress/gameSettings'
import { advanceDockingProgress, canDockAt, DEPARTURE_DURATION, dockingFade, forwardRotation, getStationApproachStage, sampleStationApproach, sampleStationDeparture } from '../simulation/StationApproach'
import { createSceneMaterial } from './sectorDepth'
import { createProfiledHull } from './ProfiledHull'

const PLANETARY_HANGAR_VISUAL_SCALE = 3.2

export function createStationSystem(scene: Scene, ship: TransformNode, camera: FreeCamera, quality: GraphicsQuality, sites: readonly StationSite[] = ALL_HANGARS, surfaceVisibility: (station: StationSite) => boolean = () => true) {
  const stations = sites.map(station => {
    const root = new TransformNode(`station-${station.id}`, scene)
    root.metadata = { stationId: station.id, dockingRange: station.dockingRange }
    const hull = createSceneMaterial(`stationHull-${station.id}`, scene)
    hull.diffuseColor = Color3.FromHexString('#334759')
    hull.emissiveColor = Color3.FromHexString('#09111b')
    hull.specularColor = new Color3(0.35, 0.45, 0.55)
    const trim = createSceneMaterial(`stationTrim-${station.id}`, scene)
    trim.diffuseColor = Color3.FromHexString('#5b7483')
    const light = createSceneMaterial(`stationBeacon-${station.id}`, scene)
    light.diffuseColor = light.emissiveColor = Color3.FromHexString(station.color)
    const dark = createSceneMaterial(`stationBay-${station.id}`, scene)
    dark.diffuseColor = new Color3(0.008, 0.014, 0.024)
    const r = station.radius
    const box = (name: string, width: number, height: number, depth: number, x: number, y: number, z: number, material = hull) => {
      const mesh = MeshBuilder.CreateBox(`${name}-${station.id}`, { width: r * width, height: r * height, depth: r * depth }, scene)
      mesh.parent = root
      mesh.position.set(r * x, r * y, r * z)
      mesh.material = material
      mesh.isPickable = false
      return mesh
    }
    const shell = (name: string, x: number, y: number, z: number, length: number, front: number, rear: number, material = hull) => {
      const mesh = MeshBuilder.CreateCylinder(`${name}-${station.id}`, {
        height: r * length, diameterTop: r * front, diameterBottom: r * rear, tessellation: quality === 'low' ? 8 : 12,
      }, scene)
      mesh.parent = root
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(r * x, r * y, r * z)
      mesh.material = material
      return mesh
    }
    const collar = (name: string, z: number, diameter: number, thickness: number, flatten: number, material: StandardMaterial) => {
      const mesh = MeshBuilder.CreateTorus(`${name}-${station.id}`, { diameter: r * diameter, thickness: r * thickness, tessellation: quality === 'low' ? 12 : 24 }, scene)
      mesh.parent = root
      mesh.position.z = z * r
      mesh.rotation.x = Math.PI / 2
      mesh.scaling.z = flatten
      mesh.material = material
    }
    // The exterior collars leave the central docking passage open.
    collar('armoredPort', -.72, 1.04, .16, .63, trim)
    collar('illuminatedPort', -.805, 1.025, .019, .63, light)
    collar('stationOuterTruss', .14, 1.61, .16, .63, hull)
    collar('stationTrussMarker', .225, 1.61, .016, .63, light)
    box('bayFloor', 0.72, 0.07, 1.05, 0, -0.2, -0.18, trim)
    box('bayCeiling', 0.72, 0.08, 1.05, 0, 0.2, -0.18)
    box('bayAirlock', 0.64, 0.34, 0.03, 0, 0, 0.32, dark)
    shell('stationReactor', 0, 0, .73, .86, .63, .97).scaling.z = .76
    shell('stationCommandBridge', 0, .58, .44, .73, .44, .23, trim).scaling.z = .64
    box('stationBridgeWindow', .25, .035, .036, 0, .60, .065, light)
    for (const side of [-1, 1]) {
      const fairing = createProfiledHull(scene, 'stationPortFairing' + side + '-' + station.id, [
        [-.79, .046, .13, side * .37], [-.68, .081, .24, side * .38], [-.29, .113, .262, side * .41],
        [.16, .134, .25, side * .425], [.36, .089, .167, side * .4],
      ], quality === 'low' ? 12 : 20)
      fairing.parent = root
      fairing.scaling.setAll(r)
      fairing.material = hull
      box('habitatArm', 0.8, 0.18, 0.3, side * 0.73, 0, 0.35, trim)
      shell('habitatDrum', side * 1.02, 0, .32, .83, .42, .54).scaling.z = 1.35
      const array = box('solarArray', .77, .037, .64, side * 1.3, .23, .36, dark)
      array.rotation.z = side * .32
      array.rotation.y = side * .32
      shell('maintenanceNacelle', side * .72, -.19, .5, .63, .21, .27, trim)
      box('entranceCap', .07, .12, .17, side * .49, .16, -.53, trim)
      box('entranceBeacon', 0.025, 0.3, 0.035, side * 0.29, 0, -0.71, light)
      for (let index = 0; index < (quality === 'low' ? 4 : 8); index++) {
        box('approachGuide', 0.018, 0.012, 0.08, side * 0.22, -0.15, -0.65 + index * 0.105, light)
        box('habitatWindow', .015, .058, .044, side * 1.263, 0.02, -.03 + index * .074, light)
      }
    }
    // Static station geometry needs four draws instead of dozens of individual panels.
    for (const material of [hull, trim, light, dark]) {
      const meshes = root.getChildMeshes().filter(mesh => mesh.material === material) as Mesh[]
      const merged = Mesh.MergeMeshes(meshes, true, true)
      if (merged) { merged.name = `stationGeometry-${station.id}-${material.name}`; merged.parent = root; merged.isPickable = false }
      material.freeze()
    }
    if (station.planetId) {
      root.scaling.setAll(PLANETARY_HANGAR_VISUAL_SCALE)
      const beaconLight = new PointLight(`planetaryHangarLight-${station.id}`, new Vector3(0, r * .76, -r * .25), scene)
      beaconLight.parent = root
      beaconLight.diffuse = Color3.FromHexString(station.color)
      beaconLight.intensity = 1.7
      beaconLight.range = r * 12
      beaconLight.includedOnlyMeshes = root.getChildMeshes()
    }
    root.position.set(station.x, station.y, station.z)
    root.computeWorldMatrix(true)
    for (const mesh of root.getChildMeshes()) mesh.freezeWorldMatrix()
    return { station, root, center: root.position.clone() }
  })
  let active: StationSite | null = null
  let progress = 0
  let departing = false
  const start = new Vector3()
  const approachRotation = Quaternion.Identity()
  const direction = new Vector3()
  const cameraTarget = new Vector3()
  const desiredCamera = new Vector3()
  const forward = Vector3.Forward()

  return {
    getNearbyStation(position: SectorPosition): StationSite | null {
      return sites.find(station => surfaceVisibility(station) && canDockAt(position, station)) ?? null
    },
    beginDocking(stationId: string): boolean {
      if (active) return false
      const station = sites.find(site => site.id === stationId)
      if (!station || !canDockAt(ship.position, station)) return false
      active = station
      departing = false
      progress = 0
      start.copyFrom(ship.position)
      ship.rotationQuaternion ??= Quaternion.FromEulerVector(ship.rotation)
      approachRotation.copyFrom(ship.rotationQuaternion)
      return true
    },
    beginDeparture(stationId: string): boolean {
      const station = sites.find(site => site.id === stationId)
      if (!station || active) return false
      active = station
      departing = true
      progress = 0
      const point = sampleStationDeparture(station, 0)
      ship.position.set(point.x, point.y, point.z)
      ship.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI, 0)
      approachRotation.copyFrom(ship.rotationQuaternion)
      camera.position.copyFrom(ship.position).addInPlaceFromFloats(0, 5, 18)
      camera.setTarget(ship.position.add(new Vector3(0, 0, -25)))
      return true
    },
    update(dt: number, hangarReady: boolean) {
      for (const { root, center, station } of stations) root.setEnabled(surfaceVisibility(station) && Vector3.DistanceSquared(ship.position, center) < 12000 ** 2)
      if (active) {
        progress = departing ? Math.min(1, progress + Math.max(0, dt) / DEPARTURE_DURATION) : advanceDockingProgress(progress, dt, hangarReady)
        const sample = (p: number) => departing ? sampleStationDeparture(active!, p) : sampleStationApproach(active!, start, p)
        const point = sample(progress)
        const ahead = sample(Math.min(1, progress + 0.015))
        direction.set(ahead.x - point.x, ahead.y - point.y, ahead.z - point.z)
        if (direction.lengthSquared() > 0.001) {
          const rotation = forwardRotation(direction)
          Quaternion.FromEulerAnglesToRef(rotation.pitch, rotation.yaw, 0, approachRotation)
        }
        ship.rotationQuaternion ??= Quaternion.Identity()
        Quaternion.SlerpToRef(ship.rotationQuaternion, approachRotation, Math.min(1, dt * 3), ship.rotationQuaternion)
        ship.position.set(point.x, point.y, point.z)
        ship.getDirectionToRef(forward, direction)
        const side = Math.sin(progress * Math.PI) * (departing ? 6 : -4)
        desiredCamera.set(ship.position.x - direction.x * 18 + (direction.z * side),
          ship.position.y - direction.y * 18 + 5 + Math.abs(side) * .24, ship.position.z - direction.z * 18 - direction.x * side)
        Vector3.LerpToRef(camera.position, desiredCamera, 1 - Math.exp(-Math.max(0, dt) * 4.5), camera.position)
        cameraTarget.copyFrom(ship.position).addInPlace(direction.scale(25))
        camera.setTarget(cameraTarget)
      }
      const complete = active !== null && progress >= 1
      const result = {
        active: active !== null, departing, progress, stage: departing ? 'departure' : active ? getStationApproachStage(active, start, progress, hangarReady) : 'idle',
        stationId: active?.id ?? null, fade: departing ? Math.max(0, 1 - progress * 5) : dockingFade(progress), complete,
      }
      if (complete && departing) {
        ship.rotationQuaternion!.toEulerAnglesToRef(ship.rotation)
        ship.rotationQuaternion = null
        active = null
      }
      return result
    },
    dispose() { for (const { root } of stations) root.dispose(false, true) },
  }
}
