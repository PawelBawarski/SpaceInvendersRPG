import { describe, expect, it } from 'vitest'
import { getDamageBearing } from './damageFeedback'

const position = { x: 0, y: 0, z: 0 }
const forward = { x: 0, y: 0, z: 1 }
const right = { x: 1, y: 0, z: 0 }

describe('incoming damage bearing', () => {
  it('points towards attackers in all four directions relative to the camera', () => {
    expect(getDamageBearing(position, forward, right, { x: 0, y: 0, z: 100 })).toEqual({ angle: 0, side: 'front' })
    expect(getDamageBearing(position, forward, right, { x: 100, y: 0, z: 0 })).toEqual({ angle: Math.PI / 2, side: 'right' })
    expect(getDamageBearing(position, forward, right, { x: 0, y: 0, z: -100 })).toEqual({ angle: Math.PI, side: 'back' })
    expect(getDamageBearing(position, forward, right, { x: -100, y: 0, z: 0 })).toEqual({ angle: -Math.PI / 2, side: 'left' })
  })

  it('follows camera rotation and handles vertical sources', () => {
    expect(getDamageBearing(position, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 100 })?.side).toBe('left')
    expect(getDamageBearing(position, forward, right, { x: 0, y: 100, z: 0 })?.side).toBe('above')
    expect(getDamageBearing(position, forward, right, { x: 0, y: -100, z: 0 })?.side).toBe('below')
    expect(getDamageBearing(position, forward, right, position)).toBeNull()
  })
})
