import { describe, expect, it } from 'vitest'
import {
  BOSS_BLOCKADE_COUNT,
  BOSS_WAVE_MIN_INTERVAL,
  damageBlockade,
  getWaveSize,
  getWaveSpawnInterval,
  isBlockadeActive,
  isBossVulnerable,
} from './starfallBoss'

describe('starfall boss state', () => {
  it('keeps blockades active until all are destroyed', () => {
    expect(isBlockadeActive(0)).toBe(true)
    expect(isBlockadeActive(BOSS_BLOCKADE_COUNT - 1)).toBe(true)
    expect(isBlockadeActive(BOSS_BLOCKADE_COUNT)).toBe(false)
  })

  it('exposes the core only after the third blockade falls', () => {
    expect(isBossVulnerable(BOSS_BLOCKADE_COUNT - 1)).toBe(false)
    expect(isBossVulnerable(BOSS_BLOCKADE_COUNT)).toBe(true)
  })

  it('advances blockade damage but never past the total', () => {
    expect(damageBlockade(0)).toBe(1)
    expect(damageBlockade(BOSS_BLOCKADE_COUNT)).toBe(BOSS_BLOCKADE_COUNT)
  })

  it('spawns faster and larger waves as blockades fall, within bounds', () => {
    expect(getWaveSpawnInterval(0)).toBeGreaterThan(getWaveSpawnInterval(BOSS_BLOCKADE_COUNT))
    expect(getWaveSpawnInterval(BOSS_BLOCKADE_COUNT)).toBeGreaterThanOrEqual(BOSS_WAVE_MIN_INTERVAL)
    expect(getWaveSize(BOSS_BLOCKADE_COUNT)).toBeGreaterThan(getWaveSize(0))
  })
})