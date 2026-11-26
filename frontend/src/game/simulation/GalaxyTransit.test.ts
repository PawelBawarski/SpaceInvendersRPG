import { expect, it } from 'vitest'
import { clampGalaxyPosition, isGalaxyBoundary, returnFromGalaxyBoundary } from './GalaxyTransit'

const bounds = { minX: -1000, maxX: 1000, minY: -600, maxY: 600, minZ: 0, maxZ: 4000 } as const

it('returns a cancelled jump from every reached galaxy boundary', () => {
  const faces = [
    { x: bounds.minX, y: 10, z: 250 }, { x: bounds.maxX, y: 10, z: 250 },
    { x: 20, y: bounds.minY, z: 250 }, { x: 20, y: bounds.maxY, z: 250 },
    { x: 20, y: 10, z: bounds.minZ }, { x: 20, y: 10, z: bounds.maxZ },
  ]
  for (const position of faces) {
    const returned = returnFromGalaxyBoundary(position, bounds, 120)
    expect(isGalaxyBoundary(returned, bounds)).toBe(false)
    expect(returned).toEqual(clampGalaxyPosition(returned, bounds))
  }
})

it('keeps an ordinary position unchanged when there is no active boundary crossing', () => {
  expect(returnFromGalaxyBoundary({ x: 120, y: -42, z: 1800 }, bounds)).toEqual({ x: 120, y: -42, z: 1800 })
})

