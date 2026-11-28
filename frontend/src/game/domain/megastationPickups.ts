import { localizedText, type LocalizedText } from '../i18n'

export interface MegastationPickup {
  id: string
  x: number
  z: number
  label: LocalizedText
}

/** Salvage and trinkets scattered around the concourse and its side alcoves. */
export const MEGASTATION_PICKUPS: readonly MegastationPickup[] = [
  { id: 'bastion-credit-chip', x: -10.5, z: -14, label: localizedText((_t, l) => l === 'pl' ? 'Żeton kredytowy' : 'Credit chip') },
  { id: 'bastion-ore-cache', x: 10.5, z: -6, label: localizedText((_t, l) => l === 'pl' ? 'Skrzynia rud' : 'Ore cache') },
  { id: 'bastion-data-slate', x: -10.5, z: 6, label: localizedText((_t, l) => l === 'pl' ? 'Slab danych' : 'Data slate') },
  { id: 'bastion-relic', x: 10.5, z: 14, label: localizedText((_t, l) => l === 'pl' ? 'Relikt kultu' : 'Cult relic') },
]

export const MEGASTATION_PICKUP_RANGE = 2.4

export function findNearbyPickup(
  position: { x: number; z: number },
  collectedIds: readonly string[],
  range = MEGASTATION_PICKUP_RANGE,
): MegastationPickup | null {
  let best: MegastationPickup | null = null
  let bestDistance = range
  for (const pickup of MEGASTATION_PICKUPS) {
    if (collectedIds.includes(pickup.id)) continue
    const distance = Math.hypot(position.x - pickup.x, position.z - pickup.z)
    if (distance <= bestDistance) {
      bestDistance = distance
      best = pickup
    }
  }
  return best
}