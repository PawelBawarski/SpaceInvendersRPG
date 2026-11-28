import { localizedText, type LocalizedText } from '../i18n'

export interface ShipTier {
  id: string
  name: LocalizedText
  tier: number
  price: number
  requiredLevel: number
  blurb: LocalizedText
}

/** Ordered from the starter hull up to the top tier; nothing but the starter is owned at first. */
export const SHIP_TIERS: readonly ShipTier[] = [
  {
    id: 'starter',
    name: localizedText((_t, l) => l === 'pl' ? 'Wrak z powierzchni' : 'Surface Wreck'),
    tier: 1,
    price: 0,
    requiredLevel: 1,
    blurb: localizedText((_t, l) => l === 'pl' ? 'Zlepiony z tego, co zostało po katastrofie.' : 'Cobbled together from the crash.'),
  },
  {
    id: 'kestrel',
    name: localizedText((_t, l) => l === 'pl' ? 'Kretel' : 'Kestrel'),
    tier: 2,
    price: 1500,
    requiredLevel: 3,
    blurb: localizedText((_t, l) => l === 'pl' ? 'Zwinny myśliwiec patrolowy.' : 'Nimble patrol fighter.'),
  },
  {
    id: 'vanguard',
    name: localizedText((_t, l) => l === 'pl' ? 'Strażnik' : 'Vanguard'),
    tier: 3,
    price: 4000,
    requiredLevel: 6,
    blurb: localizedText((_t, l) => l === 'pl' ? 'Ciężki okręt bojowy z pancerzem.' : 'Heavy gunship with armor.'),
  },
  {
    id: 'sovereign',
    name: localizedText((_t, l) => l === 'pl' ? 'Suweren' : 'Sovereign'),
    tier: 4,
    price: 9000,
    requiredLevel: 10,
    blurb: localizedText((_t, l) => l === 'pl' ? 'Flagowiec zdolny stawić czoła Pożeraczowi.' : 'Flagship able to face the Devourer.'),
  },
]

export const STARTER_SHIP_ID = 'starter'

export function getShipTier(id: string): ShipTier {
  const tier = SHIP_TIERS.find(ship => ship.id === id)
  if (!tier) throw new Error('Unknown ship tier: ' + id)
  return tier
}

/** A tier unlocks only when the previous tier is owned (the starter is always owned). */
export function isShipTierUnlocked(tier: ShipTier, ownedShipIds: readonly string[]): boolean {
  if (tier.tier <= 1 || ownedShipIds.includes(tier.id)) return true
  const previous = SHIP_TIERS.find(ship => ship.tier === tier.tier - 1)
  return previous ? ownedShipIds.includes(previous.id) : false
}

export function isShipTierLevelOk(tier: ShipTier, pilotLevel: number): boolean {
  return pilotLevel >= tier.requiredLevel
}

export function canPurchaseShip(tier: ShipTier, credits: number, pilotLevel: number, ownedShipIds: readonly string[]): boolean {
  return !ownedShipIds.includes(tier.id)
    && isShipTierUnlocked(tier, ownedShipIds)
    && isShipTierLevelOk(tier, pilotLevel)
    && credits >= tier.price
}