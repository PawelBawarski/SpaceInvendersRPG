import {
  createRandomShipPart,
  getEquippedPartBonuses,
  getShipPartLevelRequirement,
  getShipPartSellValue,
  parseShipParts,
  SHIP_PART_STORAGE_CAPACITY,
  SHIP_PART_SLOTS,
  type EquippedShipParts,
  type ShipPart,
  type ShipPartSlot,
} from './shipParts'
import { getGalaxy, ORION_SECTOR_ID, type GalaxyId } from '../domain/galaxyChart'
import { getMission, isCampaignComplete, isMissionComplete, MISSIONS, type CampaignEndingId, type MissionId } from '../missions/definitions'
import { DAMAGE_TYPES, DEFAULT_SHIP_RESISTANCES, getDamageResistance, MAX_DAMAGE_RESISTANCE, type DamageType, type ResistanceProfile } from '../domain/damageTypes'
import { FIRST_FLIGHT_VITALS, type ShipVitals } from '../domain/shipTelemetry'
import { RECOVERY_COMPLETE_MASK } from '../simulation/ShipRecovery'
import { canLearnPilotSkill, PILOT_SKILLS, readPilotSkills, type PilotSkillId } from './pilotSkills'

export const ORION_LAYOUT_VERSION = 2

export interface MissionProgress {
  worldSeed: number
  orionLayoutVersion: number
  prologueComplete: boolean
  initialRepairRequired: boolean
  repairMask: number
  orbitPlanetId: string | null
  recoveryStationId: string | null
  droneRespawns: Record<string, number>
  shipVitals: ShipVitals | null
  completedMissions: MissionId[]
  campaignEnding: CampaignEndingId | null
  missionObjectiveProgress: Partial<Record<MissionId, number>>
  wardenDefeats: number
  meridianCore: number
  credits: number
  lastMission: 'victory' | 'defeat' | null
  shieldLevel: number
  silentSignalRuns: number
  signalSourceRuns: number
  veilSurveyRuns: number
  patrolHuntRuns: number
  nullChoirRuns: number
  relayData: number
  experience: number
  pilotSkills: PilotSkillId[]
  scrapMetal: number
  copper: number
  radioactiveResidue: number
  visitedPlanets: string[]
  defeatedDrones: string[]
  purchasedMerchantOffers: string[]
  sectorId: GalaxyId
  sectorX: number
  sectorY: number
  sectorDistance: number
  shipParts: ShipPart[]
  equippedParts: EquippedShipParts
}

export interface SectorLoot {
  credits: number
  experience: number
  scrapMetal: number
  copper: number
  radioactiveResidue: number
}

export interface PilotExperienceProgress {
  level: number
  experienceIntoLevel: number
  experienceToNextLevel: number
}

export const SHIP_PART_CRAFTING_COST = {
  credits: 100,
  scrapMetal: 4,
  copper: 3,
  radioactiveResidue: 1,
} as const

export const SHIP_PART_REROLL_COST = {
  credits: 45,
  scrapMetal: 2,
  copper: 1,
  radioactiveResidue: 1,
} as const

const STORAGE_KEY = 'neon-void:mission-progress:v1'

export function createEmptyMissionProgress(): MissionProgress {
  return {
    worldSeed: 0, orionLayoutVersion: ORION_LAYOUT_VERSION, prologueComplete: true, initialRepairRequired: false,
    repairMask: 0, orbitPlanetId: null, recoveryStationId: null, droneRespawns: {},
    shipVitals: null,
    completedMissions: [],
    campaignEnding: null,
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
    sectorId: ORION_SECTOR_ID,
    sectorX: 0,
    sectorY: 0,
    sectorDistance: 0,
    shipParts: [],
    equippedParts: { weapon: null, shield: null, engine: null },
  }
}

export function hasMissionProgress(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
  } catch {
    return false
  }
}

