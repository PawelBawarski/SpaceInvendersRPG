import { localizedText, type LocalizedText } from '../i18n'
import type { HangarCrewMember } from '../hangar/crew'

/** A colossal trade-and-habitat ring near the start, distinct from a planetary hangar. */
export interface MegastationSite {
  id: string
  name: LocalizedText
  x: number
  y: number
  z: number
  radius: number
  color: string
}

export const MEGASTATION: MegastationSite = {
  id: 'bastion-ring',
  name: localizedText((_t, l) => l === 'pl' ? 'Pierścień Bastion' : 'Bastion Ring'),
  x: 2600,
  y: 400,
  z: 12000,
  radius: 5200,
  color: '#8fd0ff',
}

/** How close the ship must be to interact with the ring (visual docking range). */
export const MEGASTATION_DOCK_RANGE = MEGASTATION.radius * 1.6

export interface MegastationPosition {
  x: number
  y: number
  z: number
}

export function distanceToMegastation(position: MegastationPosition): number {
  return Math.hypot(position.x - MEGASTATION.x, position.y - MEGASTATION.y, position.z - MEGASTATION.z)
}

export function isMegastationInRange(position: MegastationPosition, range = MEGASTATION_DOCK_RANGE): boolean {
  return distanceToMegastation(position) <= range
}

export interface MegastationNpc {
  id: string
  name: LocalizedText
  role: LocalizedText
  species: HangarCrewMember['species']
  colors: HangarCrewMember['colors']
  /** Side mission unlocked by talking to this NPC (wired in the side-mission phase). */
  sideMissionId?: string
  dialogue: readonly LocalizedText[]
}

/** A busy concourse — many NPCs to talk to, several offering side work. */
export const MEGASTATION_NPC: readonly MegastationNpc[] = [
  {
    id: 'dockmaster-vael',
    name: localizedText((_t, l) => l === 'pl' ? 'Mistrz doku Vael' : 'Dockmaster Vael'),
    role: localizedText((_t, l) => l === 'pl' ? 'Kontrola ruchu' : 'Traffic control'),
    species: 'human',
    colors: { suit: '#304c5d', trim: '#f0ae59', skin: '#bd8b69' },
    sideMissionId: 'bastion-sweep',
    dialogue: [localizedText((_t, l) => l === 'pl' ? 'Bastion widział gorsze dni, ale rzadko.' : 'Bastion has seen worse days, but rarely.')],
  },
  {
    id: 'quartermaster-ith',
    name: localizedText((_t, l) => l === 'pl' ? 'Kwatermistrz Ith' : 'Quartermaster Ith'),
    role: localizedText((_t, l) => l === 'pl' ? 'Zaopatrzenie' : 'Supplies'),
    species: 'human',
    colors: { suit: '#45443b', trim: '#74c9e8', skin: '#c59273' },
    sideMissionId: 'bastion-supply',
    dialogue: [localizedText((_t, l) => l === 'pl' ? 'Brakuje nam rud. Przywieź ładunek, a zapłacę.' : 'We are short on ore. Haul a load and I will pay.')],
  },
  {
    id: 'archivist-sol',
    name: localizedText((_t, l) => l === 'pl' ? 'Archiwistka Sol' : 'Archivist Sol'),
    role: localizedText((_t, l) => l === 'pl' ? 'Archiwum' : 'Archive'),
    species: 'human',
    colors: { suit: '#3b354e', trim: '#65d8d0', skin: '#5aa79f' },
    sideMissionId: 'bastion-signal',
    dialogue: [localizedText((_t, l) => l === 'pl' ? 'Ostatni strażnik... myślałam, że to legenda.' : 'The last guardian... I thought that was a legend.')],
  },
  {
    id: 'broker-nyx',
    name: localizedText((_t, l) => l === 'pl' ? 'Broker Nyx' : 'Broker Nyx'),
    role: localizedText((_t, l) => l === 'pl' ? 'Kontrakty' : 'Contracts'),
    species: 'alien',
    colors: { suit: '#6b4853', trim: '#fdab83', skin: '#ae7392' },
    dialogue: [localizedText((_t, l) => l === 'pl' ? 'Wszyscy mają cenę. Nawet Pożeracz.' : 'Everyone has a price. Even the Devourer.')],
  },
  {
    id: 'engineer-odo',
    name: localizedText((_t, l) => l === 'pl' ? 'Inżynier Odo' : 'Engineer Odo'),
    role: localizedText((_t, l) => l === 'pl' ? 'Naprawy' : 'Repairs'),
    species: 'human',
    colors: { suit: '#64877b', trim: '#bcffab', skin: '#2e423d' },
    sideMissionId: 'translation-aid',
    dialogue: [localizedText((_t, l) => l === 'pl' ? 'Twój statek to wrak. Wpadnij, gdy będziesz gotów.' : 'Your ship is a wreck. Come by when you are ready.')],
  },
  {
    id: 'child-pip',
    name: localizedText((_t, l) => l === 'pl' ? 'Mały Pip' : 'Little Pip'),
    role: localizedText((_t, l) => l === 'pl' ? 'Obserwator' : 'Watcher'),
    species: 'avian',
    colors: { suit: '#6b4853', trim: '#fdab83', skin: '#ae7392' },
    sideMissionId: 'erebus-echo',
    dialogue: [localizedText((_t, l) => l === 'pl' ? 'Widziałem, jak spadałeś z nieba!' : 'I saw you fall out of the sky!')],
  },
]