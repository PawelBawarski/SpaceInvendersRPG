import { describe, expect, it } from 'vitest'
import {
  buildAsteroidBelts,
  generateAsteroidField,
  rollAsteroidLoot,
  type AsteroidBeltSite,
} from './asteroidBelt'
import type { PlanetSite } from './exploration'

const planet: PlanetSite = {
  id: 'p1',
  name: { pl: 'A', en: 'A' },
  description: { pl: '', en: '' },
  x: 0,
  y: 0,
  z: 0,
  radius: 1000,
  color: '#fff',
}

describe('asteroid belts', () => {
  it('builds deterministic belts around the first planets', () => {
    const a = buildAsteroidBelts([planet], 12345)
    const b = buildAsteroidBelts([planet], 12345)
    expect(a).toEqual(b)
    expect(a).toHaveLength(1)
    expect(a[0].innerRadius).toBeGreaterThan(planet.radius)
    expect(a[0].outerRadius).toBeGreaterThan(a[0].innerRadius)
    expect(a[0].count).toBeGreaterThan(0)
  })

  it('expands a belt into stable, unique rocks inside the annulus', () => {
    const belt: AsteroidBeltSite = buildAsteroidBelts([planet], 7)[0]
    const field = generateAsteroidField(belt, 99)
    expect(field).toHaveLength(belt.count)
    expect(new Set(field.map(rock => rock.id)).size).toBe(field.length)
    expect(generateAsteroidField(belt, 99)).toEqual(field)
    for (const rock of field) {
      const distance = Math.hypot(rock.x - belt.x, rock.z - belt.z)
      expect(distance).toBeGreaterThanOrEqual(belt.innerRadius - 0.001)
      expect(distance).toBeLessThanOrEqual(belt.outerRadius + 0.001)
      expect(rock.health).toBe(rock.maxHealth)
      expect(rock.radius).toBeGreaterThan(0)
    }
  })

  it('rolls richer radioactive loot for radioactive belts', () => {
    const belt: AsteroidBeltSite = { ...buildAsteroidBelts([planet], 3)[0], resourceProfile: 'radioactive' }
    let seed = 1
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const loot = rollAsteroidLoot(belt, random)
    expect(loot.scrapMetal).toBeGreaterThan(0)
    expect(loot.radioactiveResidue).toBeGreaterThanOrEqual(0)
  })
})