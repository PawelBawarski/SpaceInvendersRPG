import type { CombatPoint } from './worldCombatMath'

/** Conservative rejection only: exact swept-sphere contact still decides hits. */
export function segmentBoundsOverlapSphere(from: CombatPoint, to: CombatPoint, center: CombatPoint, radius: number): boolean {
  return !(
    (from.x < center.x - radius && to.x < center.x - radius)
    || (from.x > center.x + radius && to.x > center.x + radius)
    || (from.y < center.y - radius && to.y < center.y - radius)
    || (from.y > center.y + radius && to.y > center.y + radius)
    || (from.z < center.z - radius && to.z < center.z - radius)
    || (from.z > center.z + radius && to.z > center.z + radius)
  )
}
