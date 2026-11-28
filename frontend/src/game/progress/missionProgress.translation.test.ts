import { describe, expect, it } from 'vitest'
import { createEmptyMissionProgress, investigateSignal } from './missionProgress'
import { TRANSLATION_PARTS_REQUIRED } from '../domain/translationQuest'

describe('translation module quest', () => {
  it('yields one part per new signal and ignores duplicates', () => {
    let progress = createEmptyMissionProgress()
    progress = investigateSignal(progress, 'signal-derelict-01')
    expect(progress.translationParts).toBe(1)
    expect(progress.investigatedSignals).toContain('signal-derelict-01')
    expect(investigateSignal(progress, 'signal-derelict-01')).toBe(progress)
  })

  it('repairs the module at the required parts and rewards once', () => {
    let progress = createEmptyMissionProgress()
    const ids = ['a', 'b', 'c']
    for (const id of ids) progress = investigateSignal(progress, id)
    expect(progress.translationParts).toBe(TRANSLATION_PARTS_REQUIRED)
    expect(progress.translationRepaired).toBe(true)
    expect(progress.credits).toBe(500)
    // Further investigation is a no-op after repair.
    expect(investigateSignal(progress, 'd')).toBe(progress)
    expect(progress.credits).toBe(500)
  })
})