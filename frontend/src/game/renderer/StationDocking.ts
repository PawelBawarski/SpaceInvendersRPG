import { Color3, FreeCamera, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core'
import { ORION_STATIONS, type SectorPosition, type StationSite } from '../domain/exploration'
import type { GraphicsQuality } from '../progress/gameSettings'
import { advanceDockingProgress, canDockAt, DEPARTURE_DURATION, dockingFade, forwardRotation, sampleStationApproach, sampleStationDeparture } from '../simulation/StationApproach'

export function createStationSystem(scene: Scene, ship: TransformNode, camera: FreeCamera, quality: GraphicsQuality) {
  const stations = ORION_STATIONS.map(station => {
    const root = new TransformNode(`station-${station.id}`, scene)
    root.metadata = { stationId: station.id, dockingRange: station.dockingRange }
    const hull = new StandardMaterial(`stationHull-${station.id}`, scene)
    hull.diffuseColor = Color3.FromHexString('#182736')
    hull.specularColor = new Color3(0.35, 0.45, 0.55)
    const trim = new StandardMaterial(`stationTrim-${station.id}`, scene)
    trim.diffuseColor = Color3.FromHexString('#35495a')
    const light = new StandardMaterial(`stationBeacon-${station.id}`, scene)
    light.diffuseColor = light.emissiveColor = Color3.FromHexString(station.color)
    const dark = new StandardMaterial(`stationBay-${station.id}`, scene)
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
    // An open box gives the approach a real interior and visible airlock.
    box('bayFloor', 0.72, 0.07, 1.05, 0, -0.2, -0.18, trim)
    box('bayCeiling', 0.72, 0.08, 1.05, 0, 0.2, -0.18)
    box('bayPortWall', 0.1, 0.42, 1.05, -0.36, 0, -0.18)
    box('bayStarboardWall', 0.1, 0.42, 1.05, 0.36, 0, -0.18)
    box('bayAirlock', 0.64, 0.34, 0.03, 0, 0, 0.32, dark)
    box('stationReactor', 0.8, 0.75, 0.65, 0, 0, 0.68)
    box('commandSpire', 0.25, 1.0, 0.35, 0, 0.52, 0.5, trim)
    for (const side of [-1, 1]) {
      box('habitatArm', 0.8, 0.18, 0.3, side * 0.73, 0, 0.35, trim)
      box('habitatBlock', 0.35, 0.8, 0.7, side * 1.02, 0, 0.35)
      box('solarArray', 0.85, 0.025, 0.8, side * 1.3, 0.4, 0.3, dark)
      box('entranceBeacon', 0.025, 0.3, 0.035, side * 0.29, 0, -0.71, light)
      for (let index = 0; index < (quality === 'low' ? 4 : 8); index++) {
        box('approachGuide', 0.018, 0.012, 0.08, side * 0.22, -0.15, -0.65 + index * 0.105, light)
        box('habitatWindow', 0.12, 0.018, 0.012, side * 1.02, -0.25 + index * 0.07, -0.008, light)
      }
    }
    // Static station geometry needs four draws instead of dozens of individual panels.
    for (const material of [hull, trim, light, dark]) {
      const meshes = root.getChildMeshes().filter(mesh => mesh.material === material) as Mesh[]
      const merged = Mesh.MergeMeshes(meshes, true, true)
      if (merged) { merged.name = `stationGeometry-${station.id}-${material.name}`; merged.parent = root; merged.isPickable = false }
      material.freeze()
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

  return {
    getNearbyStation(position: SectorPosition): StationSite | null {
      return ORION_STATIONS.find(station => canDockAt(position, station)) ?? null
    },
    beginDocking(stationId: string): boolean {
      if (active) return false
      const station = ORION_STATIONS.find(site => site.id === stationId)
      if (!station || !canDockAt(ship.position, station)) return false
      active = station
      departing = false
      progress = 0
      start.copyFrom(ship.position)
      ship.rotationQuaternion ??= Quaternion.FromEulerVector(ship.rotation)
      return true
    },
    beginDeparture(stationId: string): boolean {
      const station = ORION_STATIONS.find(site => site.id === stationId)
      if (!station || active) return false
      active = station
      departing = true
      progress = 0
      const point = sampleStationDeparture(station, 0)
      ship.position.set(point.x, point.y, point.z)
      ship.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI, 0)
      camera.position.copyFrom(ship.position).addInPlaceFromFloats(0, 5, 18)
      camera.setTarget(ship.position.add(new Vector3(0, 0, -25)))
      return true
    },
    update(dt: number, hangarReady: boolean) {
      for (const { root, center } of stations) root.setEnabled(Vector3.DistanceSquared(ship.position, center) < 12000 ** 2)
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
        ship.getDirectionToRef(new Vector3(0, 0, 1), direction)
        desiredCamera.copyFrom(ship.position).subtractInPlace(direction.scale(18)).addInPlaceFromFloats(0, 5, 0)
        Vector3.LerpToRef(camera.position, desiredCamera, Math.min(1, dt * 4), camera.position)
        cameraTarget.copyFrom(ship.position).addInPlace(direction.scale(25))
        camera.setTarget(cameraTarget)
      }
      const complete = active !== null && progress >= 1
      const result = {
        active: active !== null, departing, progress, stage: departing ? 'departure' : progress >= 0.82 && !hangarReady ? 'waiting' : progress < 0.38 ? 'approach' : progress < 0.76 ? 'entry' : 'airlock',
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
