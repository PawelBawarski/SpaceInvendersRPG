export const WALK_STRIDE = 1.6
export const RUN_STRIDE = 2.2

export interface FootstepState {
  distance: number
}

export function createFootstepState(): FootstepState {
  return { distance: 0 }
}

/** Accumulate distance travelled; returns a new state and whether a step should play. */
export function advanceFootsteps(state: FootstepState, moved: number, run: boolean): { state: FootstepState; stepped: boolean } {
  const stride = run ? RUN_STRIDE : WALK_STRIDE
  const distance = state.distance + Math.max(0, moved)
  if (distance >= stride) return { state: { distance: distance - stride }, stepped: true }
  return { state: { distance }, stepped: false }
}