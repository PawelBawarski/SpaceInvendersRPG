import { describe, expect, it } from 'vitest'
import { canPurchaseShip, isShipTierLevelOk, isShipTierUnlocked, SHIP_TIERS, STARTER_SHIP_ID, getShipTier } from '../domain/shipTiers'
import { createEmptyMissionProgress, purchaseShip, selectShip } from './missionProgress'

describe('ship tiers', () => {
  it('orders tiers and gates each behind the previous one', () => {
    expect(SHIP_TIERS[0].id).toBe(STARTER_SHIP_ID)
    const tier2 = getShipTier('kestrel')
    expect(isShipTierUnlocked(tier2, [STARTER_SHIP_ID])).toBe(true)
    expect(isShipTierUnlocked(tier2, [])).toBe(false)
    const tier3 = getShipTier('vanguard')
    expect(isShipTierUnlocked(tier3, [STARTER_SHIP_ID])).toBe(false)
    expect(isShipTierUnlocked(tier3, [STARTER_SHIP_ID, 'kestrel'])).toBe(true)
  })

  it('requires the pilot level and credits', () => {
    const tier2 = getShipTier('kestrel')
    expect(isShipTierLevelOk(tier2, 1)).toBe(false)
    expect(canPurchaseShip(tier2, tier2.price, tier2.requiredLevel, [STARTER_SHIP_ID])).toBe(true)
    expect(canPurchaseShip(tier2, tier2.price - 1, tier2.requiredLevel, [STARTER_SHIP_ID])).toBe(false)
  })

  it('buys a tier once, deducts credits and makes it active', () => {
    let progress = createEmptyMissionProgress()
    progress = { ...progress, credits: 5000, experience: 5000 }
    const tier2 = getShipTier('kestrel')
    const bought = purchaseShip(progress, 'kestrel')
    expect(bought.ownedShips).toContain('kestrel')
    expect(bought.activeShip).toBe('kestrel')
    expect(bought.credits).toBe(5000 - tier2.price)
    // Buying again is a no-op.
    expect(purchaseShip(bought, 'kestrel')).toBe(bought)
  })

  it('refuses locked or unaffordable tiers', () => {
    const progress = { ...createEmptyMissionProgress(), credits: 100000, experience: 100000 }
    expect(purchaseShip(progress, 'sovereign')).toBe(progress)
    expect(selectShip(progress, 'kestrel')).toBe(progress)
  })
})