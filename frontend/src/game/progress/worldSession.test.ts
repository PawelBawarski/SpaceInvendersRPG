import { expect, it } from 'vitest'
import { getGalaxyWorld, ORION_PLANETS } from '../domain/exploration'
import { orbitEntryPosition } from '../domain/planetOrbit'
import { createEmptyMissionProgress, loadMissionProgress, ORION_LAYOUT_VERSION, saveMissionProgress } from './missionProgress'
import { regenerateHangarHull } from './shipMaintenance'
import { prepareWorld, recoverShipAtHangar } from './worldSession'

it('moves legacy Orion orbits to the expanded chart once and preserves later flight positions', () => {
  const planet = ORION_PLANETS[0]
  const legacy = orbitEntryPosition({ ...planet, x: planet.x / 3, y: planet.y / 3, z: planet.z / 3, radius: planet.radius / 2 })
  const migrated = prepareWorld({ ...createEmptyMissionProgress(), orionLayoutVersion: 0, orbitPlanetId: planet.id,
    sectorX: legacy.x, sectorY: legacy.y, sectorDistance: legacy.z })
  const orbit = orbitEntryPosition(planet)
  expect(migrated).toMatchObject({ orionLayoutVersion: ORION_LAYOUT_VERSION, orbitPlanetId: planet.id,
    sectorX: orbit.x, sectorY: orbit.y, sectorDistance: orbit.z })
  const moved = { ...migrated, sectorDistance: orbit.z - 6500 }
  expect(prepareWorld(moved)).toBe(moved)
})

it('saves the recovery pad with ten hull points and resumes free hull repairs', () => {
  const station = getGalaxyWorld('orion-7', 0).stations[0]
  const damaged = { ...createEmptyMissionProgress(), credits: 80, orbitPlanetId: 'glass-moon', initialRepairRequired: true }
  const recovered = recoverShipAtHangar(damaged, station)
  saveMissionProgress(recovered)
  const snapshot = loadMissionProgress()
  expect(snapshot).toMatchObject({ recoveryStationId: station.id, shipVitals: { hull: 10, shield: 0 }, orbitPlanetId: null,
    sectorX: station.launchPosition.x, sectorY: station.launchPosition.y, sectorDistance: station.launchPosition.z,
    credits: 80, initialRepairRequired: true })
  expect(regenerateHangarHull(snapshot, 1)).toMatchObject({ recoveryStationId: station.id, shipVitals: { hull: 20, shield: 0 }, credits: 80 })
  localStorage.clear()
})
