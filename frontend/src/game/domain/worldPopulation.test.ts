import { expect, it } from 'vitest'
import type { PlanetSite, StationSite, SunSite } from './exploration'
import { buildDeepSpacePopulation } from './worldPopulation'

const text = { en: 'Test', pl: 'Test' }
const planets: PlanetSite[] = [
  { id: 'alpha', name: text, description: text, color: '#789abc', radius: 6000, x: -90000, y: 4000, z: 140000 },
  { id: 'beta', name: text, description: text, color: '#789abc', radius: 9000, x: 125000, y: -6000, z: 260000 },
]
const stations: StationSite[] = []
const sun: SunSite = { id: 'sun', name: text, radius: 5000, heatRange: 1000, x: 600000, y: 0, z: 600000 }

it('builds hostile patrol wings that stay outside planetary collision shells', () => {
  const ships = buildDeepSpacePopulation(planets, stations, sun, 42)
  const hostileWings = ships.filter(ship => ship.id.startsWith('hostile-wing-'))
  expect(hostileWings.length).toBeGreaterThan(0)
  // Each inhabited orbit should host several dense attack wings.
  expect(hostileWings.length).toBeGreaterThanOrEqual(planets.length * 20)
  expect(hostileWings.every(ship => ship.formation && ship.attackRange! >= 120)).toBe(true)
  for (const ship of hostileWings) {
    expect(planets.some(planet => Math.hypot(ship.x - planet.x, ship.y - planet.y, ship.z - planet.z) <= planet.radius)).toBe(false)
  }
})

it('spawns every hostile wing outside friendly patrol slots with unique ids', () => {
  const ships = buildDeepSpacePopulation(planets, stations, sun, 7)
  const ids = ships.map(ship => ship.id)
  expect(new Set(ids).size).toBe(ids.length)
})

