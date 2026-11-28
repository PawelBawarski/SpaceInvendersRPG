import { beforeEach, describe, expect, it } from 'vitest'
import { COLLECTIBLES } from '../domain/collectibles'
import {
  createEmptyMissionProgress,
  collectCollectible,
  plantCollectible,
  uprootCollectible,
  loadMissionProgress,
  saveMissionProgress,
  type MissionProgress,
} from './missionProgress'

const plant = COLLECTIBLES.find(item => item.kind === 'plant')!

describe('collection progress', () => {
  let progress: MissionProgress
  beforeEach(() => {
    localStorage.clear()
    progress = createEmptyMissionProgress()
  })

  it('collects and plants through progress helpers', () => {
    progress = collectCollectible(progress, plant.id)
    expect(progress.collection?.collected).toContain(plant.id)
    progress = plantCollectible(progress, plant.id, 0)
    expect(progress.collection?.planted[0]?.collectibleId).toBe(plant.id)
    progress = uprootCollectible(progress, 0)
    expect(progress.collection?.planted).toHaveLength(0)
    expect(progress.collection?.collected).toContain(plant.id)
  })

  it('ignores duplicate collection (returns same reference)', () => {
    progress = collectCollectible(progress, plant.id)
    expect(collectCollectible(progress, plant.id)).toBe(progress)
  })

  it('persists and reloads the collection', () => {
    progress = plantCollectible(collectCollectible(progress, plant.id), plant.id, 1)
    saveMissionProgress(progress)
    const loaded = loadMissionProgress()
    expect(loaded.collection?.collected).toContain(plant.id)
    expect(loaded.collection?.planted[0]?.slot).toBe(1)
  })

  it('drops invalid persisted collection data', () => {
    localStorage.setItem('neon-void:mission-progress:v1', JSON.stringify({
      ...createEmptyMissionProgress(),
      collection: { collected: ['ghost', plant.id], planted: [{ collectibleId: 'ghost', slot: 99 }, { collectibleId: plant.id, slot: 2 }] },
    }))
    const loaded = loadMissionProgress()
    expect(loaded.collection?.collected).toEqual([plant.id])
    expect(loaded.collection?.planted).toEqual([{ collectibleId: plant.id, slot: 2 }])
  })
})