import { localizedText, type LocalizedText } from '../i18n'

export type SideMissionId = 'bastion-sweep' | 'bastion-supply' | 'bastion-signal' | 'translation-aid' | 'erebus-echo'

export interface SideMissionDefinition {
  id: SideMissionId
  title: LocalizedText
  briefing: LocalizedText
  /** Hostiles to destroy anywhere in the sector while the contract is active. */
  requiredKills: number
  reward: { credits: number; experience: number }
}

export const SIDE_MISSIONS: readonly SideMissionDefinition[] = [
  {
    id: 'bastion-sweep',
    title: localizedText((_t, l) => l === 'pl' ? 'Zamiatanie Bastionu' : 'Bastion Sweep'),
    briefing: localizedText((_t, l) => l === 'pl' ? 'Wyczyść okolicę pierścienia z wrogich jednostek.' : 'Clear hostile craft from around the ring.'),
    requiredKills: 3,
    reward: { credits: 260, experience: 120 },
  },
  {
    id: 'bastion-supply',
    title: localizedText((_t, l) => l === 'pl' ? 'Dostawa dla Bastionu' : 'Bastion Supply Run'),
    briefing: localizedText((_t, l) => l === 'pl' ? 'Zestrzel eskortę konwoju, by przejąć ładunek rud.' : 'Down the convoy escort to seize an ore shipment.'),
    requiredKills: 4,
    reward: { credits: 340, experience: 150 },
  },
  {
    id: 'bastion-signal',
    title: localizedText((_t, l) => l === 'pl' ? 'Sygnał z Bastionu' : 'Bastion Signal'),
    briefing: localizedText((_t, l) => l === 'pl' ? 'Uciszyj przekaźniki kultu zakłócające pierścień.' : 'Silence the cult relays jamming the ring.'),
    requiredKills: 5,
    reward: { credits: 420, experience: 200 },
  },
  {
    id: 'translation-aid',
    title: localizedText((_t, l) => l === 'pl' ? 'Pomoc w tłumaczeniu' : 'Translation Aid'),
    briefing: localizedText((_t, l) => l === 'pl' ? 'Zbierz części modułu, zestrzeliwując eskortę kultu.' : 'Recover module parts by downing the cult escort.'),
    requiredKills: 5,
    reward: { credits: 450, experience: 260 },
  },
  {
    id: 'erebus-echo',
    title: localizedText((_t, l) => l === 'pl' ? 'Echo Erebus' : 'Erebus Echo'),
    briefing: localizedText((_t, l) => l === 'pl' ? 'Uciszyj źródło zakłóceń dobiegających z Erebus.' : 'Silence the interference source bleeding in from Erebus.'),
    requiredKills: 7,
    reward: { credits: 640, experience: 320 },
  },
]

export function isSideMissionId(id: string): id is SideMissionId {
  return SIDE_MISSIONS.some(mission => mission.id === id)
}

export function getSideMission(id: SideMissionId): SideMissionDefinition {
  const mission = SIDE_MISSIONS.find(item => item.id === id)
  if (!mission) throw new Error('Unknown side mission: ' + id)
  return mission
}