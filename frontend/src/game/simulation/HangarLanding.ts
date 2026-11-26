export const HANGAR_SHIP_SCALE = 1.55
export const HANGAR_PAD_Y = -0.97
export const LANDING_GEAR_GEOMETRY = {
  mountY: -0.12,
  housingLength: 0.32,
  pistonLength: 0.34,
  stroke: 0.33,
  footHeight: 0.085,
  loadedCompression: 0.04,
  maximumCompression: 0.09,
} as const
export const LANDING_GEAR_BOTTOM = LANDING_GEAR_GEOMETRY.mountY - LANDING_GEAR_GEOMETRY.housingLength
  - LANDING_GEAR_GEOMETRY.stroke - LANDING_GEAR_GEOMETRY.footHeight / 2
export const HANGAR_CONTACT_Y = HANGAR_PAD_Y - LANDING_GEAR_BOTTOM * HANGAR_SHIP_SCALE
export const HANGAR_LANDED_Y = HANGAR_CONTACT_Y - LANDING_GEAR_GEOMETRY.loadedCompression * HANGAR_SHIP_SCALE
export const HANGAR_TOUCHDOWN_PROGRESS = 0.82
export type HangarLandingStage = 'approach' | 'deploying' | 'touchdown' | 'landed'

function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

export function sampleHangarLanding(progress: number) {
  const p = Math.max(0, Math.min(1, progress))
  const approach = smooth(p / 0.55)
  const gear = smooth((p - 0.24) / 0.4)
  const descent = smooth((p - 0.68) / (HANGAR_TOUCHDOWN_PROGRESS - 0.68))
  const contactTime = Math.max(0, (p - HANGAR_TOUCHDOWN_PROGRESS) / (1 - HANGAR_TOUCHDOWN_PROGRESS))
  const compression = LANDING_GEAR_GEOMETRY.loadedCompression * smooth(contactTime * 3)
    + 0.075 * Math.sin(contactTime * Math.PI * 2) * Math.exp(-contactTime * 4) * (1 - contactTime)
  const stage: HangarLandingStage = p >= 1 ? 'landed' : p < 0.24 ? 'approach' : p < 0.64 ? 'deploying' : 'touchdown'
  return { y: 1.3 + (HANGAR_CONTACT_Y - 1.3) * descent - compression * HANGAR_SHIP_SCALE, z: -9 + 10.5 * approach, gear, compression, approach, stage }
}

export function sampleSideHangarLanding(progress: number) {
  const pose = sampleHangarLanding(progress)
  return {
    ...pose,
    y: HANGAR_LANDED_Y - pose.compression * HANGAR_SHIP_SCALE,
    z: -9 + 10.5 * pose.approach,
  }
}

export function sampleDepartureCompression(progress: number): number {
  return LANDING_GEAR_GEOMETRY.loadedCompression * (1 - smooth(progress / 0.16))
}

export function sampleDepartureLandingGear(progress: number): number {
  return 1 - smooth((progress - 0.16) / 0.26)
}
