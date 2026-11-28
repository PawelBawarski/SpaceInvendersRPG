import type { MissionProgress } from '../progress/missionProgress'
import { COLLECTIBLES } from './collectibles'
import { localizedText, type LocalizedText } from '../i18n'

export interface AchievementDef {
  id: string
  name: LocalizedText
  description: LocalizedText
  achieved: (progress: MissionProgress) => boolean
}

const allCollected = (progress: MissionProgress) =>
  COLLECTIBLES.every(item => progress.collection?.collected.includes(item.id))

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-contact', name: localizedText((_t, l) => l === 'pl' ? 'Pierwszy kontakt' : 'First Contact'),
    description: localizedText((_t, l) => l === 'pl' ? 'Zestrzel pierwszego drona.' : 'Destroy your first drone.'),
    achieved: p => p.defeatedDrones.length >= 1 },
  { id: 'ace', name: localizedText((_t, l) => l === 'pl' ? 'As' : 'Ace'),
    description: localizedText((_t, l) => l === 'pl' ? 'Zestrzel 25 dronów.' : 'Destroy 25 drones.'),
    achieved: p => p.defeatedDrones.length >= 25 },
  { id: 'explorer', name: localizedText((_t, l) => l === 'pl' ? 'Odkrywca' : 'Explorer'),
    description: localizedText((_t, l) => l === 'pl' ? 'Zbadaj 5 planet.' : 'Scan 5 planets.'),
    achieved: p => p.visitedPlanets.length >= 5 },
  { id: 'cartographer', name: localizedText((_t, l) => l === 'pl' ? 'Kartograf' : 'Cartographer'),
    description: localizedText((_t, l) => l === 'pl' ? 'Zbadaj 15 planet.' : 'Scan 15 planets.'),
    achieved: p => p.visitedPlanets.length >= 15 },
  { id: 'collector', name: localizedText((_t, l) => l === 'pl' ? 'Kolekcjoner' : 'Collector'),
    description: localizedText((_t, l) => l === 'pl' ? 'Zbierz 3 unikatowe przedmioty.' : 'Collect 3 unique items.'),
    achieved: p => (p.collection?.collected.length ?? 0) >= 3 },
  { id: 'curator', name: localizedText((_t, l) => l === 'pl' ? 'Kurator' : 'Curator'),
    description: localizedText((_t, l) => l === 'pl' ? 'Zbierz wszystkie unikatowe przedmioty.' : 'Collect every unique item.'),
    achieved: allCollected },
  { id: 'veteran', name: localizedText((_t, l) => l === 'pl' ? 'Weteran' : 'Veteran'),
    description: localizedText((_t, l) => l === 'pl' ? 'Zdobądź 600 doświadczenia.' : 'Earn 600 experience.'),
    achieved: p => p.experience >= 600 },
  { id: 'warlord', name: localizedText((_t, l) => l === 'pl' ? 'Władca wojny' : 'Warlord'),
    description: localizedText((_t, l) => l === 'pl' ? 'Ukończ 3 misje.' : 'Complete 3 missions.'),
    achieved: p => p.completedMissions.length >= 3 },
  { id: 'savior', name: localizedText((_t, l) => l === 'pl' ? 'Zbawca' : 'Savior'),
    description: localizedText((_t, l) => l === 'pl' ? 'Ukończ kampanię.' : 'Complete the campaign.'),
    achieved: p => p.campaignEnding !== null },
]

export interface AchievementEvaluation {
  unlocked: string[]
  newly: AchievementDef[]
}

/** Pure: returns the full unlocked set plus any achievements earned this step. */
export function evaluateAchievements(progress: MissionProgress, unlocked: readonly string[]): AchievementEvaluation {
  const set = new Set(unlocked)
  const newly: AchievementDef[] = []
  for (const achievement of ACHIEVEMENTS) {
    if (set.has(achievement.id)) continue
    if (achievement.achieved(progress)) {
      set.add(achievement.id)
      newly.push(achievement)
    }
  }
  return { unlocked: [...set], newly }
}

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find(item => item.id === id)
}