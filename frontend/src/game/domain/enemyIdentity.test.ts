import { describe, expect, it } from 'vitest'
import { getEnemyIdentity } from './enemyIdentity'
import { FACTIONS, SHIP_ARCHETYPES } from './worldFactions'
import { MISSIONS } from '../missions/definitions'

describe('enemy identification', () => {
  it('identifies every faction and class with a level tied to its combat strength', () => {
    for (const faction of Object.keys(FACTIONS) as Array<keyof typeof FACTIONS>) {
      for (const archetype of Object.keys(SHIP_ARCHETYPES) as Array<keyof typeof SHIP_ARCHETYPES>) {
        const profile = SHIP_ARCHETYPES[archetype]
        const identity = getEnemyIdentity(faction, archetype, profile.health, 0, profile.damage)
        expect(identity.name.pl.length).toBeGreaterThan(8)
        expect(identity.name.en.length).toBeGreaterThan(8)
        expect(Number.isInteger(identity.level)).toBe(true)
        expect(identity.level).toBeGreaterThan(0)
        expect(getEnemyIdentity(faction, archetype, profile.health * 2, 100, profile.damage * 2).level).toBeGreaterThan(identity.level)
      }
    }
  })

  it('gives every boss a personal name and a threat level', () => {
    const names = new Set<string>()
    for (const mission of MISSIONS) {
      if (!mission.bossProfile) continue
      const profile = mission.bossProfile
      const identity = getEnemyIdentity(mission.faction, 'frigate', profile.health, profile.shield, profile.damage, mission.id)
      expect(identity.boss).toBe(true)
      expect(identity.name.pl).not.toContain('Fregata')
      expect(identity.level).toBeGreaterThan(5)
      names.add(identity.name.pl)
    }
    expect(names.size).toBe(5)
  })
})
