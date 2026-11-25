export interface CombatPoint {
  x: number
  y: number
  z: number
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
