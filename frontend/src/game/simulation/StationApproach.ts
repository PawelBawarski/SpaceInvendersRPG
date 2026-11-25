import type { SectorPosition } from '../domain/exploration'
import { HANGAR_LANDED_Y } from './HangarLanding'

export interface DockingGeometry extends SectorPosition {
  radius: number
  dockingRange: number
  launchPosition: SectorPosition
}

export const DOCKING_DURATION = 9.2
export const DOCKING_READY_HOLD = 0.82
export const HANGAR_LANDING_DURATION = 4.4
export const DEPARTURE_DURATION = 2.2
export const HANGAR_DEPARTURE_DURATION = 2.1

function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

export function sampleHangarDeparture(progress: number) {
  const lift = smooth(progress / 0.45)
  const forward = smooth((progress - 0.45) / 0.55)
  const turn = smooth((progress - .07) / .38)
  return { y: HANGAR_LANDED_Y + (1.3 - HANGAR_LANDED_Y) * lift, z: 1.5 - 20 * forward, yaw: Math.PI * turn,
    fade: smooth((progress - 0.82) / 0.18), lift, forward, power: .34 * lift + .66 * smooth((progress - .35) / .52) }
}

/** Ship models face local +Z, including during station autopilot. */
export function forwardRotation(direction: SectorPosition): { pitch: number; yaw: number } {
  return { pitch: -Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), yaw: Math.atan2(direction.x, direction.z) }
}

export function sampleStationDeparture(station: DockingGeometry, progress: number): SectorPosition {
  const t = smooth(progress)
  const startZ = station.z - station.radius * 0.3
  return {
    x: station.x,
    y: station.y - station.radius * 0.015 * (1 - smooth(progress * 3)),
    z: startZ + (station.launchPosition.z - 140 - startZ) * t,
  }
}

export function canDockAt(position: SectorPosition, station: DockingGeometry): boolean {
  return Math.hypot(position.x - station.x, position.y - station.y, position.z - station.z) <= station.dockingRange
}

export function advanceDockingProgress(progress: number, seconds: number, hangarReady: boolean): number {
  const next = Math.min(1, progress + Math.max(0, seconds) / DOCKING_DURATION)
  return hangarReady ? next : Math.min(DOCKING_READY_HOLD, next)
}

export function dockingFade(progress: number): number {
  return Math.max(0, Math.min(1, (progress - 0.76) / 0.24))
}

function needsOuterApproach(station: DockingGeometry, start: SectorPosition) {
  return start.z > station.z - station.radius * 0.8
    || Math.abs(start.x - station.x) > station.radius * 0.5
    || Math.abs(start.y - station.y) > station.radius * 0.35
}

export function getStationApproachStage(station: DockingGeometry, start: SectorPosition, progress: number, ready: boolean) {
  if (progress >= DOCKING_READY_HOLD && !ready) return 'waiting'
  const outer = needsOuterApproach(station, start)
  return progress < (outer ? .58 : .38) ? 'approach' : progress < (outer ? .78 : .76) ? 'entry' : 'airlock'
}

export function sampleStationApproach(station: DockingGeometry, start: SectorPosition, progress: number): SectorPosition {
  const p = Math.max(0, Math.min(1, progress))
  const outer = needsOuterApproach(station, start)
  const mouth = { x: station.x, y: station.y, z: station.z - station.radius * 0.68 }
  const inner = { x: station.x, y: station.y - station.radius * 0.015, z: station.z - station.radius * 0.3 }
  const points = outer
    ? [start, {
        x: station.x + (start.x < station.x ? -1 : 1) * station.radius * 1.35,
        y: station.y + station.radius * 1.2,
        z: station.z - station.radius * 1.25,
      }, station.launchPosition, mouth, inner]
    : [start, station.launchPosition, mouth, inner]
  const boundaries = outer ? [0, 0.34, 0.58, 0.78, 1] : [0, 0.38, 0.76, 1]
  const segment = Math.min(points.length - 2, boundaries.findIndex((end, index) => index > 0 && p <= end) - 1)
  const index = Math.max(0, segment)
  const fraction = (p - boundaries[index]) / (boundaries[index + 1] - boundaries[index])
  const t = smooth(fraction)
  const from = points[index]
  const to = points[index + 1]
  let z = from.z + (to.z - from.z) * t
  // Carry the same forward velocity through the mouth of the bay.
  const corridor = points.length - 3
  if (index >= corridor) {
    const mouthAt = boundaries[corridor + 1]
    const speedAtMouth = Math.min((mouth.z - points[corridor].z) / (mouthAt - boundaries[corridor]), (inner.z - mouth.z) / (1 - mouthAt)) * .75
    const slope = Math.max(0, speedAtMouth) * (boundaries[index + 1] - boundaries[index])
    z += index === corridor
      ? slope * fraction * fraction * (fraction - 1)
      : slope * fraction * (1 - fraction) ** 2
  }
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z,
  }
}
