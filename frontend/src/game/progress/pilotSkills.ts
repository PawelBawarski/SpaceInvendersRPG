import { localizedText } from '../i18n'
export const PILOT_SKILLS = [
  { id: 'flight-trim', track: 'flight', level: 2, requires: null, name: localizedText(text => text.pilotSkills.flightTrim), detail: localizedText(text => text.pilotSkills.flightTrimDetail) },
  { id: 'vector-dodge', track: 'flight', level: 3, requires: 'flight-trim', name: localizedText(text => text.pilotSkills.vectorDodge), detail: localizedText(text => text.pilotSkills.vectorDodgeDetail) },
  { id: 'overdrive', track: 'flight', level: 5, requires: 'flight-trim', name: localizedText(text => text.pilotSkills.overdrive), detail: localizedText(text => text.pilotSkills.overdriveDetail) },
  { id: 'targeting', track: 'combat', level: 2, requires: null, name: localizedText(text => text.pilotSkills.targeting), detail: localizedText(text => text.pilotSkills.targetingDetail) },
  { id: 'impact-bracing', track: 'combat', level: 4, requires: 'targeting', name: localizedText(text => text.pilotSkills.impactBracing), detail: localizedText(text => text.pilotSkills.impactBracingDetail) },
  { id: 'long-scan', track: 'systems', level: 2, requires: null, name: localizedText(text => text.pilotSkills.longScan), detail: localizedText(text => text.pilotSkills.longScanDetail) },
  { id: 'field-repair', track: 'systems', level: 3, requires: 'long-scan', name: localizedText(text => text.pilotSkills.fieldRepair), detail: localizedText(text => text.pilotSkills.fieldRepairDetail) },
] as const

export type PilotSkill = (typeof PILOT_SKILLS)[number]
export type PilotSkillId = PilotSkill['id']
export const OVERDRIVE = { duration: 3, cooldown: 14, speedMultiplier: 1.35 } as const

export function availableSkillPoints(level: number, learned: readonly PilotSkillId[]) {
  return Math.max(0, level - 1 - learned.length)
}

export function canLearnPilotSkill(skill: PilotSkill, level: number, learned: readonly PilotSkillId[]) {
  return !learned.includes(skill.id) && level >= skill.level && availableSkillPoints(level, learned) > 0
    && (skill.requires === null || learned.includes(skill.requires))
}

export function readPilotSkills(value: unknown, level: number): PilotSkillId[] {
  if (!Array.isArray(value)) return []
  const learned: PilotSkillId[] = []
  for (const skill of PILOT_SKILLS) {
    if (value.includes(skill.id) && canLearnPilotSkill(skill, level, learned)) learned.push(skill.id)
  }
  return learned
}
