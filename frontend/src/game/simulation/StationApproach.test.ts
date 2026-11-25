import { describe, expect, it } from 'vitest'
import { HANGAR_LANDED_Y } from './HangarLanding'
import {
  advanceDockingProgress,
  canDockAt,
  DOCKING_DURATION,
  DOCKING_READY_HOLD,
  dockingFade,
  sampleStationApproach,
  sampleStationDeparture,
  sampleHangarDeparture,
  forwardRotation,
} from './StationApproach'

const station = {
  x: 0, y: 0, z: 1800, radius: 180, dockingRange: 440,
  launchPosition: { x: 0, y: 0, z: 1480 },
}

describe('station approach', () => {
  it('takes off, turns toward the door, then leaves the station forward', () => {
    expect(sampleHangarDeparture(0)).toMatchObject({ y: HANGAR_LANDED_Y, z: 1.5, yaw: 0, fade: 0 })
    expect(sampleHangarDeparture(0.45)).toMatchObject({ y: 1.3, z: 1.5, yaw: Math.PI, fade: 0 })
    const exit = sampleHangarDeparture(1)
    expect(exit).toMatchObject({ y: 1.3, z: -18.5, yaw: Math.PI, fade: 1 })
    let previousZ = sampleStationDeparture(station, 0).z
    for (let step = 1; step <= 100; step++) {
      const point = sampleStationDeparture(station, step / 100)
      expect(point.z).toBeLessThan(previousZ)
      expect(point.x).toBe(station.x)
      previousZ = point.z
    }
    expect(previousZ).toBe(station.launchPosition.z - 140)
    expect(forwardRotation({ x: 0, y: 0, z: 1 })).toEqual({ pitch: -0, yaw: 0 })
    expect(forwardRotation({ x: 0, y: 0, z: -1 }).yaw).toBe(Math.PI)
  })
  it('requires a physical approach before docking', () => {
    expect(canDockAt({ x: 0, y: 0, z: 0 }, station)).toBe(false)
    expect(canDockAt({ x: 0, y: 0, z: 1360 }, station)).toBe(true)
    expect(canDockAt({ x: 0, y: 0, z: 1359 }, station)).toBe(false)
    expect(canDockAt(station.launchPosition, station)).toBe(true)
  })

  it('waits inside the airlock until the hangar is ready, then finishes smoothly', () => {
    const held = advanceDockingProgress(0, DOCKING_DURATION * 2, false)
    expect(held).toBe(DOCKING_READY_HOLD)
    expect(advanceDockingProgress(held, 1, false)).toBe(held)
    expect(advanceDockingProgress(held, 0.4, true)).toBeGreaterThan(held)
    expect(advanceDockingProgress(held, DOCKING_DURATION, true)).toBe(1)
    expect(advanceDockingProgress(0.4, 0, true)).toBe(0.4)
    expect(dockingFade(0.7)).toBe(0)
    expect(dockingFade(held)).toBeGreaterThan(0)
    expect(dockingFade(1)).toBe(1)
  })

  it('flies from the current ship position through the front opening', () => {
    const start = { x: 10, y: 2, z: 1410 }
    expect(sampleStationApproach(station, start, 0)).toEqual(start)
    const aligned = sampleStationApproach(station, start, 0.38)
    expect(aligned).toEqual(station.launchPosition)
    const mouth = sampleStationApproach(station, start, 0.76)
    expect(mouth.x).toBe(station.x)
    expect(mouth.y).toBe(station.y)
    const end = sampleStationApproach(station, start, 1)
    expect(end.z).toBeGreaterThan(mouth.z)
    expect(end.z).toBeLessThan(station.z)
  })

  it('routes arrivals from behind the hull around its exterior', () => {
    const start = { x: -250, y: 20, z: 1900 }
    const outside = sampleStationApproach(station, start, 0.34)
    expect(outside.x).toBeLessThan(station.x - station.radius)
    expect(outside.y).toBeGreaterThan(station.y + station.radius)
    expect(outside.z).toBeLessThan(station.z - station.radius)
    expect(sampleStationApproach(station, start, 0.58)).toEqual(station.launchPosition)
    for (const boundary of [0.34, 0.58, 0.78]) {
      const before = sampleStationApproach(station, start, boundary - 0.00001)
      const after = sampleStationApproach(station, start, boundary + 0.00001)
      expect(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeLessThan(0.01)
    }
  })
})
