import { segmentBoundsOverlapSphere } from './collisionBroadphase'

export interface CombatPoint {
  x: number
  y: number
  z: number
}

interface CameraObstacle extends CombatPoint { radius: number }
const CAMERA_PLANET_CLEARANCE_FRACTION = .04

/** Pull the chase camera towards its anchor before it can cross a planet's surface. */
export function keepCameraOutsidePlanets(anchor: CombatPoint, camera: CombatPoint, planets: readonly CameraObstacle[], clearance: number) {
  let contact = 1
  for (const planet of planets) {
    const radius = planet.radius + Math.max(clearance, planet.radius * CAMERA_PLANET_CLEARANCE_FRACTION)
    if (!segmentBoundsOverlapSphere(anchor, camera, planet, radius)) continue
    const hit = segmentSphereContact(anchor, camera, planet, radius)
    if (hit !== null && hit > 0) contact = Math.min(contact, hit)
  }
  if (contact < 1) {
    camera.x = anchor.x + (camera.x - anchor.x) * contact
    camera.y = anchor.y + (camera.y - anchor.y) * contact
    camera.z = anchor.z + (camera.z - anchor.z) * contact
  }
  // A landing or a carried-over save can already be inside the clearance shell.
  for (const planet of planets) {
    const radius = planet.radius + Math.max(clearance, planet.radius * CAMERA_PLANET_CLEARANCE_FRACTION)
    const x = camera.x - planet.x
    const y = camera.y - planet.y
    const z = camera.z - planet.z
    if (Math.abs(x) >= radius || Math.abs(y) >= radius || Math.abs(z) >= radius) continue
    const distance = Math.hypot(x, y, z)
    if (distance >= radius) continue
    const anchorX = anchor.x - planet.x
    const anchorY = anchor.y - planet.y
    const anchorZ = anchor.z - planet.z
    const anchorDistance = Math.hypot(anchorX, anchorY, anchorZ)
    const direction = anchorDistance > 0.0001 ? 1 / anchorDistance : distance > 0.0001 ? 1 / distance : 0
    camera.x = planet.x + (anchorDistance > 0.0001 ? anchorX : x) * direction * radius
    camera.y = planet.y + (anchorDistance > 0.0001 ? anchorY : y) * direction * radius
    camera.z = planet.z + (anchorDistance > 0.0001 ? anchorZ : z) * direction * radius
    if (anchorDistance <= 0.0001 && distance <= 0.0001) camera.y = planet.y + radius
  }
}

/** First contact on a swept segment, including a segment beginning inside a sphere. */
export function segmentSphereContact(from: CombatPoint, to: CombatPoint, center: CombatPoint, radius: number): number | null {
  const ox = from.x - center.x
  const oy = from.y - center.y
  const oz = from.z - center.z
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const c = ox * ox + oy * oy + oz * oz - radius * radius
  if (c <= 0) return 0
  const a = dx * dx + dy * dy + dz * dz
  if (a < 0.0000001) return null
  const b = 2 * (ox * dx + oy * dy + oz * dz)
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  const t = (-b - Math.sqrt(discriminant)) / (2 * a)
  return t >= 0 && t <= 1 ? t : null
}
