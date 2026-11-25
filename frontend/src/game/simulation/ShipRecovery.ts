export const RECOVERY_LAUNCH_DURATION = 8

export function sampleRecoveryLaunch(progress: number) {
  const t = Math.max(0, Math.min(1, progress))
  const lift = Math.min(1, t / 0.32)
  const travel = Math.max(0, (t - 0.25) / 0.75)
  return {
    lift: lift * lift * (3 - 2 * lift) * 8,
    distance: travel * travel * 175,
    pitch: -Math.min(0.55, travel * 0.7),
    gear: 1 - Math.min(1, Math.max(0, (t - 0.18) / 0.23)),
    fade: Math.max(0, (t - 0.87) / 0.13),
  }
}