export function loadMissionProgress(): MissionProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyMissionProgress()
    const parsed = JSON.parse(raw) as Partial<MissionProgress>
    const shipParts = parseShipParts(parsed.shipParts)
    const equipped = typeof parsed.equippedParts === 'object' && parsed.equippedParts !== null
      ? parsed.equippedParts as Partial<Record<ShipPartSlot, unknown>>
      : {}
    const findEquippedPart = (slot: ShipPartSlot): string | null => {
      const id = equipped[slot]
      return typeof id === 'string' && shipParts.some((part) => part.id === id && part.slot === slot)
        ? id
        : null
    }

    const prologueComplete = parsed.prologueComplete !== false
    const initialRepairRequired = !prologueComplete || parsed.initialRepairRequired === true
    const savedVitals = parsed.shipVitals && typeof parsed.shipVitals === 'object'
      && typeof parsed.shipVitals.hull === 'number' && Number.isFinite(parsed.shipVitals.hull)
      && typeof parsed.shipVitals.shield === 'number' && Number.isFinite(parsed.shipVitals.shield)
      ? { hull: Math.max(0, parsed.shipVitals.hull), shield: Math.max(0, parsed.shipVitals.shield) } : null
    return {
      worldSeed: nonNegativeNumber(parsed.worldSeed) >>> 0,
      orionLayoutVersion: nonNegativeNumber(parsed.orionLayoutVersion),
      prologueComplete,
      initialRepairRequired,
      repairMask: Math.floor(nonNegativeNumber(parsed.repairMask)) & RECOVERY_COMPLETE_MASK,
      orbitPlanetId: typeof parsed.orbitPlanetId === 'string' ? parsed.orbitPlanetId : null,
      recoveryStationId: prologueComplete && typeof parsed.recoveryStationId === 'string' ? parsed.recoveryStationId : null,
      droneRespawns: parsed.droneRespawns && typeof parsed.droneRespawns === 'object' ? Object.fromEntries(Object.entries(parsed.droneRespawns).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0)) : {},
      shipVitals: !prologueComplete || (initialRepairRequired && !savedVitals) ? { ...FIRST_FLIGHT_VITALS } : savedVitals,
      completedMissions: MISSIONS.filter(mission => Array.isArray(parsed.completedMissions) && parsed.completedMissions.includes(mission.id)).map(mission => mission.id),
      campaignEnding: parsed.campaignEnding === 'rebuild' || parsed.campaignEnding === 'seal' || parsed.campaignEnding === 'command' ? parsed.campaignEnding : null,
      missionObjectiveProgress: Object.fromEntries(MISSIONS.map(mission => [mission.id, Math.floor(nonNegativeNumber(parsed.missionObjectiveProgress?.[mission.id]))]).filter(([, count]) => Number(count) > 0)),
      wardenDefeats: typeof parsed.wardenDefeats === 'number' ? parsed.wardenDefeats : 0,
      meridianCore: typeof parsed.meridianCore === 'number' ? parsed.meridianCore : 0,
      credits: typeof parsed.credits === 'number' ? parsed.credits : 0,
      lastMission: parsed.lastMission === 'victory' || parsed.lastMission === 'defeat'
        ? parsed.lastMission
        : null,
      shieldLevel: typeof parsed.shieldLevel === 'number' ? parsed.shieldLevel : 0,
      silentSignalRuns: typeof parsed.silentSignalRuns === 'number' ? parsed.silentSignalRuns : 0,
      signalSourceRuns: typeof parsed.signalSourceRuns === 'number' ? parsed.signalSourceRuns : 0,
      veilSurveyRuns: typeof parsed.veilSurveyRuns === 'number' ? parsed.veilSurveyRuns : 0,
      patrolHuntRuns: typeof parsed.patrolHuntRuns === 'number' ? parsed.patrolHuntRuns : 0,
      nullChoirRuns: typeof parsed.nullChoirRuns === 'number' ? parsed.nullChoirRuns : 0,
      relayData: typeof parsed.relayData === 'number' ? parsed.relayData : 0,
      experience: nonNegativeNumber(parsed.experience),
      pilotSkills: readPilotSkills(parsed.pilotSkills, getPilotLevel(nonNegativeNumber(parsed.experience))),
      scrapMetal: nonNegativeNumber(parsed.scrapMetal),
      copper: nonNegativeNumber(parsed.copper),
      radioactiveResidue: nonNegativeNumber(parsed.radioactiveResidue),
      visitedPlanets: Array.isArray(parsed.visitedPlanets)
        ? parsed.visitedPlanets.filter((id): id is string => typeof id === 'string')
        : [],
      defeatedDrones: Array.isArray(parsed.defeatedDrones)
        ? parsed.defeatedDrones.filter((id): id is string => typeof id === 'string')
        : [],
      purchasedMerchantOffers: Array.isArray(parsed.purchasedMerchantOffers)
        ? parsed.purchasedMerchantOffers.filter((id): id is string => typeof id === 'string') : [],
      sectorId: getGalaxy(parsed.sectorId).id,
      sectorX: finiteNumber(parsed.sectorX),
      sectorY: finiteNumber(parsed.sectorY),
      sectorDistance: nonNegativeNumber(parsed.sectorDistance),
      shipParts,
      equippedParts: {
        weapon: findEquippedPart('weapon'),
        shield: findEquippedPart('shield'),
        engine: findEquippedPart('engine'),
        ...Object.fromEntries(SHIP_PART_SLOTS.slice(3).flatMap(slot => {
          const id = findEquippedPart(slot)
          return id ? [[slot, id]] : []
        })),
      },
    }
  } catch {
    return createEmptyMissionProgress()
  }
}

