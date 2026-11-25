import { describe, expect, it } from 'vitest'
import { SpatialIndex } from './SpatialIndex'

describe('moving fleet spatial index', () => {
  it('queries across positive and negative cell boundaries, follows moves and removes destroyed objects', () => {
    const index = new SpatialIndex<{ x: number; y: number; z: number }>(100, item => item)
    const a = { x: -1, y: 0, z: 0 }
    const b = { x: 101, y: 0, z: 0 }
    const far = { x: 50000, y: 0, z: 0 }
    for (const item of [a, b, far]) index.update(item)
    expect(index.query({ x: 50, y: 0, z: 0 }, 52)).toEqual(expect.arrayContaining([a, b]))
    expect(index.query({ x: 50, y: 0, z: 0 }, 52)).toHaveLength(2)
    a.x = 10000
    index.update(a)
    expect(index.query({ x: 0, y: 0, z: 0 }, 150)).toEqual([b])
    expect(index.query(a, 1)).toEqual([a])
    index.remove(a)
    expect(index.query(a, 1)).toHaveLength(0)
    index.update(b)
    expect(index.query(b, 1)).toEqual([b])
  })
})
