export type CombatState =
  | 'idle'
  | 'attackStart'
  | 'attackActive'
  | 'attackRecovery'
  | 'dodgeStartup'
  | 'dodgeIframes'
  | 'dodgeRecovery'

export interface DodgeState {
  state: CombatState
  elapsed: number
}

export const DODGE_TIMING = {
  startup: 0.08,
  iframes: 0.18,
  recovery: 0.22,
  cooldown: 0.65,
  perfectWindow: 0.12,
} as const

export function getDodgePhase(elapsed: number): DodgeState {
  if (elapsed < DODGE_TIMING.startup) {
    return { state: 'dodgeStartup', elapsed }
  }
  if (elapsed < DODGE_TIMING.startup + DODGE_TIMING.iframes) {
    return { state: 'dodgeIframes', elapsed }
  }
  if (elapsed < DODGE_TIMING.startup + DODGE_TIMING.iframes + DODGE_TIMING.recovery) {
    return { state: 'dodgeRecovery', elapsed }
  }
  return { state: 'idle', elapsed }
}

export function isHitDodged(dodgeElapsed: number, activeDodge: boolean): boolean {
  if (!activeDodge) return false
  const phase = getDodgePhase(dodgeElapsed).state
  return phase === 'dodgeIframes'
}

export function isPerfectDodge(dodgeElapsed: number, activeDodge: boolean): boolean {
  if (!activeDodge) return false
  const phase = getDodgePhase(dodgeElapsed).state
  return (
    phase === 'dodgeIframes' &&
    dodgeElapsed >= DODGE_TIMING.startup &&
    dodgeElapsed <= DODGE_TIMING.startup + DODGE_TIMING.perfectWindow
  )
}

export interface DamageResult {
  amount: number
  dodged: boolean
  perfect: boolean
  shieldDamage: number
  hullDamage: number
}

export function resolveBossDamage(params: {
  health: number
  shield: number
  amount: number
}): { health: number; shield: number } {
  const shieldDamage = Math.min(params.shield, params.amount)
  return {
    health: Math.max(0, params.health - (params.amount - shieldDamage)),
    shield: params.shield - shieldDamage,
  }
}

export function resolveDamage(params: {
  amount: number
  shield: number
  dodgeElapsed: number
  activeDodge: boolean
}): DamageResult {
  const dodged = isHitDodged(params.dodgeElapsed, params.activeDodge)
  if (dodged) {
    return {
      amount: 0,
      dodged: true,
      perfect: isPerfectDodge(params.dodgeElapsed, params.activeDodge),
      shieldDamage: 0,
      hullDamage: 0,
    }
  }

  const shieldDamage = Math.min(params.shield, params.amount)
  const hullDamage = Math.max(0, params.amount - shieldDamage)
  return { amount: params.amount, dodged: false, perfect: false, shieldDamage, hullDamage }
}