export function applySalvageReward(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    credits: progress.credits + 120,
    silentSignalRuns: progress.silentSignalRuns + 1,
    relayData: progress.relayData + 3,
    lastMission: 'victory',
    experience: progress.experience + scaleExperience(70),
  }
}

export function applySignalSourceReward(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    credits: progress.credits + 180,
    signalSourceRuns: progress.signalSourceRuns + 1,
    lastMission: 'victory',
    experience: progress.experience + scaleExperience(100),
    scrapMetal: progress.scrapMetal + 3,
    copper: progress.copper + 1,
  }
}

export function applyVeilSurveyReward(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    credits: progress.credits + 150,
    veilSurveyRuns: progress.veilSurveyRuns + 1,
    lastMission: 'victory',
    experience: progress.experience + scaleExperience(75),
  }
}

export function applyPatrolHuntReward(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    credits: progress.credits + 225,
    patrolHuntRuns: progress.patrolHuntRuns + 1,
    lastMission: 'victory',
    experience: progress.experience + scaleExperience(110),
    scrapMetal: progress.scrapMetal + 2,
    copper: progress.copper + 1,
  }
}

export function applyNullChoirReward(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    credits: progress.credits + 320,
    nullChoirRuns: progress.nullChoirRuns + 1,
    lastMission: 'victory',
    experience: progress.experience + scaleExperience(160),
    scrapMetal: progress.scrapMetal + 4,
    copper: progress.copper + 2,
    radioactiveResidue: progress.radioactiveResidue + 1,
  }
}

export function applyBossEquipmentDrop(
  progress: MissionProgress,
  id: string,
  random: () => number = Math.random,
): MissionProgress {
  return {
    ...progress,
    shipParts: [...progress.shipParts, createRandomShipPart(id, random)],
  }
}

/** A location can be revisited without granting its mission reward again. */
export function completeWorldMission(progress: MissionProgress, id: MissionId): MissionProgress {
  if (isMissionComplete(progress, id)) return progress
  const mission = getMission(id)
  const legacyRewards: Partial<Record<MissionId, (value: MissionProgress) => MissionProgress>> = {
    warden: applyMissionReward,
    'silent-signal': applySalvageReward,
    'signal-source': applySignalSourceReward,
    'veil-survey': applyVeilSurveyReward,
    'patrol-hunt': applyPatrolHuntReward,
    'null-choir': applyNullChoirReward,
  }
  const reward = legacyRewards[id]
  let next = reward ? reward(progress) : {
    ...progress, credits: progress.credits + mission.reward.credits,
    experience: progress.experience + scaleExperience(mission.bossProfile ? 220 : 130),
    scrapMetal: progress.scrapMetal + 4, copper: progress.copper + 2,
    radioactiveResidue: progress.radioactiveResidue + 1, lastMission: 'victory' as const,
  }
  if (mission.bossProfile) next = applyBossEquipmentDrop(next, `boss-${id}`)
  return { ...next, completedMissions: [...progress.completedMissions, id] }
}

