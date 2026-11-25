import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTROL_BINDINGS } from '../input/InputController'
import { advanceFlightMotion, approachFlightSpeed, FLIGHT_SPEEDS, getFlightTargetSpeed, integrateShipRoll, readFlightUpdate } from './FlightSimulation'

describe('flight simulation input', () => {
  it('combines mouse steering and firing with existing keyboard controls', () => {
    const update = readFlightUpdate(
      (command) => command === 'boost' || command === 'yawLeft',
      { yaw: 0.4, pitch: -0.6, fire: true },
    )

    expect(update).toMatchObject({
      yaw: -0.6,
      pitch: -0.6,
      thrust: 0.5,
      fireRequested: true,
    })
    expect(DEFAULT_CONTROL_BINDINGS.fire).toBe('KeyF')
    expect(DEFAULT_CONTROL_BINDINGS.fullBoost).toBe('Space')
  })

  it('prioritizes full thrust over Shift and leaves firing to its own input', () => {
    const both = readFlightUpdate(command => command === 'boost' || command === 'fullBoost' || command === 'brake')
    expect(both.thrust).toBe(1)
    expect(both.fireRequested).toBe(false)
    expect(readFlightUpdate(command => command === 'boost').thrust).toBe(0.5)
    expect(readFlightUpdate(command => command === 'brake').thrust).toBe(-1)
    expect(readFlightUpdate(() => false).thrust).toBe(0)
  })
})

describe('flight movement', () => {
  it('holds a constant full-thrust speed and preserves the exact half-thrust ratio with equipment', () => {
    const bonuses = { enginePercent: 20, speedPercent: 10 }
    const full = getFlightTargetSpeed(1, bonuses)
    expect(full).toBeCloseTo(FLIGHT_SPEEDS.cruise * 1.2 * 1.1)
    expect(getFlightTargetSpeed(0.5, bonuses)).toBe(full / 2)
    expect(getFlightTargetSpeed(0, bonuses)).toBe(0)
    expect(getFlightTargetSpeed(-1, bonuses)).toBeCloseTo(-FLIGHT_SPEEDS.reverse * 1.2 * 1.1)
    let speed = 0
    for (let frame = 0; frame < 1200; frame++) {
      const motion = advanceFlightMotion(speed, full, 1 / 60)
      expect(motion.speed).toBeGreaterThanOrEqual(speed)
      expect(motion.speed).toBeLessThanOrEqual(full)
      speed = motion.speed
      if (frame > 180) expect(speed).toBeGreaterThan(full * 0.999)
    }
  })

  it('travels the same distance through acceleration, coasting and reversing at different frame rates', () => {
    const simulate = (framesPerSecond: number) => {
      let speed = 0
      let distance = 0
      for (const target of [FLIGHT_SPEEDS.cruise, FLIGHT_SPEEDS.cruise / 2, 0, -FLIGHT_SPEEDS.reverse]) {
        for (let frame = 0; frame < framesPerSecond * 3; frame++) {
          const motion = advanceFlightMotion(speed, target, 1 / framesPerSecond)
          speed = motion.speed
          distance += motion.distance
        }
      }
      return { speed, distance }
    }
    const reference = simulate(144)
    for (const rate of [10, 30, 60]) {
      const actual = simulate(rate)
      expect(actual.speed).toBeCloseTo(reference.speed, 8)
      expect(actual.distance).toBeCloseTo(reference.distance, 8)
    }
  })

  it('allows full barrel rolls in both directions and holds orientation after release', () => {
    let leftRoll = 0
    let rightRoll = 0
    for (let frame = 0; frame < 120; frame += 1) {
      leftRoll = integrateShipRoll(leftRoll, -1, 1 / 30)
      rightRoll = integrateShipRoll(rightRoll, 1, 1 / 30)
    }

    expect(leftRoll).toBeGreaterThan(Math.PI * 2)
    expect(rightRoll).toBeLessThan(-Math.PI * 2)
    expect(integrateShipRoll(leftRoll, 0, 2)).toBe(leftRoll)
    expect(integrateShipRoll(rightRoll, 0, 2)).toBe(rightRoll)
  })

  it('accelerates and brakes smoothly without overshooting the requested speed', () => {
    const accelerating = approachFlightSpeed(0, 39, 1 / 60)
    expect(accelerating).toBeGreaterThan(0)
    expect(accelerating).toBeLessThan(39)

    const reversing = approachFlightSpeed(39, -24, 0.5)
    expect(reversing).toBeLessThan(0)
    expect(reversing).toBeGreaterThan(-24)
    expect(approachFlightSpeed(39, -24, 30)).toBeCloseTo(-24)
  })
})
