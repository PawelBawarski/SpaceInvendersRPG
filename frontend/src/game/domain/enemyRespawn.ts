export const ROAMING_RESPAWN_SECONDS = 60

export function remainingRespawnSeconds(respawnAt: number | undefined, now = Date.now()): number {
  return respawnAt && Number.isFinite(respawnAt) ? Math.max(0, (respawnAt - now) / 1000) : 0
}
