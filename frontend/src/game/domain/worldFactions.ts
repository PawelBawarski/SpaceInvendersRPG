import { localizedText, type LocalizedText } from '../i18n'
import type { DroneSite, SectorPosition } from './exploration'
import type { MissionId } from '../missions/definitions'

export type FactionId = 'meridian' | 'nacre' | 'null-cult' | 'ashen-legion'
export type ShipArchetype = 'scout' | 'interceptor' | 'bomber' | 'frigate'

export interface FactionDefinition {
  name: LocalizedText
  color: string
  accent: string
  damageMultiplier: number
  healthMultiplier: number
}

export interface CombatShipProfile {
  health: number
  damage: number
  attackInterval: number
  attackRange: number
  projectileSpeed: number
  speed: number
}

export const FACTIONS: Readonly<Record<FactionId, FactionDefinition>> = {
  meridian: {
    name: localizedText(text => text.factions.meridianSecession),
    color: '#3f6e92', accent: '#78cfff', damageMultiplier: 1, healthMultiplier: 1,
  },
  nacre: {
    name: localizedText(text => text.factions.nacreCorsairs),
    color: '#327d76', accent: '#73edd3', damageMultiplier: 0.9, healthMultiplier: 0.9,
  },
  'null-cult': {
    name: localizedText(text => text.factions.cultOfTheNullChoir),
    color: '#65508d', accent: '#c092ff', damageMultiplier: 1.15, healthMultiplier: 1,
  },
  'ashen-legion': {
    name: localizedText(text => text.factions.ashenLegion),
    color: '#8f5141', accent: '#ffad67', damageMultiplier: 1.25, healthMultiplier: 1.3,
  },
}

export const SHIP_ARCHETYPES: Readonly<Record<ShipArchetype, CombatShipProfile>> = {
  scout: { health: 45, damage: 7, attackInterval: 2.5, attackRange: 75, projectileSpeed: 65, speed: 18 },
  interceptor: { health: 85, damage: 12, attackInterval: 1.8, attackRange: 110, projectileSpeed: 95, speed: 28 },
  bomber: { health: 150, damage: 23, attackInterval: 3.4, attackRange: 150, projectileSpeed: 58, speed: 12 },
  frigate: { health: 340, damage: 19, attackInterval: 2.2, attackRange: 190, projectileSpeed: 82, speed: 9 },
}

export function createWorldShip(
  id: string,
  faction: FactionId,
  archetype: ShipArchetype,
  position: SectorPosition,
  missionId?: MissionId,
): DroneSite {
  const type = SHIP_ARCHETYPES[archetype]
  const culture = FACTIONS[faction]
  return {
    id, ...position, faction, archetype,
    health: Math.round(type.health * culture.healthMultiplier) * 2,
    damage: Math.round(type.damage * culture.damageMultiplier),
    attackInterval: type.attackInterval,
    attackRange: type.attackRange,
    projectileSpeed: type.projectileSpeed,
    speed: type.speed,
    ...(missionId ? { missionId } : {}),
  }
}
