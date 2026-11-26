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
export const RETREAT_HULL_FRACTION = .30
export const BOSS_RAGE_HULL_FRACTION = .45

type FirePattern = 'aimed' | 'fan' | 'burst' | 'spiral'

export function getEnemyShieldCapacity(archetype: ShipArchetype, faction: FactionId, hull: number) {
  const protectedHull = archetype === 'frigate' || (archetype === 'bomber' && faction !== 'nacre')
    || (archetype === 'interceptor' && faction === 'null-cult')
  return protectedHull ? Math.round(hull * TACTICS[archetype].shield) : 0
}

export function getEnemyManeuver(archetype: ShipArchetype, distance: number, range: number, beat: number, recentlyHit: boolean, hullFraction = 1) {
  const tactics = TACTICS[archetype]
  const ratio = distance / Math.max(1, range)
  const orbitDirection = Math.cos(beat * .43) < 0 ? -1 : 1
  if (hullFraction <= RETREAT_HULL_FRACTION) {
    return { advance: -1, strafe: orbitDirection * (.25 + tactics.strafe * .5), lift: Math.sin(beat * 1.9) * .35, retreating: true }
  }
  const bombingRun = archetype === 'bomber' && Math.sin(beat * .65) > .35
  const standoff = tactics.distance - (bombingRun ? .24 : 0)
  return {
    advance: Math.max(-1, Math.min(1, (ratio - standoff) * 3.2)),
    strafe: orbitDirection * tactics.strafe * (ratio > 1.1 ? .5 : 1) * (recentlyHit && archetype === 'interceptor' ? 1.5 : 1),
    lift: Math.sin(beat * 1.45) * tactics.lift,
    retreating: false,
  }
}

export function getBossManeuver(pattern: FirePattern, beat: number, distance: number, range: number, hullFraction: number) {
  const enraged = hullFraction <= BOSS_RAGE_HULL_FRACTION
  const pace = enraged ? 1.35 : 1
  const ratio = distance / Math.max(1, range)
  switch (pattern) {
    case 'fan': // Broadside, with long arcs interrupted by a change of flank.
      return { advance: ratio > (enraged ? .38 : .54) ? .5 : 0, strafe: Math.cos(beat * .47) * .95, lift: Math.sin(beat) * .12, pace }
    case 'burst': // Repeated charges and hard banks across the bow.
      return { advance: Math.sin(beat * 1.1) > -.15 || ratio > .7 ? 1 : .12, strafe: Math.cos(beat * 1.1) * .82, lift: Math.sin(beat * .8) * .26, pace }
    case 'spiral': // Circle in three dimensions to change the firing plane.
      return { advance: ratio > (enraged ? .34 : .46) ? .65 : .06, strafe: .82, lift: Math.sin(beat * 1.44) * .68, pace }
    default:
      return { advance: ratio > (enraged ? .26 : .42) ? .85 : .08, strafe: Math.sin(beat * .71) * .71, lift: Math.cos(beat * .9) * .18, pace }
  }
}

export function getShipContactDamage(speed: number, archetype: ShipArchetype, boss: boolean) {
  const impact = Math.min(310, Math.max(0, Number.isFinite(speed) ? speed : 0))
  return {
    player: Math.round((8 + impact * .12) * (boss ? 2.35 : TACTICS[archetype].mass)),
    enemy: boss ? 0 : Math.round((8 + impact * .25) / Math.sqrt(TACTICS[archetype].mass)),
  }
}