const CAMPAIGN_ENDING_REWARDS = {
  rebuild: { credits: 1800, experience: 600, meridianCore: 1, scrapMetal: 8, copper: 4, radioactiveResidue: 2 },
  seal: { credits: 1400, experience: 850, meridianCore: 0, scrapMetal: 6, copper: 4, radioactiveResidue: 5 },
  command: { credits: 2300, experience: 500, meridianCore: 2, scrapMetal: 4, copper: 7, radioactiveResidue: 3 },
} as const

export function chooseCampaignEnding(progress: MissionProgress, ending: CampaignEndingId): MissionProgress {
  if (progress.campaignEnding || !isCampaignComplete(progress)) return progress
  const reward = CAMPAIGN_ENDING_REWARDS[ending]
  return {
    ...progress,
    campaignEnding: ending,
    lastMission: 'victory',
    credits: progress.credits + reward.credits,
    experience: progress.experience + reward.experience,
    meridianCore: progress.meridianCore + reward.meridianCore,
    scrapMetal: progress.scrapMetal + reward.scrapMetal,
    copper: progress.copper + reward.copper,
    radioactiveResidue: progress.radioactiveResidue + reward.radioactiveResidue,
  }
}

export function recordMissionObjectiveProgress(progress: MissionProgress, id: MissionId, count: number): MissionProgress {
  const next = Math.floor(nonNegativeNumber(count))
  if (isMissionComplete(progress, id) || next <= (progress.missionObjectiveProgress[id] ?? 0)) return progress
  return { ...progress, missionObjectiveProgress: { ...progress.missionObjectiveProgress, [id]: next } }
}

