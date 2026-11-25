import type { FactionId, ShipArchetype } from './worldFactions'

type LocalizedName = { pl: string; en: string }

const CLASSES: Record<ShipArchetype, LocalizedName> = {
  scout: { pl: 'Zwiadowca', en: 'Scout' },
  interceptor: { pl: 'Przechwytywacz', en: 'Interceptor' },
  bomber: { pl: 'Bombowiec', en: 'Bomber' },
  frigate: { pl: 'Fregata', en: 'Frigate' },
}
const CULTURES: Record<FactionId, LocalizedName> = {
  meridian: { pl: 'Meridian', en: 'Meridian' }, nacre: { pl: 'Nacre', en: 'Nacre' },
  'null-cult': { pl: 'Pustego Chóru', en: 'of the Null Choir' }, 'ashen-legion': { pl: 'Popiołu', en: 'of Ash' },
}
const BOSSES: Record<string, LocalizedName> = {
  warden: { pl: 'Strażnik Meridian', en: 'Meridian Warden' },
  'signal-source': { pl: 'Herold Echa', en: 'Echo Herald' },
  'null-choir': { pl: 'Pusty Chór', en: 'Null Choir' },
  'ashen-carrier': { pl: 'Nosiciel Popiołu', en: 'Ashen Carrier' },
  'meridian-warlord': { pl: 'Ostatni Admirał', en: 'Last Admiral' },
}

/** A stable threat level derived from the enemy's actual durability and weapon strength. */
export function getEnemyIdentity(faction: FactionId, archetype: ShipArchetype, health: number, shield: number, damage: number, bossId?: string) {
  const type = CLASSES[archetype]
  const culture = CULTURES[faction]
  return {
    name: (bossId && BOSSES[bossId]) || { pl: `${type.pl} ${culture.pl}`, en: culture.en.startsWith('of ') ? `${type.en} ${culture.en}` : `${culture.en} ${type.en}` },
    level: Math.max(1, Math.ceil((health + shield * 0.6) / 60 + damage * 0.25)),
    boss: bossId !== undefined,
  }
}
