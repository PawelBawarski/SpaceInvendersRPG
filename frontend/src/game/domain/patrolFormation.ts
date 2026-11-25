import type { SectorPosition } from './exploration'

export interface PatrolFormation {
  id: string
  slot: number
  anchor: SectorPosition
  radius: number
  phase: number
  speed: number
}

export function samplePatrolRoute(formation: PatrolFormation, seconds: number) {
  const angle = formation.phase + Math.max(0, seconds) * formation.speed / formation.radius
  const sine = Math.sin(angle)
  const cosine = Math.cos(angle)
  return {
    center: { x: formation.anchor.x + cosine * formation.radius, y: formation.anchor.y + Math.sin(seconds * 0.2 + formation.phase) * 6, z: formation.anchor.z + sine * formation.radius },
    forward: { x: -sine, y: 0, z: cosine },
  }
}

/** A V with 60 m wing spacing leaves room for the enlarged hulls. */
export function sampleFormationPosition(center: SectorPosition, forward: SectorPosition, slot: number): SectorPosition {
  const side = slot === 0 ? 0 : slot % 2 === 1 ? -1 : 1
  const row = Math.ceil(slot / 2)
  const lateral = side * row * 60
  const trailing = -row * 52
  return {
    x: center.x + forward.z * lateral + forward.x * trailing,
    y: center.y + row * 5,
    z: center.z - forward.x * lateral + forward.z * trailing,
  }
}
