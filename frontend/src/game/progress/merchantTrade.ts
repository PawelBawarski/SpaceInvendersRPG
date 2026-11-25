import { getGalaxy } from '../domain/galaxyChart'
import { canStoreShipPart, type MissionProgress } from './missionProgress'
import { createRandomShipPart, getShipPartSellValue, type ShipPartRarity, type ShipPartSlot } from './shipParts'

export const MERCHANT_MATERIALS = [
  { key: 'scrapMetal', buy: 95, sell: 42 },
  { key: 'copper', buy: 175, sell: 78 },
  { key: 'radioactiveResidue', buy: 440, sell: 195 },
  { key: 'meridianCore', buy: 1100, sell: 480 },
] as const

type MaterialKey = typeof MERCHANT_MATERIALS[number]['key']
const STOCK: readonly [ShipPartSlot, ShipPartRarity][] = [
  ['engine', 'standard'], ['weapon', 'standard'], ['shield', 'refined'],
  ['weapon', 'refined'], ['engine', 'prototype'], ['shield', 'prototype'],
  ['armor', 'standard'], ['reactor', 'refined'], ['scanner', 'prototype'],
]
const MINIMUM_PRICE = { standard: 240, refined: 570, prototype: 1150 }

export function getMerchantStock(progress: MissionProgress) {
  const galaxy = getGalaxy(progress.sectorId)
  return STOCK.map(([slot, rarity], index) => {
    const id = `exchange-ark:${galaxy.id}:${index}`
    let seed = (progress.worldSeed ^ galaxy.seedSalt ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0x100000000
    }
    const part = createRandomShipPart(id, random, slot, rarity)
    return { part, price: MINIMUM_PRICE[rarity] + getShipPartSellValue(part), sold: progress.purchasedMerchantOffers.includes(id) }
  })
}

export function buyMerchantPart(progress: MissionProgress, id: string): MissionProgress {
  const offer = getMerchantStock(progress).find(entry => entry.part.id === id)
  if (!offer || offer.sold || progress.credits < offer.price || !canStoreShipPart(progress)) return progress
  return {
    ...progress, credits: progress.credits - offer.price,
    shipParts: [...progress.shipParts, offer.part],
    purchasedMerchantOffers: [...progress.purchasedMerchantOffers, id],
  }
}

export function tradeMerchantMaterial(progress: MissionProgress, key: MaterialKey, action: 'buy' | 'sell'): MissionProgress {
  const material = MERCHANT_MATERIALS.find(entry => entry.key === key)!
  if (action === 'buy') {
    if (progress.credits < material.buy) return progress
    return { ...progress, credits: progress.credits - material.buy, [key]: progress[key] + 1 }
  }
  if (progress[key] < 1) return progress
  return { ...progress, credits: progress.credits + material.sell, [key]: progress[key] - 1 }
}
