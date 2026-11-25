import type { FactionId, ShipArchetype } from './worldFactions'

const TACTICS: Record<ShipArchetype, { distance: number; strafe: number; lift: number; shield: number; mass: number }> = {
  scout: { distance: .48, strafe: .52, lift: .17, shield: 0, mass: .75 },
  interceptor: { distance: .56, strafe: .94, lift: .31, shield: .18, mass: 1 },
  bomber: { distance: .72, strafe: .3, lift: .16, shield: .24, mass: 1.45 },
  frigate: { distance: .79, strafe: .18, lift: .04, shield: .34, mass: 2.3 },
}

export const ENEMY_SHIELD_DELAY = 4.8
export const SHIP_CONTACT_COOLDOWN = .72
export const PLAYER_CONTACT_RADIUS = 2.35

export function getEnemyShieldCapacity(archetype: ShipArchetype, faction: FactionId, hull: number) {
  const protectedHull = archetype === 'frigate' || (archetype === 'bomber' && faction !== 'nacre')
    || (archetype === 'interceptor' && faction === 'null-cult')
  return protectedHull ? Math.round(hull * TACTICS[archetype].shield) : 0
}

export function getEnemyManeuver(archetype: ShipArchetype, distance: number, range: number, beat: number, recentlyHit: boolean) {
  const tactics = TACTICS[archetype]
  const ratio = distance / Math.max(1, range)
  const orbitDirection = Math.cos(beat * .43) < 0 ? -1 : 1
  const bombingRun = archetype === 'bomber' && Math.sin(beat * .65) > .35
  const standoff = tactics.distance - (bombingRun ? .24 : 0)
  return {
    advance: Math.max(-1, Math.min(1, (ratio - standoff) * 3.2)),
    strafe: orbitDirection * tactics.strafe * (ratio > 1.1 ? .5 : 1) * (recentlyHit && archetype === 'interceptor' ? 1.5 : 1),
    lift: Math.sin(beat * 1.45) * tactics.lift,
  }
}

export function getShipContactDamage(speed: number, archetype: ShipArchetype, boss: boolean) {
  const impact = Math.min(310, Math.max(0, Number.isFinite(speed) ? speed : 0))
  return {
    player: Math.round((8 + impact * .12) * (boss ? 2.35 : TACTICS[archetype].mass)),
    enemy: boss ? 0 : Math.round((8 + impact * .25) / Math.sqrt(TACTICS[archetype].mass)),
  }
}
