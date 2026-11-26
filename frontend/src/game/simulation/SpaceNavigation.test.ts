import { expect, it } from 'vitest'
import { steerAroundPlanets } from './SpaceNavigation'

const planet = { x: 0, y: 0, z: 0, radius: 50 }

it('keeps a clear heading unchanged', () => {
  expect(steerAroundPlanets({ x: -200, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, [planet], 20)).toEqual({ x: -1, y: 0, z: 0 })
})

it('bends an approaching hostile away from a planet before contact', () => {
  const heading = steerAroundPlanets({ x: -180, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, [planet], 60, 1)
  expect(Math.abs(heading.y) + Math.abs(heading.z)).toBeGreaterThan(.2)
  expect(heading.x).toBeLessThan(1)
})

it('pushes a ship already inside the avoidance shell outward', () => {
  const heading = steerAroundPlanets({ x: 35, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, [planet], 30, -1)
  expect(heading.x).toBeGreaterThan(0)
})

