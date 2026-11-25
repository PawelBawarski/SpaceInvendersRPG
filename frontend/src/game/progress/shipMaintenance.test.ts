import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMissionProgress, loadMissionProgress, saveMissionProgress } from './missionProgress'
import { getShieldRechargeCost, getShipVitals, rechargeShipShields, regenerateHangarHull, updateShipVitals } from './shipMaintenance'

beforeEach(() => localStorage.clear())

describe('hangar maintenance and persistent ship vitals', () => {
  it('restores damage without healing and accepts old saves without a vitals snapshot', () => {
    expect(getShipVitals(createEmptyMissionProgress())).toEqual({ hull: 100, shield: 100 })
    const damaged = updateShipVitals(createEmptyMissionProgress(), { hull: 42, shield: 17.5 })
    saveMissionProgress(damaged)
    expect(getShipVitals(loadMissionProgress())).toEqual({ hull: 42, shield: 17.5 })
  })

  it('repairs hull over time for free without charging shields or spending credits', () => {
    const progress = { ...createEmptyMissionProgress(), credits: 90, shipVitals: { hull: 40, shield: 20 } }
    const repaired = regenerateHangarHull(progress, 2)
    expect(repaired.shipVitals).toEqual({ hull: 60, shield: 20 })
    expect(repaired.credits).toBe(90)
    expect(regenerateHangarHull(repaired, 100).shipVitals).toEqual({ hull: 100, shield: 20 })
    expect(regenerateHangarHull(progress, NaN)).toBe(progress)
  })

  it('charges the displayed price exactly once and never repairs hull when paying for shields', () => {
    const damaged = { ...createEmptyMissionProgress(), credits: 100, shipVitals: { hull: 40, shield: 20 } }
    expect(getShieldRechargeCost(damaged)).toBe(40)
    const charged = rechargeShipShields(damaged)
    expect(charged.credits).toBe(60)
    expect(charged.shipVitals).toEqual({ hull: 40, shield: 100 })
    expect(getShieldRechargeCost(charged)).toBe(0)
    expect(rechargeShipShields(charged)).toBe(charged)
    expect(rechargeShipShields({ ...damaged, credits: 39 }).shipVitals).toEqual(damaged.shipVitals)
  })

  it('does not refill shields when increasing capacity or loading damaged saved equipment', () => {
    const progress = { ...createEmptyMissionProgress(), experience: 1000, credits: 100, shipVitals: { hull: 40, shield: 20 } }
    expect(getShipVitals(progress)).toEqual({ hull: 40, shield: 20 })
    expect(getShieldRechargeCost(progress)).toBe(50)
    expect(getShipVitals(rechargeShipShields(progress)).shield).toBe(120)
  })
})
