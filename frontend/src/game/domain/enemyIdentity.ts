import { formatText, localizedText, type LocalizedText } from '../i18n'
import type { FactionId, ShipArchetype } from './worldFactions'

type LocalizedName = LocalizedText

const CLASSES: Record<ShipArchetype, LocalizedName> = {
  scout: localizedText(text => text.enemy.scout),
  interceptor: localizedText(text => text.enemy.interceptor),
  bomber: localizedText(text => text.enemy.bomber),
  frigate: localizedText(text => text.enemy.frigate),
  monster: localizedText((_text, language) => language === 'pl' ? 'Potwór' : 'Monster'),
}
const CULTURES: Record<FactionId, LocalizedName> = {
  meridian: localizedText(text => text.enemy.meridian), nacre: localizedText(text => text.enemy.nacre),
  'null-cult': localizedText(text => text.enemy.nullCult), 'ashen-legion': localizedText(text => text.enemy.ashenLegion),
}
const BOSSES: Record<string, LocalizedName> = {
  warden: localizedText(text => text.enemy.warden),
  'signal-source': localizedText(text => text.enemy.signalSource),
  'null-choir': localizedText(text => text.enemy.nullChoir),
  'ashen-carrier': localizedText(text => text.enemy.ashenCarrier),
  'meridian-warlord': localizedText(text => text.enemy.meridianWarlord),
}
const shipNames = new Map<string, LocalizedName>()

function getShipName(faction: FactionId, archetype: ShipArchetype): LocalizedName {
  const key = faction + '/' + archetype
  const existing = shipNames.get(key)
  if (existing) return existing
  const name = localizedText((text, language) => formatText(text.enemy.namePatterns[faction], {
    className: CLASSES[archetype][language], factionName: CULTURES[faction][language],
  }))
  shipNames.set(key, name)
  return name
}

/** A stable threat level derived from the enemy's actual durability and weapon strength. */
export function getEnemyIdentity(faction: FactionId, archetype: ShipArchetype, health: number, shield: number, damage: number, bossId?: string) {
  return {
    name: (bossId && BOSSES[bossId]) || getShipName(faction, archetype),
    level: Math.max(1, Math.ceil((health + shield * 0.6) / 60 + damage * 0.25)),
    boss: bossId !== undefined,
  }
}
