import { activateGalaxy, getGalaxyWorld, ORION_PLANETS, ORION_SECTOR_ID } from '../domain/exploration'
import { orbitEntryPosition, PLANET_CONTACT_RANGE } from '../domain/planetOrbit'
import { refreshMissionLocations } from '../missions/definitions'
import { createEmptyMissionProgress, type MissionProgress } from './missionProgress'

let activeOrionSeed = 0

/** A world is activated only before mounting flight, never from its render loop. */
export function prepareWorld(progress: MissionProgress): MissionProgress {
  if (activeOrionSeed !== progress.worldSeed) {
    activateGalaxy(progress.worldSeed)
    refreshMissionLocations()
    activeOrionSeed = progress.worldSeed
  }
  if (progress.orbitPlanetId) {
    const planet = getGalaxyWorld(progress.sectorId, progress.worldSeed).planets.find(site => site.id === progress.orbitPlanetId)
    if (!planet?.orbitalFaction) return { ...progress, orbitPlanetId: null }
    const distance = Math.hypot(progress.sectorX - planet.x, progress.sectorY - planet.y, progress.sectorDistance - planet.z)
    if (distance <= planet.radius || distance > planet.radius + PLANET_CONTACT_RANGE) {
      const { x, y, z } = orbitEntryPosition(planet)
      return { ...progress, sectorX: x, sectorY: y, sectorDistance: z }
    }
  }
  return progress
}

export function createNewCampaign(seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1): MissionProgress {
  const progress = prepareWorld({ ...createEmptyMissionProgress(), worldSeed: seed >>> 0 || 1, prologueComplete: false })
  const home = ORION_PLANETS[0]
  return { ...progress, sectorId: ORION_SECTOR_ID, sectorX: home.x, sectorY: home.y, sectorDistance: home.z - home.radius - 2500 }
}
