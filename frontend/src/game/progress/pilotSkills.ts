export const PILOT_SKILLS = [
  { id: 'flight-trim', track: 'flight', level: 2, requires: null, name: { pl: 'Precyzyjne stery', en: 'Flight trim' }, detail: { pl: '+14% zwrotności', en: '+14% handling' } },
  { id: 'vector-dodge', track: 'flight', level: 3, requires: 'flight-trim', name: { pl: 'Unik wektorowy', en: 'Vector dodge' }, detail: { pl: 'Unik odnowi się o 25% szybciej', en: '25% shorter dodge cooldown' } },
  { id: 'overdrive', track: 'flight', level: 5, requires: 'flight-trim', name: { pl: 'Przeciążenie napędu', en: 'Drive overcharge' }, detail: { pl: '+35% maksymalnej prędkości na 3 s. Odnowienie 14 s', en: '+35% top speed for 3 s. Cooldown 14 s' } },
  { id: 'targeting', track: 'combat', level: 2, requires: null, name: { pl: 'Korekta ognia', en: 'Fire correction' }, detail: { pl: '+8% obrażeń uzbrojenia', en: '+8% weapon damage' } },
  { id: 'impact-bracing', track: 'combat', level: 4, requires: 'targeting', name: { pl: 'Manewr osłonowy', en: 'Impact bracing' }, detail: { pl: '+10% odporności kinetycznej', en: '+10% kinetic resistance' } },
  { id: 'long-scan', track: 'systems', level: 2, requires: null, name: { pl: 'Daleki nasłuch', en: 'Long scan' }, detail: { pl: '+40% zasięgu radaru', en: '+40% radar range' } },
  { id: 'field-repair', track: 'systems', level: 3, requires: 'long-scan', name: { pl: 'Wzmocnione poszycie', en: 'Reinforced plating' }, detail: { pl: '+14 HP kadłuba', en: '+14 hull HP' } },
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
