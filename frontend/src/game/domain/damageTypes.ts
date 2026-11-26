import { localizedText, type LocalizedText } from '../i18n'
export const DAMAGE_TYPES = ['kinetic', 'thermal', 'ion', 'radiation'] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]
/** Fractions: 0.2 absorbs twenty percent. No type can become fully immune. */
export type ResistanceProfile = Readonly<Partial<Record<DamageType, number>>>

export const MAX_DAMAGE_RESISTANCE = 0.85
export const DEFAULT_SHIP_RESISTANCES: ResistanceProfile = {
  kinetic: 0,
  thermal: 0,
  ion: 0,
  radiation: 0,
}

export const DAMAGE_TYPE_LABELS: Readonly<Record<DamageType, LocalizedText>> = {
  kinetic: localizedText(text => text.damageTypes.kinetic),
  thermal: localizedText(text => text.damageTypes.thermal),
  ion: localizedText(text => text.damageTypes.ion),
  radiation: localizedText(text => text.damageTypes.radiation),
}

export function getDamageResistance(type: DamageType, profile: ResistanceProfile = {}): number {
  const value = profile[type]
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_DAMAGE_RESISTANCE, value))
    : 0
}

export function applyDamageResistance(amount: number, type: DamageType, profile: ResistanceProfile = {}): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return amount * (1 - getDamageResistance(type, profile))
}
