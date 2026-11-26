import { segmentBoundsOverlapSphere } from './collisionBroadphase'

export interface CombatPoint {
  x: number
  y: number
  z: number
}

interface CameraObstacle extends CombatPoint { radius: number }

/** Pull the chase camera towards its anchor before it can cross a planet's surface. */
export function keepCameraOutsidePlanets(anchor: CombatPoint, camera: CombatPoint, planets: readonly CameraObstacle[], clearance: number) {
  let contact = 1
  for (const planet of planets) {
    const radius = planet.radius + clearance
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
    const radius = planet.radius + clearance
    const x = camera.x - planet.x
    const y = camera.y - planet.y
    const z = camera.z - planet.z
    if (Math.abs(x) >= radius || Math.abs(y) >= radius || Math.abs(z) >= radius) continue
    const distance = Math.hypot(x, y, z)
    if (distance >= radius) continue
    const scale = distance > 0 ? radius / distance : 0
    camera.x = planet.x + x * scale
    camera.y = planet.y + (scale > 0 ? y * scale : radius)
    camera.z = planet.z + z * scale
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
