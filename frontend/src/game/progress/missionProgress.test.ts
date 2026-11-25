import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyMissionReward,
  applyBossEquipmentDrop,
  applyDroneLoot,
  applySalvageReward,
  applySignalSourceReward,
  applyPlanetLoot,
  applyVeilSurveyReward,
  applyPatrolHuntReward,
  applyNullChoirReward,
  completeWorldMission,
  recordMissionObjectiveProgress,
  canStoreShipPart,
  craftRandomShipPart,
  createEmptyMissionProgress,
  equipShipPart,
  getBackpackShipParts,
  getPilotExperienceProgress,
  getPilotLevel,
  getShipBonuses,
  hasMissionProgress,
  loadMissionProgress,
  rerollShipPart,
  saveMissionProgress,
  sellShipPart,
  updateSectorPosition,
  unequipShipPart,
} from './missionProgress'
import { createRandomShipPart, getShipPartLevelRequirement, type ShipPart } from './shipParts'
import { SHIP_PART_STORAGE_CAPACITY } from './shipParts'

beforeEach(() => {
  localStorage.clear()
})

describe('mission progress', () => {
  it('awards any world mission once, independent of story order, including after reload', () => {
    const fresh = createEmptyMissionProgress()
    const reward = completeWorldMission(fresh, 'ashen-carrier')
    expect(reward.credits).toBe(520)
    expect(reward.shipParts).toHaveLength(1)
    expect(reward.completedMissions).toContain('ashen-carrier')
    expect(completeWorldMission(reward, 'ashen-carrier')).toBe(reward)
    saveMissionProgress(reward)
    const loaded = loadMissionProgress()
    expect(completeWorldMission(loaded, 'ashen-carrier')).toBe(loaded)
  })

  it('retains partial objectives and prevents legacy missions from paying twice', () => {
    const legacy = { ...createEmptyMissionProgress(), wardenDefeats: 1 }
    expect(completeWorldMission(legacy, 'warden')).toBe(legacy)
    const partial = recordMissionObjectiveProgress(legacy, 'glass-orbit', 3)
    expect(recordMissionObjectiveProgress(partial, 'glass-orbit', 2)).toBe(partial)
    expect(recordMissionObjectiveProgress(partial, 'glass-orbit', NaN)).toBe(partial)
    saveMissionProgress(partial)
    expect(loadMissionProgress().missionObjectiveProgress['glass-orbit']).toBe(3)
  })
  it('starts from an empty save', () => {
    expect(loadMissionProgress()).toEqual({
      worldSeed: 0,
      prologueComplete: true,
      repairMask: 0,
      orbitPlanetId: null,
      droneRespawns: {},
      shipVitals: null,
      completedMissions: [],
      missionObjectiveProgress: {},
      wardenDefeats: 0,
      meridianCore: 0,
      credits: 0,
      lastMission: null,
      shieldLevel: 0,
      silentSignalRuns: 0,
      signalSourceRuns: 0,
      veilSurveyRuns: 0,
      patrolHuntRuns: 0,
      nullChoirRuns: 0,
      relayData: 0,
      experience: 0,
      pilotSkills: [],
      scrapMetal: 0,
      copper: 0,
      radioactiveResidue: 0,
      visitedPlanets: [],
      defeatedDrones: [],
      purchasedMerchantOffers: [],
      sectorId: 'orion-7',
      sectorX: 0,
      sectorY: 0,
      sectorDistance: 0,
      shipParts: [],
      equippedParts: { weapon: null, shield: null, engine: null },
    })
  })

  it('stores and restores mission progress', () => {
    saveMissionProgress({
      ...createEmptyMissionProgress(),
      wardenDefeats: 1,
      meridianCore: 1,
      credits: 240,
      lastMission: 'victory',
      shieldLevel: 0,
      silentSignalRuns: 0,
      signalSourceRuns: 0,
      relayData: 0,
    })
    expect(loadMissionProgress().credits).toBe(240)
    expect(hasMissionProgress()).toBe(true)
  })

  it('does not offer loading when no valid save exists', () => {
    expect(hasMissionProgress()).toBe(false)
    localStorage.setItem('neon-void:mission-progress:v1', 'invalid')
    expect(hasMissionProgress()).toBe(false)
  })

  it('loads saves created before the signal-source chapter', () => {
    localStorage.setItem('neon-void:mission-progress:v1', JSON.stringify({
      wardenDefeats: 1,
      meridianCore: 1,
      credits: 360,
      lastMission: 'victory',
      shieldLevel: 0,
      silentSignalRuns: 1,
      relayData: 3,
    }))
    expect(loadMissionProgress().signalSourceRuns).toBe(0)
  })

  it('awards the boss reward once per completed mission', () => {
    const reward = applyMissionReward({
      ...createEmptyMissionProgress(),
      wardenDefeats: 2,
      meridianCore: 2,
      credits: 480,
      lastMission: null,
      shieldLevel: 0,
      silentSignalRuns: 0,
      signalSourceRuns: 0,
      relayData: 0,
      experience: 90,
      scrapMetal: 0,
      copper: 0,
      radioactiveResidue: 0,
      visitedPlanets: [],
      sectorDistance: 0,
      shipParts: [],
      equippedParts: { weapon: null, shield: null, engine: null },
    })
    expect(reward).toMatchObject({
      wardenDefeats: 3,
      meridianCore: 3,
      credits: 720,
      lastMission: 'victory',
      shieldLevel: 0,
      experience: 135,
      scrapMetal: 3,
      copper: 2,
    })
  })

  it('records recovered relay data and grants its smaller reward', () => {
    const result = applySalvageReward({
      ...createEmptyMissionProgress(),
      wardenDefeats: 1,
      meridianCore: 1,
      credits: 240,
      lastMission: 'victory',
      shieldLevel: 0,
      silentSignalRuns: 0,
      signalSourceRuns: 0,
      relayData: 0,
    })
    expect(result.credits).toBe(360)
    expect(result.silentSignalRuns).toBe(1)
    expect(result.relayData).toBe(3)
    expect(result.experience).toBe(35)
  })

  it('records silencing the signal source and grants its campaign reward', () => {
    const result = applySignalSourceReward({
      ...createEmptyMissionProgress(),
      wardenDefeats: 1,
      meridianCore: 1,
      credits: 360,
      lastMission: 'victory',
      shieldLevel: 0,
      silentSignalRuns: 1,
      signalSourceRuns: 0,
      relayData: 3,
    })
    expect(result.credits).toBe(540)
    expect(result.signalSourceRuns).toBe(1)
    expect(result.experience).toBe(50)
    expect(result).toMatchObject({ scrapMetal: 3, copper: 1 })
  })

  it('rewards the survey, patrol hunt, and final campaign sortie independently', () => {
    const progress = {
      ...createEmptyMissionProgress(),
      wardenDefeats: 1,
      silentSignalRuns: 1,
      signalSourceRuns: 1,
    }
    const surveyed = applyVeilSurveyReward(progress)
    const patrolCleared = applyPatrolHuntReward(surveyed)
    const finale = applyNullChoirReward(patrolCleared)

    expect(surveyed).toMatchObject({ veilSurveyRuns: 1, credits: 150, experience: 37.5 })
    expect(patrolCleared).toMatchObject({ patrolHuntRuns: 1, credits: 375, scrapMetal: 2, copper: 1 })
    expect(finale).toMatchObject({
      nullChoirRuns: 1,
      credits: 695,
      experience: 172.5,
      scrapMetal: 6,
      copper: 3,
      radioactiveResidue: 1,
    })
  })

  it('grants one-time planetary loot and converts experience into levels', () => {
    const loot = {
      credits: 24,
      experience: 45,
      scrapMetal: 2,
      copper: 1,
      radioactiveResidue: 1,
    }
    const firstVisit = applyPlanetLoot(createEmptyMissionProgress(), 'sector-1/planet-1', loot)
    const repeatedVisit = applyPlanetLoot(firstVisit, 'sector-1/planet-1', loot)

    expect(firstVisit.credits).toBe(24)
    expect(firstVisit.scrapMetal).toBe(2)
    expect(repeatedVisit).toBe(firstVisit)
    expect(getPilotLevel(99)).toBe(1)
    expect(getPilotLevel(100)).toBe(2)
    expect(getPilotExperienceProgress(100)).toEqual({
      level: 2,
      experienceIntoLevel: 0,
      experienceToNextLevel: 135,
    })
    expect(getPilotExperienceProgress(235)).toEqual({
      level: 3,
      experienceIntoLevel: 0,
      experienceToNextLevel: 170,
    })
  })

  it('scales handling and speed by level and gates equipment by rarity', () => {
    const parts: ShipPart[] = [
      { id: 'standard', slot: 'weapon', rarity: 'standard', stats: { damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 0 } },
      { id: 'refined', slot: 'shield', rarity: 'refined', stats: { damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 0 } },
      { id: 'prototype', slot: 'engine', rarity: 'prototype', stats: { damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 0 } },
    ]
    const levelOne = { ...createEmptyMissionProgress(), shipParts: parts }
    const levelThree = { ...levelOne, experience: 235 }
    const levelSix = { ...levelOne, experience: 850 }

    expect(getShipPartLevelRequirement('standard')).toBe(1)
    expect(getShipPartLevelRequirement('refined')).toBe(3)
    expect(getShipPartLevelRequirement('prototype')).toBe(6)
    expect(equipShipPart(levelOne, 'standard').equippedParts.weapon).toBe('standard')
    expect(equipShipPart(levelOne, 'refined')).toBe(levelOne)
    expect(equipShipPart(levelThree, 'refined').equippedParts.shield).toBe('refined')
    expect(equipShipPart(levelThree, 'prototype')).toBe(levelThree)
    expect(equipShipPart(levelSix, 'prototype').equippedParts.engine).toBe('prototype')
    expect(getShipBonuses(levelThree)).toMatchObject({ handlingPercent: 4, speedPercent: 2 })
  })

  it('always adds a randomized equipment drop after a boss encounter', () => {
    const fullBackpack = {
      ...createEmptyMissionProgress(),
      shipParts: Array.from({ length: 36 }, (_, index) =>
        createRandomShipPart(`stored-${index}`, () => 0.1, 'weapon')),
    }

    const rewarded = applyBossEquipmentDrop(fullBackpack, 'boss-drop', () => 0.99)

    expect(rewarded.shipParts).toHaveLength(37)
    expect(rewarded.shipParts[36]).toMatchObject({ id: 'boss-drop', rarity: 'prototype' })
  })

  it('does not grant drone cargo more than once', () => {
    const loot = {
      credits: 10,
      experience: 20,
      scrapMetal: 1,
      copper: 0,
      radioactiveResidue: 0,
    }
    const firstKill = applyDroneLoot(createEmptyMissionProgress(), 'drone-a', loot)
    const repeatedKill = applyDroneLoot(firstKill, 'drone-a', loot)

    expect(firstKill.credits).toBe(10)
    expect(firstKill.defeatedDrones).toEqual(['drone-a'])
    expect(repeatedKill).toBe(firstKill)
  })

  it('persists three-dimensional sector coordinates without clamping lateral flight', () => {
    const position = updateSectorPosition(createEmptyMissionProgress(), 'orion-7', 18, -7, 3)

    expect(position).toMatchObject({
      sectorId: 'orion-7',
      sectorX: -7,
      sectorY: 3,
      sectorDistance: 18,
    })
  })

  it('crafts, rerolls, equips, and applies randomized ship-part stats', () => {
    const funded = {
      ...createEmptyMissionProgress(),
      credits: 200,
      scrapMetal: 8,
      copper: 6,
      radioactiveResidue: 2,
    }
    const crafted = craftRandomShipPart(funded, 'part-1', () => 0.1)
    const part = crafted.shipParts[0]
    const equipped = equipShipPart(crafted, part.id)

    expect(crafted.credits).toBe(100)
    expect(crafted.shipParts).toHaveLength(1)
    expect(equipped.equippedParts[part.slot]).toBe(part.id)
    expect(getShipBonuses(equipped)).toEqual(part.stats)
    expect(unequipShipPart(equipped, part.slot).equippedParts[part.slot]).toBeNull()

    const rerolled = rerollShipPart(crafted, part.id, () => 0.8)
    expect(rerolled.shipParts[0].slot).toBe(part.slot)
    expect(rerolled.shipParts[0].id).toBe(part.id)
    expect(rerolled.credits).toBe(55)
  })

  it('keeps equipped parts out of the 6x6 backpack and sells stored parts only', () => {
    const stored = createRandomShipPart('stored', () => 0.1, 'shield')
    const equipped = createRandomShipPart('equipped', () => 0.1, 'weapon')
    const progress = {
      ...createEmptyMissionProgress(),
      credits: 50,
      shipParts: [stored, equipped],
      equippedParts: { weapon: equipped.id, shield: null, engine: null },
    }

    expect(getBackpackShipParts(progress)).toEqual([stored])
    expect(sellShipPart(progress, equipped.id)).toBe(progress)

    const sold = sellShipPart(progress, stored.id)
    expect(sold.shipParts).toEqual([equipped])
    expect(sold.credits).toBe(50 + 30 + Math.round(
      Object.values(stored.stats).reduce((total, value) => total + value, 0) * 2,
    ))
  })

  it('blocks crafting when all 36 backpack slots are occupied', () => {
    const equipped = createRandomShipPart('installed', () => 0.1, 'weapon')
    const fullBackpack = {
      ...createEmptyMissionProgress(),
      credits: 500,
      scrapMetal: 20,
      copper: 20,
      radioactiveResidue: 5,
      shipParts: Array.from(
        { length: SHIP_PART_STORAGE_CAPACITY },
        (_, index) => createRandomShipPart(`stored-${index}`, () => 0.1, 'shield'),
      ).concat(equipped),
      equippedParts: { weapon: equipped.id, shield: null, engine: null },
    }

    expect(canStoreShipPart(fullBackpack)).toBe(false)
    expect(craftRandomShipPart(fullBackpack, 'extra', () => 0.1)).toBe(fullBackpack)
    expect(unequipShipPart(fullBackpack, 'weapon')).toBe(fullBackpack)
  })

  it('rolls bounded random stat lines for ship equipment', () => {
    const part = createRandomShipPart('part-2', () => 0.99, 'engine')

    expect(part.rarity).toBe('prototype')
    expect(part.stats.enginePercent).toBeGreaterThan(0)
    expect(part.stats.enginePercent).toBeLessThanOrEqual(18)
    const scanner = createRandomShipPart('part-3', () => 0.99)
    expect(scanner.slot).toBe('scanner')
    expect(scanner.stats.sensorRangePercent).toBe(79)
  })
})
