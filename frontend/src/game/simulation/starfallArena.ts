import { BOSS_BLOCKADE_COUNT, damageBlockade, getWaveSize, getWaveSpawnInterval, isBossVulnerable } from './starfallBoss'

/** Space-Invaders style boss arena: move horizontally, shoot the three blockades, then the core. */
export const ARENA = {
  halfWidth: 60,
  playerZ: 0,
  bossZ: 120,
  playerSpeed: 70,
  projectileSpeed: 170,
  enemySpeed: 34,
  blockadeZ: 92,
  blockadeSpread: 46,
  coreRadius: 12,
  hitRadius: 9,
  fireCooldown: 0.18,
  coreHealth: 12,
} as const

export interface ArenaInput {
  /** -1..1 horizontal movement. */
  moveX: number
  fire: boolean
}

export interface ArenaEnemy {
  id: number
  x: number
  z: number
}

export interface ArenaProjectile {
  id: number
  x: number
  z: number
}

export interface StarfallArena {
  playerX: number
  blockadesDestroyed: number
  coreHealth: number
  enemies: ArenaEnemy[]
  projectiles: ArenaProjectile[]
  waveTimer: number
  fireCooldown: number
  nextId: number
  won: boolean
  lost: boolean
}

export function blockadeX(index: number): number {
  return (index - (BOSS_BLOCKADE_COUNT - 1) / 2) * ARENA.blockadeSpread
}

export function createArena(): StarfallArena {
  return {
    playerX: 0,
    blockadesDestroyed: 0,
    coreHealth: ARENA.coreHealth,
    enemies: [],
    projectiles: [],
    waveTimer: getWaveSpawnInterval(0),
    fireCooldown: 0,
    nextId: 1,
    won: false,
    lost: false,
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Pure single tick. Returns a new state; never mutates the input. */
export function stepArena(state: StarfallArena, input: ArenaInput, seconds: number): StarfallArena {
  if (state.won || state.lost) return state
  const dt = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  let nextId = state.nextId
  const playerX = clamp(state.playerX + clamp(input.moveX, -1, 1) * ARENA.playerSpeed * dt, -ARENA.halfWidth, ARENA.halfWidth)

  let fireCooldown = Math.max(0, state.fireCooldown - dt)
  const projectiles = state.projectiles.map(p => ({ ...p, z: p.z + ARENA.projectileSpeed * dt }))
  if (input.fire && fireCooldown <= 0) {
    projectiles.push({ id: nextId++, x: playerX, z: ARENA.playerZ + 4 })
    fireCooldown = ARENA.fireCooldown
  }

  let waveTimer = state.waveTimer - dt
  const enemies = state.enemies.map(enemy => ({ ...enemy, z: enemy.z - ARENA.enemySpeed * dt }))
  if (waveTimer <= 0) {
    const count = getWaveSize(state.blockadesDestroyed)
    for (let index = 0; index < count; index += 1) {
      const spread = count > 1 ? (index / (count - 1) - 0.5) * ARENA.halfWidth * 1.6 : 0
      enemies.push({ id: nextId++, x: spread, z: ARENA.bossZ - 6 })
    }
    waveTimer = getWaveSpawnInterval(state.blockadesDestroyed)
  }

  let blockadesDestroyed = state.blockadesDestroyed
  let coreHealth = state.coreHealth
  const survivingProjectiles: ArenaProjectile[] = []
  for (const projectile of projectiles) {
    let consumed = false
    if (!isBossVulnerable(blockadesDestroyed)) {
      for (let index = blockadesDestroyed; index < BOSS_BLOCKADE_COUNT; index += 1) {
        if (Math.abs(projectile.z - ARENA.blockadeZ) <= ARENA.hitRadius && Math.abs(projectile.x - blockadeX(index)) <= ARENA.hitRadius) {
          blockadesDestroyed = damageBlockade(blockadesDestroyed)
          consumed = true
          break
        }
      }
    } else if (Math.abs(projectile.z - ARENA.bossZ) <= ARENA.coreRadius && Math.abs(projectile.x) <= ARENA.coreRadius) {
      coreHealth = Math.max(0, coreHealth - 1)
      consumed = true
    }
    if (!consumed) {
      const hitEnemy = enemies.findIndex(enemy => Math.abs(projectile.z - enemy.z) <= ARENA.hitRadius && Math.abs(projectile.x - enemy.x) <= ARENA.hitRadius)
      if (hitEnemy >= 0) { enemies.splice(hitEnemy, 1); consumed = true }
    }
    if (!consumed && projectile.z <= ARENA.bossZ + ARENA.coreRadius) survivingProjectiles.push(projectile)
  }

  const lost = enemies.some(enemy => enemy.z <= ARENA.playerZ + 4)
  const won = coreHealth <= 0
  return {
    playerX, blockadesDestroyed, coreHealth,
    enemies: lost ? [] : enemies,
    projectiles: survivingProjectiles,
    waveTimer, fireCooldown, nextId, won, lost,
  }
}