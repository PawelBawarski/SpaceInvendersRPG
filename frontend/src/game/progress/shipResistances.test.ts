import { beforeEach, describe, expect, it } from 'vitest'
import { createRandomShipPart, parseShipParts, type ShipPart } from './shipParts'
import { createEmptyMissionProgress, equipShipPart, getShipBonuses, getShipResistances, loadMissionProgress, saveMissionProgress, unequipShipPart } from './missionProgress'

beforeEach(() => localStorage.clear())

const legacyPart: ShipPart = {
  id: 'old-engine', slot: 'engine', rarity: 'standard',
  stats: { damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 5 },
}

describe('module damage resistances', () => {
  it('keeps legacy equipment and its bonuses unchanged', () => {
    const old = { ...createEmptyMissionProgress(), shipParts: [legacyPart], equippedParts: { weapon: null, shield: null, engine: legacyPart.id } }
    saveMissionProgress(old)
    const loaded = loadMissionProgress()
    expect(loaded.shipParts).toEqual([legacyPart])
    expect(getShipBonuses(loaded)).toEqual({ damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 5 })
    expect(getShipResistances(loaded)).toEqual({ kinetic: 0, thermal: 0, ion: 0, radiation: 0 })
  })

  it('gives new shields and engines type-specific resistance that scales with rarity', () => {
    const expected = [
      { roll: 0.1, shield: { kinetic: 0.05, ion: 0.08 }, engine: { thermal: 0.08, radiation: 0.03 } },
      { roll: 0.8, shield: { kinetic: 0.1, ion: 0.16 }, engine: { thermal: 0.16, radiation: 0.06 } },
      { roll: 0.99, shield: { kinetic: 0.15, ion: 0.24 }, engine: { thermal: 0.24, radiation: 0.09 } },
    ]
    for (const profile of expected) {
      expect(createRandomShipPart('shield', () => profile.roll, 'shield').resistances).toEqual(profile.shield)
      expect(createRandomShipPart('engine', () => profile.roll, 'engine').resistances).toEqual(profile.engine)
      expect(createRandomShipPart('weapon', () => profile.roll, 'weapon').resistances).toBeUndefined()
    }
  })

  it('only grants the resistances of equipped modules and persists them across saves', () => {
    const shield = createRandomShipPart('blue-shield', () => 0.8, 'shield')
    const engine = createRandomShipPart('purple-engine', () => 0.99, 'engine')
    let progress = { ...createEmptyMissionProgress(), experience: 850, shipParts: [shield, engine] }
    expect(getShipResistances(progress)).toEqual({ kinetic: 0, thermal: 0, ion: 0, radiation: 0 })
    progress = equipShipPart(equipShipPart(progress, shield.id), engine.id)
    expect(getShipResistances(progress)).toEqual({ kinetic: 0.1, thermal: 0.24, ion: 0.16, radiation: 0.09 })
    saveMissionProgress(progress)
    const loaded = loadMissionProgress()
    expect(getShipResistances(loaded)).toEqual(getShipResistances(progress))
    expect(getShipResistances(unequipShipPart(loaded, 'engine'))).toEqual({ kinetic: 0.1, thermal: 0, ion: 0.16, radiation: 0 })
  })

  it('sanitizes only recognized finite resistance types without discarding an otherwise valid part', () => {
    const parsed = parseShipParts([
      { ...legacyPart, resistances: { thermal: 2, kinetic: -3, ion: NaN, radiation: '0.5', plasma: 0.8 } },
      { ...legacyPart, id: 'bad-profile', resistances: ['thermal', 0.5] },
    ])
    expect(parsed).toHaveLength(2)
    expect(parsed[0].resistances).toEqual({ thermal: 0.85, kinetic: 0 })
    expect(parsed[1].resistances).toBeUndefined()
  })

  it('caps stacked equipment resistance below immunity', () => {
    const shield = { ...legacyPart, id: 'shield', slot: 'shield' as const, resistances: { thermal: 0.8 } }
    const engine = { ...legacyPart, resistances: { thermal: 0.8 } }
    const progress = {
      ...createEmptyMissionProgress(), shipParts: [shield, engine],
      equippedParts: { weapon: null, shield: shield.id, engine: engine.id },
    }
    expect(getShipResistances(progress).thermal).toBe(0.85)
  })
})
