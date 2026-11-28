import { describe, expect, it } from 'vitest'
import { findNearbyPickup, MEGASTATION_PICKUPS, MEGASTATION_PICKUP_RANGE } from './megastationPickups'

describe('megastation pickups', () => {
  it('offers unique salvage around the concourse', () => {
    expect(MEGASTATION_PICKUPS.length).toBeGreaterThanOrEqual(4)
    expect(new Set(MEGASTATION_PICKUPS.map(item => item.id)).size).toBe(MEGASTATION_PICKUPS.length)
  })

  it('finds the closest uncollected pickup within range', () => {
    const target = MEGASTATION_PICKUPS[0]
    expect(findNearbyPickup({ x: target.x, z: target.z }, [])?.id).toBe(target.id)
    expect(findNearbyPickup({ x: target.x, z: target.z }, [target.id])).toBeNull()
    expect(findNearbyPickup({ x: target.x + MEGASTATION_PICKUP_RANGE + 1, z: target.z }, [])).toBeNull()
  })
})