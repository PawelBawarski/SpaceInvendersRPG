import { Color3, MeshBuilder, PointLight, Quaternion, type Scene, StandardMaterial, type TransformNode, Vector3 } from './babylon'

const REPAIR_ORBIT = { radiusX: 4.15, radiusZ: 3.15, radiansPerSecond: .82, response: 4.1 } as const

export function createHangarRepair(scene: Scene, robot: TransformNode, ship: TransformNode) {
  const berth = robot.position.clone()
  const desired = new Vector3()
  const contact = new Vector3()
  const emitter = new Vector3()
  const direction = new Vector3()
  const plasma = new StandardMaterial('repairArcMaterial', scene)
  plasma.disableLighting = true
  plasma.emissiveColor = Color3.FromHexString('#ffbd65')
  const arc = MeshBuilder.CreateCylinder('hangarRepairArc', { height: 1, diameter: .025, tessellation: 6 }, scene)
  arc.rotationQuaternion = Quaternion.Identity()
  const flash = MeshBuilder.CreateSphere('hangarRepairFlash', { diameter: .135, segments: 8 }, scene)
  for (const mesh of [arc, flash]) {
    mesh.material = plasma
    mesh.isPickable = false
    mesh.setEnabled(false)
  }
  const workLight = new PointLight('hangarRepairLight', contact.clone(), scene)
  workLight.diffuse = Color3.FromHexString('#ffaa65')
  workLight.range = 4.3
  workLight.renderPriority = 3
  workLight.setEnabled(false)
  let t = 0
  let welding = false

  return (dt: number, idleElapsed: number, repairing: boolean, viewer: Vector3) => {
    t = repairing ? t + dt : 0
    const angle = Math.PI + t * REPAIR_ORBIT.radiansPerSecond
    const x = Math.cos(angle)
    const z = Math.sin(angle)
    if (repairing) {
      desired.set(ship.position.x + x * REPAIR_ORBIT.radiusX, ship.position.y + .5 + Math.sin(t * 2.4) * .16,
        ship.position.z + z * REPAIR_ORBIT.radiusZ)
      contact.set(ship.position.x + x * 2.45, ship.position.y + .33, ship.position.z + z * 1.28)
    } else {
      desired.copyFrom(berth)
      desired.y += Math.sin(idleElapsed * 2.2) * .095
      contact.copyFrom(viewer)
    }
    const blend = 1 - Math.exp(-dt * REPAIR_ORBIT.response)
    Vector3.LerpToRef(robot.position, desired, blend, robot.position)
    const yaw = Math.atan2(contact.x - robot.position.x, contact.z - robot.position.z)
    const delta = yaw - robot.rotation.y
    robot.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * blend
    robot.rotation.z = repairing ? Math.sin(angle) * .14 : 0

    const arcReady = repairing && Vector3.DistanceSquared(robot.position, desired) < 1.1
    if (arcReady !== welding) {
      welding = arcReady
      arc.setEnabled(welding)
      flash.setEnabled(welding)
      workLight.setEnabled(welding)
    }
    if (!welding) return
    emitter.set(robot.position.x + Math.sin(robot.rotation.y) * .43, robot.position.y + .73,
      robot.position.z + Math.cos(robot.rotation.y) * .43)
    contact.subtractToRef(emitter, direction)
    const length = direction.length()
    arc.position.copyFrom(emitter).addInPlaceFromFloats(direction.x * .5, direction.y * .5, direction.z * .5)
    arc.scaling.y = length
    Quaternion.FromUnitVectorsToRef(Vector3.UpReadOnly, direction.normalize(), arc.rotationQuaternion!)
    const pulse = .35 + .65 * Math.sin(t * 29) ** 4
    arc.visibility = pulse * .75
    flash.position.copyFrom(contact)
    flash.scaling.setAll(.35 + pulse)
    workLight.position.copyFrom(contact).addInPlaceFromFloats(0, .14, 0)
    workLight.intensity = pulse * .76
  }
}
