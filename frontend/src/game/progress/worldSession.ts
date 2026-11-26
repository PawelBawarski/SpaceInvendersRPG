import { activateGalaxy, ORION_PLANETS, ORION_SECTOR_ID, type GalaxyWorld, type StationSite } from '../domain/exploration'
import { FIRST_FLIGHT_VITALS, WRECK_RECOVERY_VITALS } from '../domain/shipTelemetry'
import { orbitEntryPosition, PLANET_CONTACT_RANGE } from '../domain/planetOrbit'
import { refreshMissionLocations } from '../missions/definitions'
import { createEmptyMissionProgress, ORION_LAYOUT_VERSION, updateSectorPosition, type MissionProgress } from './missionProgress'
import { getRecoveryFlightPosition } from '../simulation/ShipRecovery'

let activeOrionSeed = 0

/** A world is activated only before mounting flight, never from its render loop. */
export function prepareWorld(progress: MissionProgress): MissionProgress {
  if (activeOrionSeed !== progress.worldSeed) {
    activateGalaxy(progress.worldSeed)
    refreshMissionLocations()
    activeOrionSeed = progress.worldSeed
  }
  if (progress.orionLayoutVersion >= ORION_LAYOUT_VERSION) return progress
  const migrated = { ...progress, orionLayoutVersion: ORION_LAYOUT_VERSION }
  if (progress.sectorId === ORION_SECTOR_ID && progress.orbitPlanetId) {
    const planet = ORION_PLANETS.find(site => site.id === progress.orbitPlanetId)
    if (!planet?.orbitalFaction) return { ...migrated, orbitPlanetId: null }
    const distance = Math.hypot(progress.sectorX - planet.x, progress.sectorY - planet.y, progress.sectorDistance - planet.z)
    if (distance <= planet.radius || distance > planet.radius + PLANET_CONTACT_RANGE) {
      const { x, y, z } = orbitEntryPosition(planet)
      return { ...migrated, sectorX: x, sectorY: y, sectorDistance: z }
    }
  }
  return migrated
}

export function createNewCampaign(seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1): MissionProgress {
  const progress = prepareWorld({ ...createEmptyMissionProgress(), worldSeed: seed >>> 0 || 1, prologueComplete: false,
    initialRepairRequired: true, shipVitals: { ...FIRST_FLIGHT_VITALS } })
  const launch = getRecoveryFlightPosition(ORION_PLANETS[0])
  return { ...progress, sectorId: ORION_SECTOR_ID, sectorX: launch.x, sectorY: launch.y, sectorDistance: launch.z }
}

export function getInitialRepairStation(world: Pick<GalaxyWorld, 'planets' | 'stations'>) {
  const home = world.planets[0]
  return world.stations.find(station => station.planetId === home.id) ?? world.stations[0]
}

export function recoverShipAtHangar(progress: MissionProgress, station: StationSite): MissionProgress {
  const { x, y, z } = station.launchPosition
  return {
    ...updateSectorPosition(progress, progress.sectorId, z, x, y),
    orbitPlanetId: null,
    recoveryStationId: station.id,
    shipVitals: { ...WRECK_RECOVERY_VITALS },
  }
}
