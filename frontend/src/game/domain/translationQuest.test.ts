import { describe, expect, it } from 'vitest'
import { getTranslationQuestStatus, isTranslationQuestComplete, TRANSLATION_PARTS_REQUIRED } from './translationQuest'

describe('translation quest', () => {
  it('clamps parts and reports completion at the required count', () => {
    expect(TRANSLATION_PARTS_REQUIRED).toBe(3)
    expect(getTranslationQuestStatus(0, false).repaired).toBe(false)
    expect(getTranslationQuestStatus(2, false).repaired).toBe(false)
    expect(getTranslationQuestStatus(3, false).repaired).toBe(true)
    expect(getTranslationQuestStatus(99, false).parts).toBe(TRANSLATION_PARTS_REQUIRED)
    expect(getTranslationQuestStatus(-5, false).parts).toBe(0)
    expect(isTranslationQuestComplete(3, false)).toBe(true)
    expect(isTranslationQuestComplete(1, true)).toBe(true)
    expect(isTranslationQuestComplete(1, false)).toBe(false)
  })
})