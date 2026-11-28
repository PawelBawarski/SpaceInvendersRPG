import { describe, expect, it } from 'vitest'
import { advanceFootsteps, createFootstepState, RUN_STRIDE, WALK_STRIDE } from './footstepCadence'

describe('advanceFootsteps', () => {
  it('steps once per stride and carries the remainder', () => {
    let state = createFootstepState()
    const result = advanceFootsteps(state, WALK_STRIDE, false)
    expect(result.stepped).toBe(true)
    expect(result.state.distance).toBe(0)
    state = result.state
    const half = advanceFootsteps(state, WALK_STRIDE / 2, false)
    expect(half.stepped).toBe(false)
    expect(half.state.distance).toBeCloseTo(WALK_STRIDE / 2)
  })

  it('uses a longer stride when running', () => {
    const walk = advanceFootsteps(createFootstepState(), WALK_STRIDE - 0.1, false)
    const run = advanceFootsteps(createFootstepState(), RUN_STRIDE, true)
    expect(walk.stepped).toBe(false)
    expect(run.stepped).toBe(true)
  })

  it('ignores negative movement', () => {
    const result = advanceFootsteps(createFootstepState(), -5, false)
    expect(result.stepped).toBe(false)
    expect(result.state.distance).toBe(0)
  })
})