import type { SectorPosition } from './exploration'

export interface DamageSource {
  position: SectorPosition
  label: { pl: string; en: string }
  kind: 'weapon' | 'collision' | 'heat'
  impact?: { position: SectorPosition; normal: SectorPosition }
}

export type DamageSide = 'front' | 'right' | 'back' | 'left' | 'above' | 'below'
export interface DamageBearing { angle: number; side: DamageSide }

/** Bearing relative to the current camera, including sources above or below it. */
export function getDamageBearing(position: SectorPosition, forward: SectorPosition, right: SectorPosition, source: SectorPosition): DamageBearing | null {
  const x = source.x - position.x, y = source.y - position.y, z = source.z - position.z
  if (x * x + y * y + z * z < 0.000001) return null
  const ahead = x * forward.x + y * forward.y + z * forward.z
  const lateral = x * right.x + y * right.y + z * right.z
  const up = { x: forward.y * right.z - forward.z * right.y, y: forward.z * right.x - forward.x * right.z, z: forward.x * right.y - forward.y * right.x }
  const vertical = x * up.x + y * up.y + z * up.z
  if (Math.abs(vertical) > Math.hypot(ahead, lateral) * 1.2) return { angle: vertical > 0 ? 0 : Math.PI, side: vertical > 0 ? 'above' : 'below' }
  const angle = Math.atan2(lateral, ahead)
  const sides: readonly DamageSide[] = ['front', 'right', 'back', 'left']
  return { angle, side: sides[(Math.round(angle / (Math.PI / 2)) + 4) % 4] }
}
