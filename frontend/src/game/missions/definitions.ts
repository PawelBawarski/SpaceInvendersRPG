import { ORION_PLANETS, VEIL_PATROL_DRONE, type SectorPosition, type DroneSite, type FactionId } from '../domain/exploration'
import { createWorldShip } from '../domain/worldFactions'
import { BOSS_ESCORT_ORBIT, BOSS_VISUAL_SCALE } from '../domain/enemyScale'

export type MissionId = 'warden' | 'silent-signal' | 'signal-source' | 'veil-survey' | 'patrol-hunt' | 'null-choir' | 'glass-orbit' | 'nacre-ambush' | 'ashen-carrier' | 'forge-orbit' | 'cult-convergence' | 'meridian-warlord'
export type MissionObjective = 'destroy-warden' | 'recover-fragments' | 'disable-signal' | 'survey-planet' | 'destroy-patrol' | 'orbital-sweep' | 'clear-squadron'
export type MissionSectorTarget = { type: 'planet'; id: string } | { type: 'drone'; id: string }
export interface BossCombatProfile {
  health: number; shield: number; damage: number; attackInterval: number; projectileSpeed: number
  pattern: 'aimed' | 'fan' | 'burst' | 'spiral'; supportCount: number
}
export interface MissionDefinition {
  id: MissionId
  title: { pl: string; en: string }
  briefing: { pl: string; en: string }
  objective: MissionObjective
  reward: { credits: number; meridianCore: number; fragments: number }
  sectorTarget?: MissionSectorTarget
  worldPosition: SectorPosition
  activationRadius: number
  faction: FactionId
  bossProfile?: BossCombatProfile
  requiredKills?: number
}
export interface CampaignProgress {
  wardenDefeats: number; silentSignalRuns: number; signalSourceRuns: number
  veilSurveyRuns: number; patrolHuntRuns: number; nullChoirRuns: number
  completedMissions?: readonly MissionId[]
}

