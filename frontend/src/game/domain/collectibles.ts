import { localizedText, type LocalizedText } from '../i18n'

export type CollectibleKind = 'plant' | 'mascot'

export interface CollectibleDef {
  id: string
  kind: CollectibleKind
  name: LocalizedText
  color: string
}

/** Small starter catalog; expandable as the galaxy grows. */
export const COLLECTIBLES: readonly CollectibleDef[] = [
  { id: 'glow-fern', kind: 'plant', color: '#5fd6a4', name: localizedText((_t, l) => l === 'pl' ? 'Świecąca paproć' : 'Glow Fern') },
  { id: 'ember-bloom', kind: 'plant', color: '#ff9b5a', name: localizedText((_t, l) => l === 'pl' ? 'Żar-kwiat' : 'Ember Bloom') },
  { id: 'void-orchid', kind: 'plant', color: '#b98cff', name: localizedText((_t, l) => l === 'pl' ? 'Pustkowa orchidea' : 'Void Orchid') },
  { id: 'pip-mascot', kind: 'mascot', color: '#ffd166', name: localizedText((_t, l) => l === 'pl' ? 'Maskotka Pip' : 'Pip Mascot') },
  { id: 'nacre-cat', kind: 'mascot', color: '#73edd3', name: localizedText((_t, l) => l === 'pl' ? 'Nacrowy kot' : 'Nacre Cat') },
  { id: 'star-slug', kind: 'mascot', color: '#87dfff', name: localizedText((_t, l) => l === 'pl' ? 'Gwiezdny ślimak' : 'Star Slug') },
]

/** Number of plant slots inside the ship interior. */
export const MAX_PLANT_SLOTS = 4

export interface PlantedPlant {
  collectibleId: string
  slot: number
}

export interface CollectionState {
  /** Ids ever collected — the unique-item log. */
  collected: string[]
  /** Plants currently placed in interior slots. */
  planted: PlantedPlant[]
}

export const EMPTY_COLLECTION: CollectionState = { collected: [], planted: [] }

export function getCollectible(id: string): CollectibleDef | undefined {
  return COLLECTIBLES.find(item => item.id === id)
}

export function isCollected(state: CollectionState, id: string): boolean {
  return state.collected.includes(id)
}

/** Adds a new unique entry to the log; no duplicates. */
export function collectItem(state: CollectionState, id: string): CollectionState {
  if (!getCollectible(id) || state.collected.includes(id)) return state
  return { ...state, collected: [...state.collected, id] }
}

export function getPlantedInSlot(state: CollectionState, slot: number): PlantedPlant | undefined {
  return state.planted.find(plant => plant.slot === slot)
}

/** Places a collected plant into a free interior slot. */
export function plantItem(state: CollectionState, id: string, slot: number): CollectionState {
  const def = getCollectible(id)
  if (!def || def.kind !== 'plant' || !state.collected.includes(id)) return state
  if (slot < 0 || slot >= MAX_PLANT_SLOTS || getPlantedInSlot(state, slot)) return state
  if (state.planted.some(plant => plant.collectibleId === id)) return state
  return { ...state, planted: [...state.planted, { collectibleId: id, slot }] }
}

/** Removes a plant from a slot (returns it to the backpack, keeps the log). */
export function uprootPlant(state: CollectionState, slot: number): CollectionState {
  if (!getPlantedInSlot(state, slot)) return state
  return { ...state, planted: state.planted.filter(plant => plant.slot !== slot) }
}

export function getCollectionLog(state: CollectionState): CollectibleDef[] {
  return state.collected.map(getCollectible).filter((item): item is CollectibleDef => item !== undefined)
}