/** Pure boss-fight state for the three-blockade, wave-driven encounter. */
export const BOSS_BLOCKADE_COUNT = 3
export const BOSS_WAVE_BASE_INTERVAL = 6
export const BOSS_WAVE_MIN_INTERVAL = 2.5

/** A blockade is active while it has not been destroyed yet. */
export function isBlockadeActive(blockadesDestroyed: number): boolean {
  return blockadesDestroyed < BOSS_BLOCKADE_COUNT
}

/** The core is vulnerable only after all three blockades are down. */
export function isBossVulnerable(blockadesDestroyed: number): boolean {
  return blockadesDestroyed >= BOSS_BLOCKADE_COUNT
}

/** Destroying a blockade advances the count, capped at the total. */
export function damageBlockade(blockadesDestroyed: number): number {
  return Math.min(BOSS_BLOCKADE_COUNT, Math.max(0, blockadesDestroyed) + 1)
}

/** Waves get faster as blockades fall, down to a floor. */
export function getWaveSpawnInterval(blockadesDestroyed: number): number {
  const destroyed = Math.min(BOSS_BLOCKADE_COUNT, Math.max(0, blockadesDestroyed))
  return Math.max(BOSS_WAVE_MIN_INTERVAL, BOSS_WAVE_BASE_INTERVAL - destroyed * 1.2)
}

/** Number of drones in a wave — grows with each destroyed blockade. */
export function getWaveSize(blockadesDestroyed: number): number {
  const destroyed = Math.min(BOSS_BLOCKADE_COUNT, Math.max(0, blockadesDestroyed))
  return 3 + destroyed * 2
}