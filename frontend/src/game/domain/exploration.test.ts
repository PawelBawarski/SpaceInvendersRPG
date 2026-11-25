import { describe, expect, it } from 'vitest'
import {
  calculateDroneDamage,
  distanceBetween,
  distanceToPlanetSurface,
  findPlanetCollision,
  resolveSafeFlightPosition,
  findNearbyPlanet,
  findNearestPlanet,
  findNearestStation,
  ORION_DRONES,
  ORION_PLANETS,
  ORION_SECTOR_BOUNDS,
  ORION_STATIONS,
  ORION_SUN,
  VEIL_PATROL_DRONE,
} from './exploration'

describe('sector exploration', () => {
  it('restores saves inside enlarged planets above the surface without moving safe spawns', () => {
    const planet = ORION_PLANETS[0]
    const saved = { x: planet.x, y: planet.y, z: planet.z - planet.radius / 1.5 - 8 }
    const safe = resolveSafeFlightPosition(saved)
    expect(findPlanetCollision(safe)).toBeNull()
    expect(distanceToPlanetSurface(safe, planet)).toBeCloseTo(8)
    expect(findNearbyPlanet(safe)).toBe(planet)
    expect(findPlanetCollision(resolveSafeFlightPosition(planet))).toBeNull()
    const entry = { x: 0, y: 0, z: 0 }
    expect(resolveSafeFlightPosition(entry)).toBe(entry)
  })
  it('finds the closest scan target only inside the scanning radius', () => {
    const planet = ORION_PLANETS[0]
    const scanPosition = { x: planet.x, y: planet.y, z: planet.z + planet.radius + 8 }
    expect(findNearbyPlanet(scanPosition)).toBe(planet)
    expect(distanceToPlanetSurface(scanPosition, planet)).toBe(8)
    expect(findNearbyPlanet({ x: 0, y: 0, z: 0 })).toBeNull()
    expect(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5)
  })

  it('detects an impact at the planetary surface before the ship reaches the center', () => {
    const planet = ORION_PLANETS[0]
    expect(findPlanetCollision({ x: planet.x, y: planet.y, z: planet.z })).toBe(planet)
    expect(findPlanetCollision({ x: planet.x, y: planet.y, z: planet.z + planet.radius + 3 })).toBeNull()
  })

  it('turns weapon modules into meaningful drone damage', () => {
    expect(calculateDroneDamage({ damagePercent: 0 })).toBe(24)
    expect(calculateDroneDamage({ damagePercent: 25 })).toBe(30)
  })

  it('doubles planetary spacing and sector bounds while retaining large planetary radii', () => {
    expect(ORION_SECTOR_BOUNDS).toEqual({ minX: -560000, maxX: 560000, minY: -350000, maxY: 350000, minZ: 0, maxZ: 3000000 })
    expect(ORION_PLANETS[0]).toMatchObject({ id: 'glass-moon', radius: 1728, x: 0, y: 0 })
    expect(ORION_PLANETS[0].z).toBeCloseTo(27033.6)
    expect(ORION_PLANETS).toHaveLength(60)
    expect(ORION_DRONES).toHaveLength(3000)
    expect(new Set(ORION_DRONES.map(ship => ship.faction)).size).toBe(4)
    expect(new Set(ORION_DRONES.map(ship => ship.archetype)).size).toBe(4)
    expect(ORION_SECTOR_BOUNDS.maxX - ORION_SECTOR_BOUNDS.minX).toBeGreaterThanOrEqual(576 * 3)
    expect(ORION_SECTOR_BOUNDS.maxY - ORION_SECTOR_BOUNDS.minY).toBeGreaterThanOrEqual(336 * 3)
    expect(ORION_SECTOR_BOUNDS.maxZ - ORION_SECTOR_BOUNDS.minZ).toBeGreaterThanOrEqual(1720 * 3)
    expect(ORION_PLANETS.filter(planet => planet.z > 276480)).toHaveLength(41)
    const ids = ORION_PLANETS.map(planet => planet.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining([
      'glass-moon', 'ember-world', 'meridian-wreck', 'veil-archive',
      'hollow-comet', 'quiet-foundry', 'nacre-reef',
    ]))
    expect(ORION_PLANETS.every(planet => planet.radius >= 128)).toBe(true)
    expect(Math.max(...ORION_PLANETS.map(planet => planet.radius))).toBeGreaterThanOrEqual(1500)
    expect(Math.max(...ORION_PLANETS.map(planet => planet.z))).toBeGreaterThan(200000)
    expect(ORION_DRONES.length).toBeGreaterThanOrEqual(70)
    expect(VEIL_PATROL_DRONE.id).toBe('veil-warden')
  })

  it('returns only the nearest hangar independently of the tracked destination', () => {
    expect(findNearestStation({ x: 0, y: 0, z: 0 }).id).toBe(ORION_STATIONS[0].id)
    for (const station of ORION_STATIONS) expect(findNearestStation(station.launchPosition)).toBe(station)
  })

  it('chooses the nearest planetary surface when planets have very different sizes', () => {
    const base = ORION_PLANETS[0]
    const giant = { ...base, id: 'giant', x: 1000, y: 0, z: 0, radius: 992 }
    const small = { ...base, id: 'small', x: 20, y: 0, z: 0, radius: 2 }
    expect(findNearestPlanet({ x: 0, y: 0, z: 0 }, [small, giant])).toBe(giant)
    expect(findNearbyPlanet({ x: 0, y: 0, z: 0 }, [small, giant])).toBe(giant)
  })

  it('puts a reachable distant sun beyond the populated routes and its heat zone outside settlements', () => {
    expect(distanceBetween({ x: 0, y: 0, z: 0 }, ORION_SUN)).toBeGreaterThan(380000)
    expect(ORION_SUN.radius).toBe(192000)
    expect(ORION_SUN.heatRange).toBe(20000)
    expect(ORION_SUN.z + ORION_SUN.radius).toBeLessThan(ORION_SECTOR_BOUNDS.maxZ)
    expect(ORION_SUN.x + ORION_SUN.radius).toBeLessThan(ORION_SECTOR_BOUNDS.maxX)
    for (const planet of ORION_PLANETS) {
      expect(distanceBetween(planet, ORION_SUN), planet.id).toBeGreaterThan(ORION_SUN.radius + ORION_SUN.heatRange + planet.radius)
    }
    for (const site of [...ORION_STATIONS, ...ORION_DRONES]) {
      expect(distanceBetween(site, ORION_SUN), site.id).toBeGreaterThan(ORION_SUN.radius + ORION_SUN.heatRange)
    }
  })

  it('keeps stations and launch positions outside every planetary surface', () => {
    expect(ORION_STATIONS).toHaveLength(3)
    for (const station of ORION_STATIONS) {
      expect(findPlanetCollision(station)).toBeNull()
      expect(findPlanetCollision(station.launchPosition)).toBeNull()
      expect(distanceBetween(station, station.launchPosition)).toBeLessThan(station.dockingRange)
      expect(distanceBetween(station, station.launchPosition)).toBeGreaterThan(station.radius)
    }
  })

  it('keeps every planetary surface reachable inside the flight boundaries', () => {
    for (const planet of ORION_PLANETS) {
      expect(planet.x - planet.radius, planet.id).toBeGreaterThanOrEqual(ORION_SECTOR_BOUNDS.minX)
      expect(planet.x + planet.radius, planet.id).toBeLessThanOrEqual(ORION_SECTOR_BOUNDS.maxX)
      expect(planet.y - planet.radius, planet.id).toBeGreaterThanOrEqual(ORION_SECTOR_BOUNDS.minY)
      expect(planet.y + planet.radius, planet.id).toBeLessThanOrEqual(ORION_SECTOR_BOUNDS.maxY)
      expect(planet.z - planet.radius, planet.id).toBeGreaterThanOrEqual(ORION_SECTOR_BOUNDS.minZ)
      expect(planet.z + planet.radius, planet.id).toBeLessThanOrEqual(ORION_SECTOR_BOUNDS.maxZ)
    }
  })

  it('leaves safe flight space between planets and around each patrol spawn', () => {
    for (let index = 0; index < ORION_PLANETS.length; index += 1) {
      const planet = ORION_PLANETS[index]
      for (const neighbor of ORION_PLANETS.slice(index + 1)) {
        expect(distanceBetween(planet, neighbor), `${planet.id} / ${neighbor.id}`)
          .toBeGreaterThan(planet.radius + neighbor.radius + 4.8)
      }
    }
    expect(findPlanetCollision({ x: 0, y: 0, z: 0 })).toBeNull()
    for (const drone of [...ORION_DRONES, VEIL_PATROL_DRONE]) {
      expect(drone.x, drone.id).toBeGreaterThanOrEqual(ORION_SECTOR_BOUNDS.minX)
      expect(drone.x, drone.id).toBeLessThanOrEqual(ORION_SECTOR_BOUNDS.maxX)
      expect(drone.y, drone.id).toBeGreaterThanOrEqual(ORION_SECTOR_BOUNDS.minY)
      expect(drone.y, drone.id).toBeLessThanOrEqual(ORION_SECTOR_BOUNDS.maxY)
      expect(drone.z, drone.id).toBeGreaterThanOrEqual(ORION_SECTOR_BOUNDS.minZ)
      expect(drone.z, drone.id).toBeLessThanOrEqual(ORION_SECTOR_BOUNDS.maxZ)
      expect(findPlanetCollision(drone), drone.id).toBeNull()
    }
  })
})
