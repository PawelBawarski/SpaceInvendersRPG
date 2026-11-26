import type { SectorPosition } from './exploration'

export const BASE_RADAR_RANGE = 1600
export type RadarKind = 'hostile' | 'boss' | 'station' | 'merchant'
export interface RadarTarget extends SectorPosition { id: string; kind: RadarKind }
export interface RadarBlip { id: string; kind: RadarKind; x: number; y: number; ahead: boolean }

export function projectRadarContacts(position: SectorPosition, yaw: number, pitch: number, range: number, targets: readonly RadarTarget[]): RadarBlip[] {
  const horizontalX = Math.sin(yaw)
  const horizontalZ = Math.cos(yaw)
  const horizontalWeight = Math.cos(pitch)
  const forwardY = -Math.sin(pitch)
  const contacts: RadarBlip[] = []
  for (const target of targets) {
    const x = target.x - position.x
    const y = target.y - position.y
    const z = target.z - position.z
    if (x * x + y * y + z * z > range * range) continue
    const forward = (x * horizontalX + z * horizontalZ) * horizontalWeight + y * forwardY
    const lateral = x * horizontalZ - z * horizontalX
    contacts.push({ id: target.id, kind: target.kind, x: 50 + lateral / range * 44, y: 50 - forward / range * 44, ahead: forward > 0 })
  }
  return contacts
}
