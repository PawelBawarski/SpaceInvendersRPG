import { afterEach, describe, expect, it } from 'vitest'
import { FreeCamera, NullEngine, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { ORION_STATIONS } from '../domain/exploration'
import { createStationSystem } from './StationDocking'
import { DEPARTURE_DURATION, DOCKING_DURATION } from '../simulation/StationApproach'

const engines: NullEngine[] = []
afterEach(() => { for (const engine of engines.splice(0)) engine.dispose() })

function setup() {
  const engine = new NullEngine()
  engines.push(engine)
  const scene = new Scene(engine)
  const ship = new TransformNode('testShip', scene)
  const camera = new FreeCamera('testCamera', Vector3.Zero(), scene)
  const stations = createStationSystem(scene, ship, camera, 'standard')
  return { scene, ship, camera, stations }
}

describe('station transit rendering', () => {
  it('keeps the nose aligned with the approach rather than flying tail first', () => {
    const { ship, stations } = setup()
    ship.position.copyFromFloats(0, 0, 1420)
    expect(stations.beginDocking(ORION_STATIONS[0].id)).toBe(true)
    for (let frame = 0; frame < Math.ceil(DOCKING_DURATION * 10); frame++) stations.update(0.1, true)
    expect(ship.getDirection(Vector3.Forward()).z).toBeGreaterThan(0.99)
    expect(ship.position.z).toBeGreaterThan(1600)
  })

  it('hands control back facing away from the station after an animated departure', () => {
    const { ship, stations } = setup()
    expect(stations.beginDeparture(ORION_STATIONS[0].id)).toBe(true)
    const startZ = ship.position.z
    const halfway = stations.update(DEPARTURE_DURATION / 2, true)
    expect(halfway).toMatchObject({ active: true, departing: true, complete: false, progress: 0.5 })
    expect(ship.position.z).toBeLessThan(startZ)
    expect(ship.getDirection(Vector3.Forward()).z).toBeLessThan(-0.99)
    expect(stations.update(DEPARTURE_DURATION / 2, true)).toMatchObject({ complete: true, departing: true })
    expect(ship.rotationQuaternion).toBeNull()
    expect(ship.getDirection(Vector3.Forward()).z).toBeLessThan(-0.99)
    expect(stations.update(0.1, true).active).toBe(false)
    expect(stations.beginDocking(ORION_STATIONS[0].id)).toBe(false)
  })

  it('batches each static station into four material groups without moving its geometry', () => {
    const { scene } = setup()
    for (const station of ORION_STATIONS) {
      const root = scene.getTransformNodeByName(`station-${station.id}`)!
      const meshes = root.getChildMeshes()
      expect(meshes).toHaveLength(4)
      expect(meshes.every(mesh => mesh.isWorldMatrixFrozen && !mesh.isPickable)).toBe(true)
      for (const mesh of meshes) expect(Math.abs(mesh.getBoundingInfo().boundingBox.centerWorld.z - station.z)).toBeLessThan(station.radius * 2)
    }
  })
})
