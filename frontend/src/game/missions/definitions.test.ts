import { describe, expect, it } from 'vitest'
import { buildMissionHostiles, getMission, getNextCampaignMission, MISSIONS } from './definitions'
import { distanceBetween, findPlanetCollision, ORION_PLANETS, ORION_SECTOR_BOUNDS } from '../domain/exploration'

describe('campaign mission definitions', () => {
  it('keeps orbital encounters and survey navigation outside the enlarged planet surfaces', () => {
    for (const mission of MISSIONS.filter(item => item.objective === 'orbital-sweep' || item.objective === 'survey-planet')) {
      const planet = ORION_PLANETS.find(site => site.id === mission.sectorTarget?.id)!
      expect(planet, mission.id).toBeDefined()
      expect(distanceBetween(mission.worldPosition, planet)).toBeGreaterThan(planet.radius)
      if (mission.objective === 'orbital-sweep') {
        for (const hostile of buildMissionHostiles(mission)) {
          expect(distanceBetween(hostile, planet)).toBeGreaterThanOrEqual(planet.radius + 100)
        }
      }
    }
  })
  it('distributes bosses and orbital encounters with distinct damage and persistent escorts', () => {
    const bosses = MISSIONS.filter(mission => mission.bossProfile)
    expect(bosses.length).toBeGreaterThanOrEqual(5)
    expect(new Set(bosses.map(mission => mission.bossProfile!.damage)).size).toBe(bosses.length)
    for (const mission of MISSIONS) {
      expect(mission.worldPosition.z).toBeLessThan(ORION_SECTOR_BOUNDS.maxZ)
      expect(findPlanetCollision(mission.worldPosition), mission.id).toBeNull()
      const hostiles = buildMissionHostiles(mission)
      expect(hostiles.every(ship => ship.missionId === mission.id && !findPlanetCollision(ship))).toBe(true)
      if (mission.bossProfile) expect(hostiles).toHaveLength(mission.bossProfile.supportCount)
      if (mission.objective === 'orbital-sweep') expect(hostiles).toHaveLength(mission.requiredKills!)
      expect(buildMissionHostiles(mission).map(ship => ship.id)).toEqual(hostiles.map(ship => ship.id))
    }
  })
  it('keeps mission identifiers unique', () => {
    const ids = MISSIONS.map((mission) => mission.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('defines an extraction objective with a finite, explicit reward', () => {
    const mission = getMission('silent-signal')
    expect(mission.objective).toBe('recover-fragments')
    expect(mission.reward.fragments).toBe(3)
    expect(mission.reward.credits).toBeGreaterThan(0)
  })

  it('defines the signal core as a timed vulnerability objective', () => {
    const mission = getMission('signal-source')
    expect(mission.objective).toBe('disable-signal')
    expect(mission.reward.credits).toBeGreaterThan(0)
  })

  it('advances through the story in order and does not expose completed missions as choices', () => {
    expect(getNextCampaignMission({
      wardenDefeats: 0,
      silentSignalRuns: 0,
      signalSourceRuns: 0,
      veilSurveyRuns: 0,
      patrolHuntRuns: 0,
      nullChoirRuns: 0,
    })).toBe('warden')
    expect(getNextCampaignMission({
      wardenDefeats: 1,
      silentSignalRuns: 0,
      signalSourceRuns: 0,
      veilSurveyRuns: 0,
      patrolHuntRuns: 0,
      nullChoirRuns: 0,
    })).toBe('silent-signal')
    expect(getNextCampaignMission({
      wardenDefeats: 1,
      silentSignalRuns: 1,
      signalSourceRuns: 0,
      veilSurveyRuns: 0,
      patrolHuntRuns: 0,
      nullChoirRuns: 0,
    })).toBe('signal-source')
    expect(getNextCampaignMission({
      wardenDefeats: 1,
      silentSignalRuns: 1,
      signalSourceRuns: 1,
      veilSurveyRuns: 0,
      patrolHuntRuns: 0,
      nullChoirRuns: 0,
    })).toBe('veil-survey')
    expect(getNextCampaignMission({
      wardenDefeats: 1,
      silentSignalRuns: 1,
      signalSourceRuns: 1,
      veilSurveyRuns: 1,
      patrolHuntRuns: 0,
      nullChoirRuns: 0,
    })).toBe('patrol-hunt')
    expect(getNextCampaignMission({
      wardenDefeats: 1,
      silentSignalRuns: 1,
      signalSourceRuns: 1,
      veilSurveyRuns: 1,
      patrolHuntRuns: 1,
      nullChoirRuns: 0,
    })).toBe('null-choir')
    expect(getNextCampaignMission({
      wardenDefeats: 1,
      silentSignalRuns: 1,
      signalSourceRuns: 1,
      veilSurveyRuns: 1,
      patrolHuntRuns: 1,
      nullChoirRuns: 1,
    })).toBe('glass-orbit')
  })
})
