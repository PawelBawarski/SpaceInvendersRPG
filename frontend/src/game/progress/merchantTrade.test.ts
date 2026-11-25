import { describe, expect, it } from 'vitest'
import { buyMerchantPart, getMerchantStock, MERCHANT_MATERIALS, tradeMerchantMaterial } from './merchantTrade'
import { createEmptyMissionProgress, loadMissionProgress, saveMissionProgress } from './missionProgress'

describe('merchant trade', () => {
  it('preserves sold offers and prevents duplicate purchases after loading', () => {
    const progress = { ...createEmptyMissionProgress(), sectorId: 'vesper' as const, credits: 3000 }
    const { part, price } = getMerchantStock(progress)[0]
    const bought = buyMerchantPart(progress, part.id)
    expect(bought.shipParts).toEqual([part])
    expect(bought.credits).toBe(3000 - price)
    saveMissionProgress(bought)
    const loaded = loadMissionProgress()
    expect(loaded.sectorId).toBe('vesper')
    expect(buyMerchantPart(loaded, part.id)).toBe(loaded)
    expect(getMerchantStock({ ...loaded, sectorId: 'orion-7' })[0].sold).toBe(false)
    localStorage.clear()
  })

  it('checks balances and cargo for each material transaction', () => {
    const material = MERCHANT_MATERIALS[1]
    const empty = createEmptyMissionProgress()
    expect(tradeMerchantMaterial(empty, material.key, 'buy')).toBe(empty)
    expect(tradeMerchantMaterial(empty, material.key, 'sell')).toBe(empty)
    const progress = { ...empty, credits: material.buy }
    const bought = tradeMerchantMaterial(progress, material.key, 'buy')
    expect(bought).toMatchObject({ credits: 0, copper: 1 })
    expect(tradeMerchantMaterial(bought, material.key, 'sell')).toMatchObject({ credits: material.sell, copper: 0 })
  })
})