export function saveMissionProgress(progress: MissionProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function applyMissionReward(progress: MissionProgress): MissionProgress {
  return {
    ...progress,
    wardenDefeats: progress.wardenDefeats + 1,
    meridianCore: progress.meridianCore + 1,
    credits: progress.credits + 240,
    lastMission: 'victory',
    shieldLevel: progress.shieldLevel,
    experience: progress.experience + scaleExperience(90),
    scrapMetal: progress.scrapMetal + 3,
    copper: progress.copper + 2,
  }
}

export function getPilotLevel(experience: number): number {
  return getPilotExperienceProgress(experience).level
}

export function getPilotExperienceProgress(experience: number): PilotExperienceProgress {
  let remainingExperience = nonNegativeNumber(experience)
  let level = 1
  let experienceToNextLevel = 100

  while (remainingExperience >= experienceToNextLevel) {
    remainingExperience -= experienceToNextLevel
    level += 1
    experienceToNextLevel += 35
  }

  return {
    level,
    experienceIntoLevel: remainingExperience,
    experienceToNextLevel,
  }
}

export function learnPilotSkill(progress: MissionProgress, id: PilotSkillId): MissionProgress {
  const skill = PILOT_SKILLS.find(entry => entry.id === id)
  if (!skill || !canLearnPilotSkill(skill, getPilotLevel(progress.experience), progress.pilotSkills)) return progress
  return { ...progress, pilotSkills: [...progress.pilotSkills, id] }
}

export function getShipBonuses(progress: MissionProgress) {
  const bonuses = getEquippedPartBonuses(progress.shipParts, progress.equippedParts)
  const levelBonus = getPilotLevel(progress.experience) - 1
  const learned = progress.pilotSkills
  return {
    ...bonuses,
    damagePercent: bonuses.damagePercent + levelBonus + (learned.includes('targeting') ? 8 : 0),
    shieldPoints: bonuses.shieldPoints + levelBonus * 4,
    hullPoints: bonuses.hullPoints + levelBonus * 3 + (learned.includes('field-repair') ? 14 : 0),
    ...(levelBonus > 0
      ? { handlingPercent: levelBonus * 2 + (learned.includes('flight-trim') ? 14 : 0), speedPercent: levelBonus }
      : {}),
    ...(learned.includes('vector-dodge') ? { dodgeCooldownPercent: Math.min(55, (bonuses.dodgeCooldownPercent ?? 0) + 25) } : {}),
    ...(learned.includes('long-scan') ? { sensorRangePercent: (bonuses.sensorRangePercent ?? 0) + 40 } : {}),
  }
}

/** Only installed modules contribute; old parts without resistance data remain valid. */
export function getShipResistances(progress: MissionProgress): ResistanceProfile {
  const result = Object.fromEntries(DAMAGE_TYPES.map(type => [type, getDamageResistance(type, DEFAULT_SHIP_RESISTANCES)])) as Record<DamageType, number>
  if (progress.pilotSkills.includes('impact-bracing')) result.kinetic = Math.min(MAX_DAMAGE_RESISTANCE, result.kinetic + 0.10)
  for (const slot of SHIP_PART_SLOTS) {
    const part = progress.shipParts.find(item => item.id === progress.equippedParts[slot] && item.slot === slot)
    if (!part) continue
    for (const type of DAMAGE_TYPES) {
      result[type] = Math.min(MAX_DAMAGE_RESISTANCE, result[type] + getDamageResistance(type, part.resistances))
    }
  }
  return result
}

export function applyPlanetLoot(
  progress: MissionProgress,
  planetId: string,
  loot: SectorLoot,
): MissionProgress {
  if (progress.visitedPlanets.includes(planetId)) return progress
  return {
    ...applyLoot(progress, loot),
    visitedPlanets: [...progress.visitedPlanets, planetId],
  }
}

export function applyDroneLoot(
  progress: MissionProgress,
  droneId: string,
  loot: SectorLoot,
  respawnAt?: number,
): MissionProgress {
  const respawns = respawnAt !== undefined
  if (!respawns && progress.defeatedDrones.includes(droneId)) return progress
  return {
    ...applyLoot(progress, loot),
    defeatedDrones: respawns ? progress.defeatedDrones : [...progress.defeatedDrones, droneId],
    droneRespawns: respawns ? { ...progress.droneRespawns, [droneId]: respawnAt } : progress.droneRespawns,
  }
}

export function rollPlanetLoot(random: () => number = Math.random): SectorLoot {
  return {
    credits: 20 + Math.floor(random() * 26),
    experience: scaleExperience(35 + Math.floor(random() * 16)),
    scrapMetal: 2 + Math.floor(random() * 3),
    copper: 1 + Math.floor(random() * 3),
    radioactiveResidue: random() < 0.45 ? 1 : 0,
  }
}

export function rollDroneLoot(random: () => number = Math.random): SectorLoot {
  return {
    credits: 8 + Math.floor(random() * 13),
    experience: scaleExperience(20 + Math.floor(random() * 11)),
    scrapMetal: random() < 0.75 ? 1 + Math.floor(random() * 2) : 0,
    copper: random() < 0.5 ? 1 : 0,
    radioactiveResidue: random() < 0.12 ? 1 : 0,
  }
}

export function updateSectorPosition(
  progress: MissionProgress,
  sectorId: string,
  distance: number,
  x = progress.sectorX,
  y = progress.sectorY,
): MissionProgress {
  const position = {
    sectorId: getGalaxy(sectorId).id,
    sectorX: finiteNumber(x),
    sectorY: finiteNumber(y),
    sectorDistance: nonNegativeNumber(distance),
  }
  if (position.sectorId === progress.sectorId && position.sectorX === progress.sectorX
    && position.sectorY === progress.sectorY && position.sectorDistance === progress.sectorDistance) return progress
  return { ...progress, ...position }
}

export function craftRandomShipPart(
  progress: MissionProgress,
  id: string,
  random: () => number = Math.random,
): MissionProgress {
  if (!canAfford(progress, SHIP_PART_CRAFTING_COST) || !canStoreShipPart(progress)) return progress
  return {
    ...spend(progress, SHIP_PART_CRAFTING_COST),
    shipParts: [...progress.shipParts, createRandomShipPart(id, random)],
  }
}

export function rerollShipPart(
  progress: MissionProgress,
  partId: string,
  random: () => number = Math.random,
): MissionProgress {
  const part = progress.shipParts.find((item) => item.id === partId)
  if (!part || !canAfford(progress, SHIP_PART_REROLL_COST)) return progress
  const rerolled = createRandomShipPart(partId, random, part.slot)
  return {
    ...spend(progress, SHIP_PART_REROLL_COST),
    shipParts: progress.shipParts.map((item) => item.id === partId ? rerolled : item),
  }
}

export function equipShipPart(progress: MissionProgress, partId: string): MissionProgress {
  const part = progress.shipParts.find((item) => item.id === partId)
  if (!part || getPilotLevel(progress.experience) < getShipPartLevelRequirement(part.rarity)) return progress
  return {
    ...progress,
    equippedParts: { ...progress.equippedParts, [part.slot]: part.id },
  }
}

export function getBackpackShipParts(progress: MissionProgress): ShipPart[] {
  const equippedIds = new Set(Object.values(progress.equippedParts).filter((id): id is string => id !== null))
  return progress.shipParts.filter((part) => !equippedIds.has(part.id))
}

export function canStoreShipPart(progress: MissionProgress): boolean {
  return getBackpackShipParts(progress).length < SHIP_PART_STORAGE_CAPACITY
}

export function sellShipPart(progress: MissionProgress, partId: string): MissionProgress {
  const part = getBackpackShipParts(progress).find((item) => item.id === partId)
  if (!part) return progress
  return {
    ...progress,
    credits: progress.credits + getShipPartSellValue(part),
    shipParts: progress.shipParts.filter((item) => item.id !== partId),
  }
}

export function unequipShipPart(progress: MissionProgress, slot: ShipPartSlot): MissionProgress {
  if (!progress.equippedParts[slot] || !canStoreShipPart(progress)) return progress
  return {
    ...progress,
    equippedParts: { ...progress.equippedParts, [slot]: null },
  }
}

function applyLoot(progress: MissionProgress, loot: SectorLoot): MissionProgress {
  return {
    ...progress,
    credits: progress.credits + loot.credits,
    experience: progress.experience + loot.experience,
    scrapMetal: progress.scrapMetal + loot.scrapMetal,
    copper: progress.copper + loot.copper,
    radioactiveResidue: progress.radioactiveResidue + loot.radioactiveResidue,
  }
}

function canAfford(
  progress: MissionProgress,
  cost: Pick<SectorLoot, 'credits' | 'scrapMetal' | 'copper' | 'radioactiveResidue'>,
): boolean {
  return progress.credits >= cost.credits
    && progress.scrapMetal >= cost.scrapMetal
    && progress.copper >= cost.copper
    && progress.radioactiveResidue >= cost.radioactiveResidue
}

function spend(
  progress: MissionProgress,
  cost: Pick<SectorLoot, 'credits' | 'scrapMetal' | 'copper' | 'radioactiveResidue'>,
): MissionProgress {
  return {
    ...progress,
    credits: progress.credits - cost.credits,
    scrapMetal: progress.scrapMetal - cost.scrapMetal,
    copper: progress.copper - cost.copper,
    radioactiveResidue: progress.radioactiveResidue - cost.radioactiveResidue,
  }
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** All experience awards share this balance multiplier; existing levels are preserved. */
export function scaleExperience(base: number): number { return base * 0.5 }

export function restoreDroneSpawn(progress: MissionProgress, id: string): MissionProgress {
  const droneRespawns = { ...progress.droneRespawns }
  delete droneRespawns[id]
  return { ...progress, defeatedDrones: progress.defeatedDrones.filter(item => item !== id), droneRespawns }
}