const MISSION_SITES: readonly MissionDefinition[] = [
  {
    "id": "warden",
    "title": {
      "pl": "Pierwszy kontakt",
      "en": "First Contact"
    },
    "briefing": {
      "pl": "Strażnik Meridian utrzymuje blokadę szlaku. Doleć do jego sygnału i przełam osłonę.",
      "en": "Fly to the Warden signal and break its blockade."
    },
    "objective": "destroy-warden",
    "reward": {
      "credits": 240,
      "meridianCore": 1,
      "fragments": 0
    },
    "faction": "meridian",
    "worldPosition": {
      "x": 900,
      "y": 80,
      "z": 3400
    },
    "activationRadius": 600,
    "bossProfile": {
      "health": 300,
      "shield": 200,
      "damage": 10,
      "attackInterval": 1.9,
      "projectileSpeed": 150,
      "pattern": "fan",
      "supportCount": 2
    }
  },
  {
    "id": "silent-signal",
    "title": {
      "pl": "Sygnał w ciszy",
      "en": "Signal in the Quiet"
    },
    "briefing": {
      "pl": "Odzyskaj trzy czarne skrzynki z rozproszonego wraku.",
      "en": "Recover three black boxes from the scattered wreck."
    },
    "objective": "recover-fragments",
    "reward": {
      "credits": 120,
      "meridianCore": 0,
      "fragments": 3
    },
    "faction": "nacre",
    "worldPosition": {
      "x": -1500,
      "y": 200,
      "z": 7000
    },
    "activationRadius": 220
  },
  {
    "id": "signal-source",
    "title": {
      "pl": "Echo w rdzeniu",
      "en": "Echo in the Core"
    },
    "briefing": {
      "pl": "Doleć do pulsującego przekaźnika. Strzelaj w przerwach między impulsami osłony.",
      "en": "Fly to the pulsing relay and fire during the gaps in its shield."
    },
    "objective": "disable-signal",
    "reward": {
      "credits": 180,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "null-cult",
    "worldPosition": {
      "x": -2300,
      "y": 500,
      "z": 12000
    },
    "activationRadius": 650,
    "bossProfile": {
      "health": 420,
      "shield": 240,
      "damage": 16,
      "attackInterval": 1.65,
      "projectileSpeed": 180,
      "pattern": "burst",
      "supportCount": 3
    }
  },
  {
    "id": "veil-survey",
    "title": {
      "pl": "Archiwum Mgławicy",
      "en": "Veil Archive"
    },
    "briefing": {
      "pl": "Zeskanuj ruiny na orbicie Archiwum Mgławicy.",
      "en": "Survey the ruins at the Veil Archive."
    },
    "objective": "survey-planet",
    "reward": {
      "credits": 150,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "meridian",
    "worldPosition": {
      "x": 6480,
      "y": -2400,
      "z": 44210
    },
    "activationRadius": 170,
    "sectorTarget": {
      "type": "planet",
      "id": "veil-archive"
    }
  },
  {
    "id": "patrol-hunt",
    "title": {
      "pl": "Cichy patrol",
      "en": "Silent Patrol"
    },
    "briefing": {
      "pl": "Odszukaj i zniszcz zwiadowcę Veil.",
      "en": "Find and destroy the Veil scout."
    },
    "objective": "destroy-patrol",
    "reward": {
      "credits": 225,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "meridian",
    "worldPosition": {
      "x": 5880,
      "y": -1920,
      "z": 42000
    },
    "activationRadius": 450,
    "sectorTarget": {
      "type": "drone",
      "id": "veil-warden"
    },
    "requiredKills": 1
  },
  {
    "id": "null-choir",
    "title": {
      "pl": "Głos bez echa",
      "en": "The Null Choir"
    },
    "briefing": {
      "pl": "Przerwij transmisję Chóru i odeprzyj jego eskortę.",
      "en": "Silence the Choir and fight through its escort."
    },
    "objective": "destroy-warden",
    "reward": {
      "credits": 320,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "null-cult",
    "worldPosition": {
      "x": 3400,
      "y": 800,
      "z": 38000
    },
    "activationRadius": 750,
    "bossProfile": {
      "health": 600,
      "shield": 400,
      "damage": 22,
      "attackInterval": 1.3,
      "projectileSpeed": 210,
      "pattern": "spiral",
      "supportCount": 4
    }
  },
  {
    "id": "glass-orbit",
    "title": {
      "pl": "Strażnicy szklanej orbity",
      "en": "Glass Orbit Guardians"
    },
    "briefing": {
      "pl": "Okrąż Szklany Księżyc i oczyść orbitę z sześciu okrętów korsarzy.",
      "en": "Circle the Glass Moon and clear six corsair ships from orbit."
    },
    "objective": "orbital-sweep",
    "reward": {
      "credits": 280,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "nacre",
    "worldPosition": {
      "x": 0,
      "y": 0,
      "z": 5052
    },
    "activationRadius": 600,
    "sectorTarget": {
      "type": "planet",
      "id": "glass-moon"
    },
    "requiredKills": 6
  },
  {
    "id": "nacre-ambush",
    "title": {
      "pl": "Zasadzka na rafie",
      "en": "Reef Ambush"
    },
    "briefing": {
      "pl": "Rozbij eskadrę blokującą szlak przy Rafie Nacre.",
      "en": "Break the squadron blockading the Nacre Reef route."
    },
    "objective": "clear-squadron",
    "reward": {
      "credits": 360,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "nacre",
    "worldPosition": {
      "x": -1920,
      "y": 1200,
      "z": 48800
    },
    "activationRadius": 650,
    "requiredKills": 7
  },
  {
    "id": "ashen-carrier",
    "title": {
      "pl": "Nosiciel Popiołu",
      "en": "Ashen Carrier"
    },
    "briefing": {
      "pl": "Legion Popiołu sprowadził ciężkiego nosiciela i bombowce eskorty.",
      "en": "The Ashen Legion has deployed a heavy carrier and bomber escort."
    },
    "objective": "destroy-warden",
    "reward": {
      "credits": 520,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "ashen-legion",
    "worldPosition": {
      "x": 5100,
      "y": -1700,
      "z": 23500
    },
    "activationRadius": 800,
    "bossProfile": {
      "health": 900,
      "shield": 500,
      "damage": 32,
      "attackInterval": 2,
      "projectileSpeed": 230,
      "pattern": "fan",
      "supportCount": 5
    }
  },
  {
    "id": "forge-orbit",
    "title": {
      "pl": "Oblężenie Kuźni",
      "en": "Foundry Siege"
    },
    "briefing": {
      "pl": "Leć po orbicie Cichej Kuźni i zniszcz osiem jednostek oblężniczych.",
      "en": "Fly around the Quiet Foundry and destroy eight siege ships."
    },
    "objective": "orbital-sweep",
    "reward": {
      "credits": 420,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "ashen-legion",
    "worldPosition": {
      "x": 1200,
      "y": 3360,
      "z": 39276
    },
    "activationRadius": 800,
    "sectorTarget": {
      "type": "planet",
      "id": "quiet-foundry"
    },
    "requiredKills": 8
  },
  {
    "id": "cult-convergence",
    "title": {
      "pl": "Zgromadzenie kultu",
      "en": "Cult Convergence"
    },
    "briefing": {
      "pl": "Przerwij zgromadzenie kultystów nad Obsydianowym Przypływem.",
      "en": "Disperse the cult gathering above Obsidian Tide."
    },
    "objective": "clear-squadron",
    "reward": {
      "credits": 400,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "null-cult",
    "worldPosition": {
      "x": 1100,
      "y": -2500,
      "z": 14700
    },
    "activationRadius": 650,
    "requiredKills": 8
  },
  {
    "id": "meridian-warlord",
    "title": {
      "pl": "Ostatni admirał",
      "en": "The Last Admiral"
    },
    "briefing": {
      "pl": "Odnajdź flagowy okręt rozłamu Meridian. Jego ciężkie salwy rozrywają tarcze.",
      "en": "Find the Meridian secession flagship. Its heavy volleys tear through shields."
    },
    "objective": "destroy-warden",
    "reward": {
      "credits": 700,
      "meridianCore": 0,
      "fragments": 0
    },
    "faction": "meridian",
    "worldPosition": {
      "x": 400,
      "y": 400,
      "z": 51300
    },
    "activationRadius": 850,
    "bossProfile": {
      "health": 1200,
      "shield": 650,
      "damage": 38,
      "attackInterval": 1.45,
      "projectileSpeed": 260,
      "pattern": "burst",
      "supportCount": 6
    }
  }
]

function buildMissions(): MissionDefinition[] { return MISSION_SITES.map(source => {
  const mission = source.bossProfile ? { ...source, bossProfile: { ...source.bossProfile, health: source.bossProfile.health * 6, shield: source.bossProfile.shield * 6 } } : source
  const target = mission.sectorTarget?.type === 'planet' ? ORION_PLANETS.find(planet => planet.id === mission.sectorTarget?.id) : undefined
  if (target) return { ...mission, worldPosition: { x: target.x, y: target.y, z: target.z - target.radius - 100 } }
  const clearance = mission.bossProfile ? BOSS_ESCORT_ORBIT + 7.2 * BOSS_VISUAL_SCALE + 100 : 260
  const nearby = ORION_PLANETS.find(planet => Math.hypot(planet.x - mission.worldPosition.x, planet.y - mission.worldPosition.y, planet.z - mission.worldPosition.z) < planet.radius + clearance)
  return nearby ? { ...mission, worldPosition: { x: nearby.x, y: nearby.y, z: nearby.z - nearby.radius - clearance } } : mission
}) }

export let MISSIONS: readonly MissionDefinition[] = buildMissions()
export function refreshMissionLocations() { MISSIONS = buildMissions() }

export function isMissionComplete(progress: CampaignProgress, id: MissionId): boolean {
  if (progress.completedMissions?.includes(id)) return true
  const legacy: Partial<Record<MissionId, number>> = {
    warden: progress.wardenDefeats, 'silent-signal': progress.silentSignalRuns,
    'signal-source': progress.signalSourceRuns, 'veil-survey': progress.veilSurveyRuns,
    'patrol-hunt': progress.patrolHuntRuns, 'null-choir': progress.nullChoirRuns,
  }
  return (legacy[id] ?? 0) > 0
}

export function getNextCampaignMission(progress: CampaignProgress): MissionId | null {
  return MISSIONS.find(mission => !isMissionComplete(progress, mission.id))?.id ?? null
}

export function getMission(id: MissionId): MissionDefinition {
  const mission = MISSIONS.find(item => item.id === id)
  if (!mission) throw new Error('Unknown mission: ' + id)
  return mission
}

export function buildMissionHostiles(mission: MissionDefinition): DroneSite[] {
  if (mission.objective === 'destroy-patrol') return [{ ...VEIL_PATROL_DRONE, missionId: mission.id }]
  const count = mission.bossProfile?.supportCount ?? (mission.objective === 'orbital-sweep' || mission.objective === 'clear-squadron' ? mission.requiredKills ?? 6 : 0)
  const planet = mission.objective === 'orbital-sweep' ? ORION_PLANETS.find(site => site.id === mission.sectorTarget?.id) : undefined
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2
    const radius = planet ? planet.radius + 140 : mission.bossProfile ? BOSS_ESCORT_ORBIT : 140
    const center = planet ?? mission.worldPosition
    const archetype = mission.faction === 'ashen-legion' ? (index % 3 === 0 ? 'frigate' : 'bomber') : index % 3 === 0 ? 'scout' : 'interceptor'
    return createWorldShip('mission-' + mission.id + '-' + index, mission.faction, archetype, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle * 2) * (planet ? 45 : 12),
      z: center.z + Math.sin(angle) * radius,
    }, mission.id)
  })
}
