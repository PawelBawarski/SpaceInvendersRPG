import type { SectorPosition } from './exploration'

export const BASE_RADAR_RANGE = 1600
export type RadarKind = 'hostile' | 'boss' | 'station' | 'merchant'
export interface RadarTarget extends SectorPosition { id: string; kind: RadarKind }
export interface RadarBlip { id: string; kind: RadarKind; x: number; y: number; ahead: boolean }

export function projectRadarContacts(position: SectorPosition, yaw: number, range: number, targets: readonly RadarTarget[]): RadarBlip[] {
  const forwardX = Math.sin(yaw)
  const forwardZ = Math.cos(yaw)
  const contacts: RadarBlip[] = []
  for (const target of targets) {
    const x = target.x - position.x
    const y = target.y - position.y
    const z = target.z - position.z
    if (x * x + y * y + z * z > range * range) continue
    const forward = x * forwardX + z * forwardZ
    const lateral = x * forwardZ - z * forwardX
    contacts.push({ id: target.id, kind: target.kind, x: 50 + lateral / range * 44, y: 50 - forward / range * 44, ahead: forward > 0 })
  }
  return contacts
}
