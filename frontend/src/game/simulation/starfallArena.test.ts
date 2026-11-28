import { describe, expect, it } from 'vitest'
import { ARENA, blockadeX, createArena, stepArena } from './starfallArena'

const idle = { moveX: 0, fire: false }
const run = (state: ReturnType<typeof createArena>, input: typeof idle, seconds: number, steps = 60) => {
  for (let index = 0; index < steps; index += 1) state = stepArena(state, input, seconds)
  return state
}

describe('starfall arena', () => {
  it('starts with three blockades and a healthy core', () => {
    const arena = createArena()
    expect(arena.blockadesDestroyed).toBe(0)
    expect(arena.coreHealth).toBe(ARENA.coreHealth)
    expect(arena.won).toBe(false)
  })

  it('moves and clamps the player horizontally', () => {
    const moved = stepArena(createArena(), { moveX: 1, fire: false }, 1)
    expect(moved.playerX).toBeGreaterThan(0)
    const clamped = stepArena({ ...createArena(), playerX: ARENA.halfWidth }, { moveX: 1, fire: false }, 10)
    expect(clamped.playerX).toBeLessThanOrEqual(ARENA.halfWidth)
  })

  it('fires projectiles forward while the trigger is held', () => {
    const arena = run(createArena(), { moveX: 0, fire: true }, 1 / 60, 2)
    expect(arena.projectiles.length).toBeGreaterThan(0)
  })

  it('destroys a blockade when shots connect', () => {
    let arena = { ...createArena(), playerX: blockadeX(0) }
    arena = run(arena, { moveX: 0, fire: true }, 1 / 60, 240)
    expect(arena.blockadesDestroyed).toBeGreaterThanOrEqual(1)
  })

  it('only damages the core once all blockades are down', () => {
    let arena = { ...createArena(), playerX: 0, blockadesDestroyed: 3 }
    arena = run(arena, { moveX: 0, fire: true }, 1 / 60, 600)
    expect(arena.coreHealth).toBeLessThan(ARENA.coreHealth)
  })

  it('spawns waves of enemies over time', () => {
    const arena = run(createArena(), idle, 1 / 60, 430)
    expect(arena.enemies.length).toBeGreaterThan(0)
    expect(arena.lost).toBe(false)
  })

  it('loses when an enemy reaches the player line', () => {
    const arena = stepArena({ ...createArena(), enemies: [{ id: 99, x: 0, z: 4.5 }] }, idle, 1 / 60)
    expect(arena.lost).toBe(true)
  })
})