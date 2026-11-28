export const TRANSLATION_PARTS_REQUIRED = 3

export interface TranslationQuestState {
  parts: number
  required: number
  repaired: boolean
}

export function getTranslationQuestStatus(parts: number, repaired: boolean): TranslationQuestState {
  const clamped = Math.max(0, Math.min(TRANSLATION_PARTS_REQUIRED, Math.floor(parts)))
  return { parts: clamped, required: TRANSLATION_PARTS_REQUIRED, repaired: repaired || clamped >= TRANSLATION_PARTS_REQUIRED }
}

export function isTranslationQuestComplete(parts: number, repaired: boolean): boolean {
  return getTranslationQuestStatus(parts, repaired).repaired
}