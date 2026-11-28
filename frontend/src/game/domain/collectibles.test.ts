import { describe, expect, it } from 'vitest'
import {
  COLLECTIBLES,
  EMPTY_COLLECTION,
  MAX_PLANT_SLOTS,
  collectItem,
  getCollectionLog,
  getPlantedInSlot,
  isCollected,
  plantItem,
  uprootPlant,
} from './collectibles'

const plant = COLLECTIBLES.find(item => item.kind === 'plant')!
const mascot = COLLECTIBLES.find(item => item.kind === 'mascot')!

describe('collectItem', () => {
  it('records a unique entry once', () => {
    const once = collectItem(EMPTY_COLLECTION, plant.id)
    expect(isCollected(once, plant.id)).toBe(true)
    expect(collectItem(once, plant.id)).toBe(once)
  })

  it('ignores unknown ids', () => {
    expect(collectItem(EMPTY_COLLECTION, 'nope')).toBe(EMPTY_COLLECTION)
  })

  it('builds a collection log of known definitions', () => {
    const state = collectItem(collectItem(EMPTY_COLLECTION, plant.id), mascot.id)
    expect(getCollectionLog(state).map(item => item.id)).toEqual([plant.id, mascot.id])
  })
})

describe('plantItem', () => {
  it('places a collected plant into a free slot', () => {
    const state = collectItem(EMPTY_COLLECTION, plant.id)
    const planted = plantItem(state, plant.id, 1)
    expect(getPlantedInSlot(planted, 1)?.collectibleId).toBe(plant.id)
  })

  it('refuses mascots and uncollected plants', () => {
    expect(plantItem(collectItem(EMPTY_COLLECTION, mascot.id), mascot.id, 0).planted).toHaveLength(0)
    expect(plantItem(EMPTY_COLLECTION, plant.id, 0).planted).toHaveLength(0)
  })

  it('refuses occupied or out-of-range slots and duplicates', () => {
    const state = plantItem(collectItem(EMPTY_COLLECTION, plant.id), plant.id, 0)
    expect(plantItem(state, mascot.id, 0).planted).toHaveLength(1)
    expect(plantItem(state, plant.id, MAX_PLANT_SLOTS).planted).toHaveLength(1)
    expect(plantItem(state, plant.id, 1).planted).toHaveLength(1)
  })
})

describe('uprootPlant', () => {
  it('frees the slot but keeps the log entry', () => {
    const state = plantItem(collectItem(EMPTY_COLLECTION, plant.id), plant.id, 2)
    const uprooted = uprootPlant(state, 2)
    expect(getPlantedInSlot(uprooted, 2)).toBeUndefined()
    expect(isCollected(uprooted, plant.id)).toBe(true)
  })
})