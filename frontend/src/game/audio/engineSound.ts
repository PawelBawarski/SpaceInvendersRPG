export interface EngineSoundProfile {
  mode: 'silent' | 'cruise' | 'acceleration'
  gain: number
  frequency: number
  cutoff: number
}

/** Quiet motor harmonics distinguish coasting from powered acceleration. */
export function getEngineSoundProfile(speedRatio: number, thrust: number): EngineSoundProfile {
  const speed = Number.isFinite(speedRatio) ? Math.max(0, Math.min(1, Math.abs(speedRatio))) : 0
  const power = Number.isFinite(thrust) ? Math.min(1, Math.abs(thrust)) : 0
  if (speed < 0.002 && power === 0) return { mode: 'silent', gain: 0, frequency: 45, cutoff: 200 }
  if (power > 0) return { mode: 'acceleration', gain: 0.007 + speed * 0.007 + power * 0.008, frequency: 70 + speed * 45 + power * 45, cutoff: 330 + power * 360 }
  return { mode: 'cruise', gain: 0.006 + speed * 0.006, frequency: 45 + speed * 45, cutoff: 200 + speed * 120 }
}
