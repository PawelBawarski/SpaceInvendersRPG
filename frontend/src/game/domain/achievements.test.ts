import { describe, expect, it } from 'vitest'
import { evaluateAchievements } from './achievements'
import { createEmptyMissionProgress, refreshAchievements } from '../progress/missionProgress'
import { COLLECTIBLES } from './collectibles'

describe('evaluateAchievements', () => {
  it('unlocks first-contact after a drone kill and reports it as new', () => {
    const progress = { ...createEmptyMissionProgress(), defeatedDrones: ['drone-a'] }
    const result = evaluateAchievements(progress, [])
    expect(result.unlocked).toContain('first-contact')
    expect(result.newly.map(item => item.id)).toContain('first-contact')
  })

  it('does not re-report already unlocked achievements', () => {
    const progress = { ...createEmptyMissionProgress(), defeatedDrones: ['drone-a'] }
    const result = evaluateAchievements(progress, ['first-contact'])
    expect(result.newly).toHaveLength(0)
  })

  it('unlocks curator only when every collectible is owned', () => {
    const partial = { ...createEmptyMissionProgress(), collection: { collected: [COLLECTIBLES[0].id], planted: [] } }
    expect(evaluateAchievements(partial, []).unlocked).not.toContain('curator')
    const full = { ...createEmptyMissionProgress(), collection: { collected: COLLECTIBLES.map(item => item.id), planted: [] } }
    expect(evaluateAchievements(full, []).unlocked).toContain('curator')
  })
})

describe('refreshAchievements', () => {
  it('persists unlocks and is idempotent', () => {
    const progress = { ...createEmptyMissionProgress(), visitedPlanets: ['a', 'b', 'c', 'd', 'e'] }
    const once = refreshAchievements(progress)
    expect(once.achievements).toContain('explorer')
    expect(refreshAchievements(once)).toBe(once)
  })

  it('returns the same reference when nothing new is earned', () => {
    const empty = createEmptyMissionProgress()
    expect(refreshAchievements(empty)).toBe(empty)
  })
})