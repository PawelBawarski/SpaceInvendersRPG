import { formatText, localizedText, type LocalizedText } from '../i18n'
import { buildPlanetDefenders } from '../domain/planetOrbit'
import { remainingRespawnSeconds, ROAMING_RESPAWN_SECONDS } from '../domain/enemyRespawn'
import { Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from './babylon'
import { FACTIONS, ORION_DRONES, ORION_PLANETS, ORION_SECTOR_ID, SHIP_ARCHETYPES, type DroneSite, type FactionId, type GalaxyWorld, type ShipArchetype } from '../domain/exploration'
import { getGalaxy, getZoneLevel } from '../domain/galaxyChart'
import { resolveBossDamage } from '../domain/combat'
import { getSignalPulseState } from '../domain/signalPulse'
import { applyArmorDamage, PLAYER_WEAPON, resolveWeaponHit } from '../domain/weapon'
import { buildMissionHostiles, isMissionComplete, isMissionUnlocked, MISSIONS, type MissionDefinition, type MissionId } from '../missions/definitions'
import type { MissionProgress } from '../progress/missionProgress'
import type { ShipPartBonuses, ShipPartRarity } from '../progress/shipParts'
import type { CombatImpactKind } from './CombatImpacts'
import { createDamageNumber, type FloatingDamageNumber } from './DamageNumber'
import { createFleetModelLibrary } from './WorldFleetVisual'
import { showHullDamage } from './HullDamage'
import { createSceneMaterial } from './sectorDepth'
import { segmentSphereContact } from './worldCombatMath'
import { segmentBoundsOverlapSphere } from './collisionBroadphase'
import { BOSS_VISUAL_SCALE, ENEMY_VISUAL_SCALE } from '../domain/enemyScale'
import type { DamageSource } from '../domain/damageFeedback'
import { getEnemyIdentity } from '../domain/enemyIdentity'
import { sampleFormationPosition, samplePatrolRoute, type PatrolFormation } from '../domain/patrolFormation'
import { SpatialIndex } from '../simulation/SpatialIndex'
import { steerAroundPlanets } from '../simulation/SpaceNavigation'
import { BOSS_BALANCE, BOSS_RAGE_HULL_FRACTION, ENEMY_SHIELD_DELAY, getBossManeuver, getEnemyArmor, getEnemyManeuver, getEnemyShieldCapacity, getShipContactDamage, PLAYER_CONTACT_RADIUS, scaleEnemyCombatStats, SHIP_CONTACT_COOLDOWN } from '../domain/enemyManeuvers'
import type { RadarTarget } from '../domain/flightRadar'

export interface EnemyNameplateTarget {
  id: string
  position: Vector3
  name: LocalizedText
  level: number
  boss: boolean
  hitRadius: number
  health: number
  maxHealth: number
  shield: number
  maxShield: number
  hitFlash: number
}

interface PatrolGroup {
  route: PatrolFormation
  center: Vector3
  forward: Vector3
  members: Actor[]
  alerted: boolean
}

interface Actor extends EnemyNameplateTarget {
  id: string
  position: Vector3
  previousPosition: Vector3
  origin: Vector3
  root: TransformNode | null
  site: DroneSite | null
  mission: MissionDefinition | null
  faction: FactionId
  archetype: ShipArchetype
  health: number
  maxHealth: number
  shield: number
  maxShield: number
  defeated: boolean
  fireClock: number
  respawn: number
  hitRadius: number
  lastHitAt: number
  lastContactAt: number
  lastPlayerSeenAt: number
  lastPlayerPosition: Vector3
  maneuverPhase: number
  maneuverSpeed?: number
  formationTarget: Vector3 | null
}

interface Bolt {
  mesh: Mesh
  velocity: Vector3
  remaining: number
  damage: number
  critical: boolean
  hostile: boolean
  source?: DamageSource
}

interface Pickup {
  mission: MissionDefinition
  index: number
  position: Vector3
  mesh: Mesh | null
  collected: boolean
}

export interface WorldCombatStatus {
  mission: MissionDefinition | null
  boss: { health: number; maximumHealth: number; shield: number; maximumShield: number; charging: boolean } | null
  completedObjectives: number
  requiredObjectives: number
  engaged: boolean
}

interface CombatCallbacks {
  getProgress: () => MissionProgress
  onPlayerHit: (amount: number, source?: DamageSource) => void
  onEnemyDefeated: (id: string, respawnAt?: number) => void
  onEnemyRespawn?: (id: string) => void
  onMissionComplete: (id: MissionId) => void
  onMissionProgress: (id: MissionId, count: number) => void
  onMessage: (message: LocalizedText) => void
  onShot: () => void
  onImpact: (position: Vector3, normal: Vector3, scale: number, kind: CombatImpactKind) => void
  onPlayerContact?: (safePosition: Vector3) => void
  onAimChanged?: (target: TransformNode | null) => void
  damageNumbers: FloatingDamageNumber[]
}

export interface WorldCombatInput {
  position: Vector3
  previousPosition: Vector3
  velocity: Vector3
  forward: Vector3
  right: Vector3
  sight?: { origin: Vector3; direction: Vector3; convergence: Vector3 }
  firing: boolean
  bonuses: ShipPartBonuses
  weaponRarity: ShipPartRarity
}

const RENDER_DISTANCE = 5200
const ACTIVE_ENEMY_LIMIT = 96
const MAX_IDLE_BOLT_MESHES = 48
const ENEMY_QUERY_SECONDS = 0.15
const ENEMY_QUERY_MOVEMENT = 45
const ENEMY_QUERY_PADDING = 250
const ENEMY_PLANET_PADDING = 300
const DORMANT_FORMATION_SECONDS = 0.16
const VISUAL_CLEANUP_SECONDS = 1
const MUZZLE = { forward: 1.8, separation: 1.1 }
const RETREAT_SPEED_FACTOR = 1.35
const RETREAT_LEASH_FACTOR = 2
const BOSS_LEASH_RADIUS = 210
const ENEMY_STEERING_RESPONSE = 5.5
const PURSUIT_MEMORY_SECONDS = 24
const PURSUIT_SIGHT_MULTIPLIER = 1.35
const AI_MOVEMENT = {
  formationSpeedMultiplier: 1.8,
  patrolRadiusMinimum: 48,
  patrolRadiusSpeedMultiplier: 4.5,
  bossLeashCorrectionThreshold: .45,
  idleReturnRate: 1.35,
  idleOrbitHorizontalRate: .78,
  idleOrbitVerticalRate: 1.12,
  idleOrbitVerticalAmplitude: .34,
  idleBankRate: .55,
  idleBankAmplitude: .16,
  idleBossOrbitRadius: .22,
  planetClearanceMinimum: 90,
  planetClearanceMaximum: 620,
  planetClearanceRadiusFraction: .015,
} as const

export function createWorldCombat(scene: Scene, callbacks: CombatCallbacks, world?: GalaxyWorld) {
  const initial = callbacks.getProgress()
  const missions = !world || world.galaxy.id === ORION_SECTOR_ID ? MISSIONS : []
  const planetSites = world?.planets ?? ORION_PLANETS
  const finished = new Set<MissionId>(missions.filter(mission => isMissionComplete(initial, mission.id)).map(mission => mission.id))
  const counts = new Map<MissionId, number>(missions.map(mission => [mission.id, initial.missionObjectiveProgress?.[mission.id] ?? 0]))
  const defeated = new Set(initial.defeatedDrones)
  const actors: Actor[] = []
  const actorIds = new Set<string>()
  const orbitalFleets = new Map<string, Actor[]>()
  const spatial = new SpatialIndex<Actor>(4000, actor => actor.position)
  const cachedVisuals = new Set<Actor>()
  const fleetModels = createFleetModelLibrary(scene)
  const awake = new Set<Actor>()
  let awakeGroups = new Set<PatrolGroup>()
  let formationClock = 1
  let visualCleanupClock = 0
  let candidateCount = 0
  const pickups: Pickup[] = []
  const bolts: Bolt[] = []
  const activeActors: Actor[] = []
  const previouslyActive: Actor[] = []
  const groups = new Map<string, PatrolGroup>()
  const actorsByMission = new Map<MissionId, Actor[]>()
  const formationTravel = new Vector3()
  const planets = planetSites.map(site => ({ center: new Vector3(site.x, site.y, site.z), x: site.x, y: site.y, z: site.z, radius: site.radius }))
  const missionPositions = new Map(missions.map(mission => [mission.id, new Vector3(mission.worldPosition.x, mission.worldPosition.y, mission.worldPosition.z)]))
  const zero = Vector3.Zero()
  const previousBoltPosition = new Vector3()
  const relativeFrom = new Vector3()
  const relativeTo = new Vector3()
  const travel = new Vector3()
  const originOffset = new Vector3()
  const steering = new Vector3()
  const flightHeading = new Vector3()
  const sightEnd = new Vector3()
  const defaultConvergence = new Vector3()
  let aimedActor: Actor | null = null
  const previousQueryPosition = new Vector3()
  let selection: Actor[] = []
  let selectedActors = new Set<Actor>()
  let nearbyPlanets: typeof planets = []
  let queryClock = Infinity
  const playerBoltPool: Mesh[] = []
  const hostileBoltPool: Mesh[] = []
  const templates = [false, true].map(hostile => {
    const mesh = MeshBuilder.CreateSphere(hostile ? 'worldHostileBoltTemplate' : 'worldPlayerBoltTemplate', { diameter: hostile ? 0.25 : 0.14, segments: 5 }, scene)
    mesh.scaling.z = hostile ? 4 : 8
    mesh.rotationQuaternion = Quaternion.Identity()
    mesh.isPickable = false
    mesh.setEnabled(false)
    return mesh
  })
  let boltMeshAllocations = 0
  let boltMeshReuses = 0
  let boltPlanetBoundsChecks = 0
  let boltPlanetExactChecks = 0
  let boltActorBoundsChecks = 0
  let boltActorExactChecks = 0
  const shotMaterial = createSceneMaterial('worldPlayerShotMaterial', scene)
  shotMaterial.disableLighting = true
  shotMaterial.emissiveColor = new Color3(1, 0.68, 0.28)
  const hostileMaterials = new Map<FactionId, StandardMaterial>()
  for (const faction of Object.keys(FACTIONS) as FactionId[]) {
    const material = createSceneMaterial(`worldHostileShot-${faction}`, scene)
    material.disableLighting = true
    material.emissiveColor = Color3.FromHexString(FACTIONS[faction].accent).scale(1.1)
    hostileMaterials.set(faction, material)
  }
  const pickupMaterial = createSceneMaterial('worldRelayPickupMaterial', scene)
  pickupMaterial.diffuseColor = new Color3(0.15, 0.35, 0.42)
  pickupMaterial.emissiveColor = new Color3(0.08, 0.55, 0.72)
  let elapsed = 0
  let playerFireClock = 0
  let latestStatus: WorldCombatStatus = {
    mission: null, boss: null, completedObjectives: 0, requiredObjectives: 0,
    engaged: false,
  }

  const syncFormation = (group: PatrolGroup) => {
    const route = samplePatrolRoute(group.route, elapsed)
    group.center.set(route.center.x, route.center.y, route.center.z)
    group.forward.set(route.forward.x, route.forward.y, route.forward.z)
    for (const member of group.members) {
      const target = sampleFormationPosition(route.center, route.forward, member.site!.formation!.slot)
      member.formationTarget!.set(target.x, target.y, target.z)
      if (!awake.has(member)) { member.position.copyFrom(member.formationTarget!); spatial.update(member) }
    }
  }

  const addShip = (site: DroneSite, mission: MissionDefinition | null) => {
    if (actorIds.has(site.id)) return
    actorIds.add(site.id)
    const position = new Vector3(site.x, site.y, site.z)
    const archetype = site.archetype ?? 'scout'
    const faction = site.faction ?? mission?.faction ?? 'meridian'
    const threatLevel = site.level ?? getZoneLevel(world?.galaxy ?? getGalaxy(ORION_SECTOR_ID), site)
    const base = SHIP_ARCHETYPES[archetype]
    const stats = scaleEnemyCombatStats({
      health: site.health,
      damage: site.damage ?? base.damage,
      attackInterval: site.attackInterval ?? base.attackInterval,
      attackRange: site.attackRange ?? base.attackRange,
      projectileSpeed: site.projectileSpeed ?? base.projectileSpeed,
      speed: site.speed ?? base.speed,
    }, threatLevel)
    const threatSite = { ...site, ...stats, level: threatLevel }
    const shield = getEnemyShieldCapacity(archetype, faction, stats.health)
    const actor: Actor = {
      id: site.id, position, previousPosition: position.clone(), origin: position.clone(), root: null, site: threatSite, mission,
      faction, archetype,
      ...getEnemyIdentity(faction, archetype, stats.health, shield, stats.damage), level: threatLevel,
      health: stats.health, maxHealth: stats.health, shield, maxShield: shield, hitFlash: 0,
      lastHitAt: -Infinity, lastContactAt: -Infinity, lastPlayerSeenAt: -Infinity,
      lastPlayerPosition: position.clone(), maneuverPhase: (actors.length % 29) * .61,
      defeated: mission ? finished.has(mission.id) || defeated.has(site.id) : initial.droneRespawns[site.id] !== undefined,
      fireClock: 0.5 + actors.length % 5 * 0.2, respawn: remainingRespawnSeconds(initial.droneRespawns[site.id]),
      hitRadius: (archetype === 'frigate' ? 3.7 : archetype === 'bomber' ? 2.2 : archetype === 'interceptor' ? 2.23 : 1.65) * ENEMY_VISUAL_SCALE,
      formationTarget: site.formation ? position.clone() : null,
    }
    actors.push(actor)
    if (!actor.defeated || !mission) spatial.update(actor)
    if (site.formation) {
      let group = groups.get(site.formation.id)
      if (!group) {
        group = { route: site.formation, center: new Vector3(), forward: new Vector3(), members: [], alerted: false }
        groups.set(site.formation.id, group)
      }
      group.members.push(actor)
    }
  }

  for (const site of world?.drones ?? ORION_DRONES) if (!site.missionId) addShip(site, null)
  for (const mission of missions) {
    if (mission.bossProfile) {
      const position = new Vector3(mission.worldPosition.x, mission.worldPosition.y, mission.worldPosition.z)
      const threatLevel = getZoneLevel(world?.galaxy ?? getGalaxy(ORION_SECTOR_ID), mission.worldPosition)
      const profile = scaleEnemyCombatStats({
        health: mission.bossProfile.health,
        damage: mission.bossProfile.damage,
        attackInterval: mission.bossProfile.attackInterval,
        attackRange: Math.max(650, mission.activationRadius),
        projectileSpeed: mission.bossProfile.projectileSpeed,
        speed: SHIP_ARCHETYPES.frigate.speed,
      }, threatLevel)
      profile.health = Math.round(profile.health * BOSS_BALANCE.hull)
      profile.damage = Math.round(profile.damage * BOSS_BALANCE.damage)
      profile.attackInterval *= BOSS_BALANCE.attackInterval
      profile.projectileSpeed *= BOSS_BALANCE.projectileSpeed
      profile.speed *= BOSS_BALANCE.maneuverSpeed
      const bossMission = {
        ...mission,
        activationRadius: Math.round(mission.activationRadius * BOSS_BALANCE.activationRange),
        bossProfile: { ...mission.bossProfile, ...profile,
          shield: Math.round(mission.bossProfile.shield * (profile.health / mission.bossProfile.health) * BOSS_BALANCE.shield) },
      }
      const bossShield = bossMission.bossProfile!.shield
      actors.push({
        id: `world-boss-${mission.id}`, position, previousPosition: position.clone(), origin: position.clone(), root: null, site: null, mission: bossMission,
        faction: mission.faction, archetype: 'frigate', health: profile.health,
        ...getEnemyIdentity(mission.faction, 'frigate', profile.health, bossShield, profile.damage, mission.id), level: threatLevel,
        maxHealth: profile.health, shield: bossShield,
        maxShield: bossShield, defeated: finished.has(mission.id), fireClock: 1.8,
        respawn: 0, hitRadius: (mission.id === 'null-choir' ? 7.2 : 6) * BOSS_VISUAL_SCALE,
        formationTarget: null, hitFlash: 0, lastHitAt: -Infinity, lastContactAt: -Infinity,
        lastPlayerSeenAt: -Infinity, lastPlayerPosition: position.clone(), maneuverPhase: 0, maneuverSpeed: profile.speed,
      })
      if (!actors.at(-1)!.defeated) spatial.update(actors.at(-1)!)
    }
    for (const site of buildMissionHostiles(mission)) addShip(site, mission)
    if (mission.objective === 'recover-fragments') {
      for (let index = 0; index < 3; index += 1) {
        pickups.push({
          mission, index, mesh: null, collected: finished.has(mission.id) || index < (counts.get(mission.id) ?? 0),
          position: new Vector3(mission.worldPosition.x + (index - 1) * 35,
            mission.worldPosition.y + (index === 1 ? 9 : 0), mission.worldPosition.z + (index - 1) * 48),
        })
      }
    }
  }
  for (const actor of actors) {
    if (!actor.mission) continue
    const group = actorsByMission.get(actor.mission.id) ?? []
    group.push(actor)
    actorsByMission.set(actor.mission.id, group)
  }

  const enterPlanetOrbit = (id: string) => {
    if (orbitalFleets.has(id)) return
    const planet = planetSites.find(site => site.id === id)
    if (!planet?.orbitalFaction) return
    const start = actors.length
    for (const site of buildPlanetDefenders(planet)) addShip(site, null)
    orbitalFleets.set(id, actors.slice(start))
  }
  if (initial.orbitPlanetId) enterPlanetOrbit(initial.orbitPlanetId)

  const complete = (mission: MissionDefinition) => {
    if (finished.has(mission.id)) return
    finished.add(mission.id)
    callbacks.onMissionComplete(mission.id)
    callbacks.onMessage(localizedText((text, language) => formatText(text.combat.objectiveComplete, { mission: mission.title[language] })))
  }

  const advanceObjective = (mission: MissionDefinition) => {
    const count = (counts.get(mission.id) ?? 0) + 1
    counts.set(mission.id, count)
    callbacks.onMissionProgress(mission.id, count)
    const required = mission.objective === 'recover-fragments' ? 3 : mission.requiredKills ?? 1
    if (!mission.bossProfile && mission.objective !== 'survey-planet' && count >= required) complete(mission)
  }

  const destroyActor = (actor: Actor) => {
    actor.defeated = true
    actor.root?.setEnabled(false)
    actor.respawn = actor.mission ? Infinity : elapsed + ROAMING_RESPAWN_SECONDS
    if (actor.mission) spatial.remove(actor)
    if (actor.mission) callbacks.onEnemyDefeated(actor.id)
    else callbacks.onEnemyDefeated(actor.id, Date.now() + ROAMING_RESPAWN_SECONDS * 1000)
    if (actor.mission) {
      if (!actor.site && actor.mission.bossProfile) complete(actor.mission)
      else if (!finished.has(actor.mission.id)) advanceObjective(actor.mission)
    }
  }

  const damageActor = (actor: Actor, amount: number, point: Vector3, normal: Vector3, critical = false, collision = false) => {
    const blocked = !actor.site && actor.mission?.objective === 'disable-signal' && !getSignalPulseState(elapsed).open
    const shielded = blocked || actor.shield > 0
    const kind = collision ? 'collision' : shielded ? 'shield' : 'armor'
    callbacks.onImpact(point, normal, Math.min(11, 1.2 + actor.hitRadius * .11), kind)
    actor.hitFlash = .32
    actor.lastHitAt = elapsed
    if (blocked) return
    const before = actor.health + actor.shield
    const vitals = resolveBossDamage({ health: actor.health, shield: actor.shield, amount })
    actor.health = vitals.health
    actor.shield = vitals.shield
    if (actor.root) showHullDamage(actor.root, actor.health / actor.maxHealth)
    callbacks.damageNumbers.push(createDamageNumber(scene, point, before - actor.health - actor.shield, critical))
    if (actor.health <= 0) destroyActor(actor)
  }

  const handlePlayerContact = (input: WorldCombatInput, dt: number) => {
    let first = Infinity
    let target: Actor | null = null
    for (const actor of activeActors) {
      if (actor.defeated) continue
      const radius = actor.hitRadius + PLAYER_CONTACT_RADIUS
      input.previousPosition.subtractToRef(actor.previousPosition, relativeFrom)
      input.position.subtractToRef(actor.position, relativeTo)
      if (!segmentBoundsOverlapSphere(relativeFrom, relativeTo, zero, radius)) continue
      const contact = relativeFrom.lengthSquared() < radius ** 2 ? 0 : segmentSphereContact(relativeFrom, relativeTo, zero, radius)
      if (contact !== null && contact < first) { first = contact; target = actor }
    }
    if (!target) return
    const playerCenter = Vector3.Lerp(input.previousPosition, input.position, first)
    const enemyCenter = Vector3.Lerp(target.previousPosition, target.position, first)
    const normal = playerCenter.subtract(enemyCenter)
    if (normal.lengthSquared() < .01) normal.copyFrom(input.forward).negateInPlace()
    normal.normalize()
    if (elapsed - target.lastContactAt >= SHIP_CONTACT_COOLDOWN) {
      target.lastContactAt = elapsed
      const relativeSpeed = input.position.subtract(input.previousPosition)
        .subtractInPlace(target.position.subtract(target.previousPosition)).length() / Math.max(dt, .001)
      const damage = getShipContactDamage(relativeSpeed, target.archetype, target.boss)
      const playerImpact = playerCenter.subtract(normal.scale(PLAYER_CONTACT_RADIUS * .82))
      callbacks.onPlayerHit(damage.player, {
        position: enemyCenter, label: target.name, kind: 'collision', impact: { position: playerImpact, normal: normal.negate() },
      })
      if (!target.boss) {
        const hitPoint = enemyCenter.add(normal.scale(target.hitRadius))
        damageActor(target, damage.enemy, hitPoint, normal, false, true)
        target.position.subtractInPlace(normal.scale(Math.min(5, relativeSpeed * .02)))
      }
    }
    callbacks.onPlayerContact?.(target.position.add(normal.scale(target.hitRadius + PLAYER_CONTACT_RADIUS + .65)))
  }

  const spawnBolt = (position: Vector3, direction: Vector3, velocity: Vector3, damage: number, critical: boolean, faction: FactionId | null, source?: DamageSource) => {
    const hostile = faction !== null
    const pool = hostile ? hostileBoltPool : playerBoltPool
    let mesh = pool.pop()
    if (mesh) boltMeshReuses++
    else {
      mesh = templates[hostile ? 1 : 0].clone('worldBolt')!
      boltMeshAllocations++
    }
    mesh.name = hostile ? 'worldHostileBolt' : 'worldPlayerBolt'
    mesh.position.copyFrom(position)
    Quaternion.FromLookDirectionLHToRef(direction, Vector3.UpReadOnly, mesh.rotationQuaternion!)
    mesh.material = faction ? hostileMaterials.get(faction)! : shotMaterial
    mesh.setEnabled(true)
    bolts.push({ mesh, velocity, damage, critical, hostile, source, remaining: hostile ? 8 : PLAYER_WEAPON.projectileLifetime })
  }

  const releaseBolt = (bolt: Bolt) => {
    bolt.mesh.setEnabled(false)
    bolt.mesh.name = bolt.hostile ? 'pooledHostileBolt' : 'pooledPlayerBolt'
    const pool = bolt.hostile ? hostileBoltPool : playerBoltPool
    if (pool.length < MAX_IDLE_BOLT_MESHES) pool.push(bolt.mesh)
    else bolt.mesh.dispose(false, false)
  }

  const pickAimTarget = (input: WorldCombatInput) => {
    const from = input.sight?.origin ?? input.position
    const direction = input.sight?.direction ?? input.forward
    direction.scaleToRef(PLAYER_WEAPON.projectileSpeed * PLAYER_WEAPON.projectileLifetime, sightEnd).addInPlace(from)
    let target: Actor | null = null
    let firstContact = Infinity
    for (const actor of activeActors) {
      if (actor.defeated || !segmentBoundsOverlapSphere(from, sightEnd, actor.position, actor.hitRadius)) continue
      const contact = segmentSphereContact(from, sightEnd, actor.position, actor.hitRadius)
      if (contact === null || contact >= firstContact) continue
      target = actor
      firstContact = contact
    }
    if (!target) return null
    for (const planet of planets) {
      if (!segmentBoundsOverlapSphere(from, sightEnd, planet.center, planet.radius)) continue
      const contact = segmentSphereContact(from, sightEnd, planet.center, planet.radius)
      if (contact !== null && contact <= firstContact) return null
    }
    return target
  }

  const setAimedActor = (actor: Actor | null) => {
    if (actor === aimedActor) return
    aimedActor = actor
    callbacks.onAimChanged?.(actor?.root ?? null)
  }

  const streaming = { totalActors: actors.length, activeLimit: ACTIVE_ENEMY_LIMIT, activeActors: 0, candidates: 0, cachedVisuals: 0, patrolGroups: groups.size }
  scene.metadata = { ...scene.metadata, combatStreaming: streaming }

  return {
    getStatus(): WorldCombatStatus { return latestStatus },
    enterPlanetOrbit(id: string) { enterPlanetOrbit(id); streaming.totalActors = actors.length },
    getPlanetOrbitStatus(id: string) {
      const fleet = orbitalFleets.get(id) ?? []
      return { total: fleet.length, remaining: fleet.filter(actor => !actor.defeated).length }
    },
    getNameplateTargets(): readonly EnemyNameplateTarget[] { return activeActors.filter(actor => !actor.defeated) },
    getRadarTargets(position: Vector3, range: number): RadarTarget[] {
      return spatial.query(position, range).filter(actor => !actor.defeated)
        .sort((a, b) => Number(b.boss) - Number(a.boss) || Vector3.DistanceSquared(a.position, position) - Vector3.DistanceSquared(b.position, position))
        .map(actor => ({ id: actor.id, kind: actor.boss ? 'boss' : 'hostile', x: actor.position.x, y: actor.position.y, z: actor.position.z }))
    },

    getPerformanceStats() {
      return { totalActors: actors.length, totalPlanets: planets.length, activeActors: activeActors.length, actorCandidates: candidateCount, activeLimit: ACTIVE_ENEMY_LIMIT, cachedVisuals: cachedVisuals.size, patrolGroups: groups.size,
        activeBolts: bolts.length, pooledBolts: playerBoltPool.length + hostileBoltPool.length,
        boltMeshAllocations, boltMeshReuses, boltPlanetBoundsChecks, boltPlanetExactChecks, boltActorBoundsChecks, boltActorExactChecks }
    },

    getNavigationTarget(missionId: MissionId, position: Vector3): Vector3 | null {
      if (!isMissionUnlocked(callbacks.getProgress(), missionId)) return null
      if (finished.has(missionId)) return null
      const pickup = pickups.find(item => item.mission.id === missionId && !item.collected)
      if (pickup) return pickup.position
      let closest: Actor | null = null
      let distance = Infinity
      for (const actor of actorsByMission.get(missionId) ?? []) {
        if (actor.defeated) continue
        if (!actor.site) return actor.position
        const candidateDistance = Vector3.DistanceSquared(position, actor.position)
        if (candidateDistance < distance) { closest = actor; distance = candidateDistance }
      }
      return closest?.position ?? null
    },

    update(dt: number, input: WorldCombatInput) {
      previouslyActive.length = activeActors.length
      for (let index = 0; index < activeActors.length; index += 1) previouslyActive[index] = activeActors[index]
      activeActors.length = 0
      boltPlanetBoundsChecks = boltPlanetExactChecks = boltActorBoundsChecks = boltActorExactChecks = 0
      elapsed += dt
      formationClock += dt
      queryClock += dt
      visualCleanupClock += dt
      playerFireClock = Math.max(0, playerFireClock - dt)
      const progress = callbacks.getProgress()
      for (const mission of missions) {
        if (isMissionComplete(progress, mission.id)) finished.add(mission.id)
      }
      let closest: Actor | null = null
      let closestDistance = Infinity
      let boss: Actor | null = null
      let encounter: MissionDefinition | null = null
      let encounterDistance = Infinity
      for (const mission of missions) {
        if (finished.has(mission.id) || !isMissionUnlocked(progress, mission.id)) continue
        const distance = Vector3.Distance(input.position, missionPositions.get(mission.id)!)
        const activationRadius = mission.bossProfile ? Math.max(650, mission.activationRadius) : mission.activationRadius
        if (distance <= activationRadius && distance < encounterDistance) { encounter = mission; encounterDistance = distance }
      }

      if (formationClock >= DORMANT_FORMATION_SECONDS) {
        formationClock = 0
        for (const group of groups.values()) if (!awakeGroups.has(group)) syncFormation(group)
      }
      for (const group of awakeGroups) syncFormation(group)
      if (queryClock >= ENEMY_QUERY_SECONDS || Vector3.DistanceSquared(input.position, previousQueryPosition) > ENEMY_QUERY_MOVEMENT ** 2) {
        queryClock = 0
        previousQueryPosition.copyFrom(input.position)
        const candidates = spatial.query(input.position, RENDER_DISTANCE + ENEMY_QUERY_PADDING)
          .filter(actor => !actor.mission || isMissionUnlocked(progress, actor.mission.id))
        candidateCount = candidates.length
        candidates.sort((a, b) => Number(!b.site) - Number(!a.site) || Vector3.DistanceSquared(input.position, a.position) - Vector3.DistanceSquared(input.position, b.position))
        selection = candidates.slice(0, ACTIVE_ENEMY_LIMIT)
        selectedActors = new Set(selection)
        nearbyPlanets = planets.filter(planet => Vector3.DistanceSquared(input.position, planet.center)
          <= (planet.radius + RENDER_DISTANCE + ENEMY_PLANET_PADDING + ENEMY_QUERY_MOVEMENT) ** 2)
      }
      const selected = selection
      for (const actor of previouslyActive) if (!selectedActors.has(actor)) actor.root?.setEnabled(false)
      const nearbyGroups = new Set<PatrolGroup>()
      for (const actor of selected) if (actor.site?.formation) nearbyGroups.add(groups.get(actor.site.formation.id)!)
      for (const group of nearbyGroups) {
        if (!awakeGroups.has(group)) syncFormation(group)
        group.alerted = false
        for (const member of group.members) {
          const range = member.site!.attackRange ?? SHIP_ARCHETYPES[member.archetype].attackRange
          if (!member.defeated && Vector3.DistanceSquared(input.position, member.position) < (range * 1.5) ** 2) group.alerted = true
        }
      }
      awakeGroups = nearbyGroups
      awake.clear()

      for (const actor of selected) {
        if (actor.mission && !isMissionUnlocked(progress, actor.mission.id)) {
          actor.root?.setEnabled(false)
          continue
        }
        actor.previousPosition.copyFrom(actor.position)
        const group = actor.site?.formation ? groups.get(actor.site.formation.id)! : null
        if (actor.defeated) {
          if (!actor.mission) {
            if (elapsed >= actor.respawn) {
              actor.defeated = false
              callbacks.onEnemyRespawn?.(actor.id)
              actor.health = actor.maxHealth
              if (actor.root) showHullDamage(actor.root, 1)
              actor.shield = actor.maxShield
              actor.hitFlash = 0
              actor.lastHitAt = -Infinity
              actor.lastContactAt = -Infinity
              actor.position.copyFrom(actor.formationTarget ?? actor.origin)
              spatial.update(actor)
            }
          }
          continue
        }
        if (actor.formationTarget && (!actor.root?.isEnabled() || (group && Vector3.DistanceSquared(input.position, group.center) > (RENDER_DISTANCE + 200) ** 2))) actor.position.copyFrom(actor.formationTarget)
        const distance = Vector3.Distance(input.position, actor.position)
        if (distance > RENDER_DISTANCE) {
          actor.root?.setEnabled(false)
          continue
        }
        if (!actor.root) {
          actor.root = fleetModels.create(actor.id, actor.faction, actor.archetype, actor.boss,
            actor.mission?.id === 'null-choir' || actor.maxHealth >= 700)
          actor.root.metadata = { worldEnemyId: actor.id, faction: actor.faction, archetype: actor.archetype, missionId: actor.mission?.id, hitRadius: actor.hitRadius, enemyName: actor.name, enemyLevel: actor.level, formationId: actor.site?.formation?.id, formationSlot: actor.site?.formation?.slot }
          showHullDamage(actor.root, actor.health / actor.maxHealth)
          cachedVisuals.add(actor)
        }
        actor.root.setEnabled(true)
        activeActors.push(actor)
        awake.add(actor)
        actor.hitFlash = Math.max(0, .32 - (elapsed - actor.lastHitAt))
        if (actor.site && actor.shield < actor.maxShield && elapsed - actor.lastHitAt >= ENEMY_SHIELD_DELAY) {
          actor.shield = Math.min(actor.maxShield, actor.shield + actor.maxShield * .15 * dt)
        }
        const base = SHIP_ARCHETYPES[actor.archetype]
        const attackRange = actor.site?.attackRange ?? Math.max(650, actor.mission?.activationRadius ?? 650)
        const hullFraction = actor.health / actor.maxHealth
        const beat = elapsed + actor.maneuverPhase
        if (distance <= RENDER_DISTANCE * PURSUIT_SIGHT_MULTIPLIER) {
          actor.lastPlayerPosition.copyFrom(input.position)
          actor.lastPlayerSeenAt = elapsed
        }
        const pursuitMemory = elapsed - actor.lastPlayerSeenAt <= PURSUIT_MEMORY_SECONDS
        const pursuitPosition = pursuitMemory ? actor.lastPlayerPosition : input.position
        const pursuitDistance = Vector3.Distance(pursuitPosition, actor.position)
        const maneuver = actor.site ? getEnemyManeuver(actor.archetype, pursuitDistance, attackRange, beat, actor.hitFlash > 0, hullFraction) : null
        const retreating = maneuver?.retreating ?? false
        const attacking = retreating || (group?.alerted ?? false) || pursuitMemory || pursuitDistance < attackRange * 1.5
        let bank = 0
        if (group && actor.formationTarget && !attacking) {
          actor.formationTarget.subtractToRef(actor.position, formationTravel)
          const travelDistance = formationTravel.length()
          const step = group.route.speed * dt * AI_MOVEMENT.formationSpeedMultiplier
          if (travelDistance <= step) actor.position.copyFrom(actor.formationTarget)
          else actor.position.addInPlace(formationTravel.scaleInPlace(step / travelDistance))
        } else if (actor.site && maneuver && attacking) {
          pursuitPosition.subtractToRef(actor.position, steering)
          steering.normalize()
          formationTravel.set(
            steering.x * maneuver.advance + steering.z * maneuver.strafe,
            steering.y * maneuver.advance + maneuver.lift,
            steering.z * maneuver.advance - steering.x * maneuver.strafe,
          )
          const anchor = group?.center ?? actor.origin
          const patrolLimit = group ? 540 : actor.mission ? 360 : 260
          const limit = retreating ? patrolLimit * RETREAT_LEASH_FACTOR : patrolLimit
          actor.position.subtractToRef(anchor, originOffset)
          // Turn along the edge of the patrol area instead of reversing into the player.
          if (originOffset.lengthSquared() > limit ** 2) {
            originOffset.normalize()
            const outward = Math.max(0, Vector3.Dot(formationTravel, originOffset))
            originOffset.scaleInPlace(outward + .14)
            formationTravel.subtractInPlace(originOffset)
          }
          if (formationTravel.lengthSquared() > 1) formationTravel.normalize()
          const safeHeading = steerAroundPlanets(actor.position, formationTravel, nearbyPlanets,
            actor.hitRadius + Math.max(AI_MOVEMENT.planetClearanceMinimum, Math.min(AI_MOVEMENT.planetClearanceMaximum, actor.hitRadius * 25)), Math.sin(actor.maneuverPhase) || 1)
          formationTravel.set(safeHeading.x, safeHeading.y, safeHeading.z)
          const pace = (actor.site.speed ?? base.speed) * (retreating ? RETREAT_SPEED_FACTOR : 1)
          actor.position.addInPlace(formationTravel.scaleInPlace(pace * dt))
          bank = maneuver.strafe * .32
        } else if (actor.boss && pursuitMemory && pursuitDistance < RENDER_DISTANCE) {
          pursuitPosition.subtractToRef(actor.position, steering).normalize()
          const move = getBossManeuver(actor.mission?.bossProfile?.pattern ?? 'aimed', beat, pursuitDistance, attackRange, hullFraction)
          formationTravel.set(steering.x * move.advance + steering.z * move.strafe,
            steering.y * move.advance + move.lift, steering.z * move.advance - steering.x * move.strafe)
          actor.position.subtractToRef(actor.origin, originOffset)
          const leash = originOffset.length() / BOSS_LEASH_RADIUS
          if (leash > AI_MOVEMENT.bossLeashCorrectionThreshold) formationTravel.subtractInPlace(originOffset.normalize().scaleInPlace(leash * leash))
          const travelMagnitude = Math.max(.2, formationTravel.length())
          const safeHeading = steerAroundPlanets(actor.position, formationTravel, nearbyPlanets,
            actor.hitRadius + AI_MOVEMENT.planetClearanceMaximum, Math.sin(actor.maneuverPhase) || 1)
          formationTravel.set(safeHeading.x * travelMagnitude, safeHeading.y * travelMagnitude, safeHeading.z * travelMagnitude)
          actor.position.addInPlace(formationTravel.scaleInPlace((actor.maneuverSpeed ?? base.speed) * move.pace * dt))
          bank = move.strafe * .22
        } else {
          const radius = actor.site
            ? Math.max(AI_MOVEMENT.patrolRadiusMinimum, (actor.site.speed ?? base.speed) * AI_MOVEMENT.patrolRadiusSpeedMultiplier)
            : BOSS_LEASH_RADIUS * AI_MOVEMENT.idleBossOrbitRadius
          formationTravel.set(Math.sin(beat * AI_MOVEMENT.idleOrbitHorizontalRate) * radius,
            Math.sin(beat * AI_MOVEMENT.idleOrbitVerticalRate) * radius * AI_MOVEMENT.idleOrbitVerticalAmplitude,
            Math.cos(beat * AI_MOVEMENT.idleOrbitHorizontalRate) * radius).addInPlace(actor.origin)
          Vector3.LerpToRef(actor.position, formationTravel, Math.min(1, dt * AI_MOVEMENT.idleReturnRate), actor.position)
          bank = Math.cos(beat * AI_MOVEMENT.idleBankRate) * AI_MOVEMENT.idleBankAmplitude
        }
        for (const planet of nearbyPlanets) {
          const center = planet.center
          const clearance = Math.max(AI_MOVEMENT.planetClearanceMinimum,
            Math.min(AI_MOVEMENT.planetClearanceMaximum, planet.radius * AI_MOVEMENT.planetClearanceRadiusFraction))
          const minimumRadius = planet.radius + actor.hitRadius + clearance
          let dx = actor.position.x - center.x
          let dy = actor.position.y - center.y
          let dz = actor.position.z - center.z
          if (Math.abs(dx) > minimumRadius || Math.abs(dy) > minimumRadius || Math.abs(dz) > minimumRadius) continue
          let squaredDistance = dx * dx + dy * dy + dz * dz
          if (squaredDistance >= minimumRadius ** 2) continue
          if (squaredDistance < 0.001) {
            actor.origin.subtractToRef(center, originOffset)
            dx = originOffset.x; dy = originOffset.y; dz = originOffset.z
            squaredDistance = originOffset.lengthSquared()
          }
          if (squaredDistance < 0.001) { dx = 0; dy = 0; dz = -1; squaredDistance = 1 }
          const scale = minimumRadius / Math.sqrt(squaredDistance)
          actor.position.set(center.x + dx * scale, center.y + dy * scale, center.z + dz * scale)
        }
        actor.root.position.copyFrom(actor.position)
        if (group && !attacking) flightHeading.copyFrom(group.forward)
        else if (!retreating && (attacking || actor.boss)) pursuitPosition.subtractToRef(actor.position, flightHeading)
        else actor.position.subtractToRef(actor.previousPosition, flightHeading)
        const turn = 1 - Math.exp(-dt * ENEMY_STEERING_RESPONSE)
        if (flightHeading.lengthSquared() > .0001) {
          const bearing = Math.atan2(flightHeading.x, flightHeading.z) + Math.PI
          const delta = bearing - actor.root.rotation.y
          actor.root.rotation.y += Math.atan2(Math.sin(delta), Math.cos(delta)) * turn
          const pitch = Math.atan2(flightHeading.y, Math.hypot(flightHeading.x, flightHeading.z))
          actor.root.rotation.x += (pitch - actor.root.rotation.x) * turn
        }
        actor.root.rotation.z += (bank - actor.root.rotation.z) * turn
        if (distance < closestDistance) { closest = actor; closestDistance = distance }
        if (!actor.site && distance < attackRange) boss = actor
        if (actor.mission && !finished.has(actor.mission.id) && distance < 300 && distance < encounterDistance) {
          encounter = actor.mission
          encounterDistance = distance
        }
        actor.fireClock -= dt
        if (retreating || distance > attackRange || actor.fireClock > 0) continue
        const profile = actor.site ? undefined : actor.mission?.bossProfile
        const rage = actor.boss && hullFraction <= BOSS_RAGE_HULL_FRACTION ? .78 : 1
        actor.fireClock = (actor.site?.attackInterval ?? profile?.attackInterval ?? base.attackInterval) * rage
        const speed = actor.site?.projectileSpeed ?? profile?.projectileSpeed ?? base.projectileSpeed
        const amount = actor.site?.damage ?? profile?.damage ?? base.damage
        const lead = input.velocity.scale(Math.min(0.65, distance / Math.max(1, speed)))
        const direction = input.position.add(lead).subtract(actor.position).normalize()
        const pattern = profile?.pattern ?? (actor.archetype === 'frigate' ? 'fan' : actor.archetype === 'bomber' ? 'burst' : 'aimed')
        const shots = pattern === 'fan' ? 3 : pattern === 'burst' ? 2 : pattern === 'spiral' ? 5 : 1
        const right = new Vector3(direction.z, 0, -direction.x)
        if (right.lengthSquared() < .001) right.set(1, 0, 0)
        right.normalize()
        const up = Vector3.Cross(direction, right)
        for (let shot = 0; shot < shots; shot += 1) {
          const offset = shot - (shots - 1) / 2
          let lateral = offset * .11
          let vertical = 0
          if (pattern === 'spiral' && offset !== 0) {
            const phase = elapsed * 1.3 + (shot > 2 ? shot - 1 : shot) * Math.PI / 2
            lateral = Math.cos(phase) * .21
            vertical = Math.sin(phase) * .16
          }
          const velocityDirection = direction.add(right.scale(lateral)).addInPlace(up.scale(vertical)).normalize()
          spawnBolt(actor.position.add(velocityDirection.scale(actor.hitRadius + 0.5)), velocityDirection, velocityDirection.scale(speed), amount, false, actor.faction, {
            position: { x: actor.position.x, y: actor.position.y, z: actor.position.z }, label: profile ? actor.mission!.title : actor.name, kind: 'weapon',
          })
        }
      }

      // Keep the larger ships and boss escorts from converging into the same hull.
      for (let left = 0; left < activeActors.length; left++) {
        for (let right = left + 1; right < activeActors.length; right++) {
          const a = activeActors[left]
          const b = activeActors[right]
          const minimum = a.hitRadius + b.hitRadius + 4
          a.position.subtractToRef(b.position, formationTravel)
          const squared = formationTravel.lengthSquared()
          if (squared >= minimum * minimum) continue
          if (squared < 0.0001) formationTravel.set(1, 0, 0)
          else formationTravel.scaleInPlace(1 / Math.sqrt(squared))
          const overlap = minimum - Math.sqrt(squared)
          const aShare = !a.site ? 0 : !b.site ? 1 : 0.5
          a.position.addInPlaceFromFloats(formationTravel.x * overlap * aShare, formationTravel.y * overlap * aShare, formationTravel.z * overlap * aShare)
          b.position.addInPlaceFromFloats(-formationTravel.x * overlap * (1 - aShare), -formationTravel.y * overlap * (1 - aShare), -formationTravel.z * overlap * (1 - aShare))
        }
      }
      handlePlayerContact(input, dt)
      for (const actor of activeActors) { actor.root!.position.copyFrom(actor.position); if (!actor.defeated || !actor.mission) spatial.update(actor) }
      streaming.activeActors = activeActors.length
      streaming.candidates = candidateCount
      streaming.cachedVisuals = cachedVisuals.size
      if (visualCleanupClock >= VISUAL_CLEANUP_SECONDS) {
        visualCleanupClock = 0
        for (const actor of cachedVisuals) {
          if (Vector3.DistanceSquared(input.position, actor.position) <= (RENDER_DISTANCE * 3) ** 2) continue
          actor.root?.dispose(false, false)
          actor.root = null
          cachedVisuals.delete(actor)
        }
      }

      if (input.firing && playerFireClock <= 0) {
        playerFireClock = PLAYER_WEAPON.fireCooldown
        callbacks.onShot()
        const hit = resolveWeaponHit(input.bonuses, Math.random, false, input.weaponRarity)
        const convergence = input.sight?.convergence ?? input.forward.scaleToRef(PLAYER_WEAPON.sightConvergence, defaultConvergence).addInPlace(input.position)
        for (const side of [-1, 1]) {
          const position = input.position.add(input.forward.scale(MUZZLE.forward)).addInPlace(input.right.scale(side * MUZZLE.separation))
          const direction = convergence.subtract(position).normalize()
          spawnBolt(position, direction, direction.scale(PLAYER_WEAPON.projectileSpeed), hit.damage, hit.critical, null)
        }
      }

      for (let index = bolts.length - 1; index >= 0; index -= 1) {
        const bolt = bolts[index]
        previousBoltPosition.copyFrom(bolt.mesh.position)
        bolt.velocity.scaleToRef(dt, travel)
        bolt.mesh.position.addInPlace(travel)
        bolt.remaining -= dt
        let hit = false
        let planetContact = Infinity
        for (const planet of planets) {
          boltPlanetBoundsChecks++
          if (!segmentBoundsOverlapSphere(previousBoltPosition, bolt.mesh.position, planet.center, planet.radius)) continue
          boltPlanetExactChecks++
          const contact = segmentSphereContact(previousBoltPosition, bolt.mesh.position, planet.center, planet.radius)
          if (contact !== null) planetContact = Math.min(planetContact, contact)
        }
        if (bolt.hostile) {
          previousBoltPosition.subtractToRef(input.previousPosition, relativeFrom)
          bolt.mesh.position.subtractToRef(input.position, relativeTo)
          const playerContact = segmentBoundsOverlapSphere(relativeFrom, relativeTo, zero, 1.05)
            ? segmentSphereContact(relativeFrom, relativeTo, zero, 1.05) : null
          if (playerContact !== null && playerContact < planetContact) {
            const point = Vector3.Lerp(previousBoltPosition, bolt.mesh.position, playerContact)
            const center = Vector3.Lerp(input.previousPosition, input.position, playerContact)
            const source = bolt.source
            callbacks.onPlayerHit(bolt.damage, source && { ...source, impact: { position: point, normal: point.subtract(center) } })
            hit = true
          }
        } else {
          let target: Actor | null = null
          let firstContact = Infinity
          for (const actor of activeActors) {
            if (actor.defeated) continue
            previousBoltPosition.subtractToRef(actor.previousPosition, relativeFrom)
            bolt.mesh.position.subtractToRef(actor.position, relativeTo)
            boltActorBoundsChecks++
            if (!segmentBoundsOverlapSphere(relativeFrom, relativeTo, zero, actor.hitRadius)) continue
            boltActorExactChecks++
            const contact = segmentSphereContact(relativeFrom, relativeTo, zero, actor.hitRadius)
            if (contact !== null && contact < firstContact && contact < planetContact) { target = actor; firstContact = contact }
          }
          if (target) {
            hit = true
            const center = Vector3.Lerp(target.previousPosition, target.position, firstContact)
            const point = Vector3.Lerp(previousBoltPosition, bolt.mesh.position, firstContact)
            const normal = point.subtract(center).normalize()
            const damage = applyArmorDamage(bolt.damage, getEnemyArmor(target.level, target.archetype, target.boss))
            damageActor(target, damage, point, normal, bolt.critical)
          }
        }
        if (hit || planetContact < Infinity || bolt.remaining <= 0) { releaseBolt(bolt); bolts.splice(index, 1) }
      }

      for (const pickup of pickups) {
        if (pickup.collected) continue
        // Only the next black box is exposed, so the saved count identifies it
        // unambiguously even when leaving and returning to this sector.
        if (pickup.index !== (counts.get(pickup.mission.id) ?? 0)) continue
        const distance = Vector3.Distance(input.position, pickup.position)
        if (distance < 1400 && !pickup.mesh) {
          pickup.mesh = MeshBuilder.CreatePolyhedron(`world-black-box-${pickup.index}`, { type: 1, size: 1.8 }, scene)
          pickup.mesh.material = pickupMaterial
          pickup.mesh.position.copyFrom(pickup.position)
          pickup.mesh.isPickable = false
        }
        pickup.mesh?.setEnabled(distance < 1400)
        if (pickup.mesh) pickup.mesh.rotation.y += dt * 0.7
        if (distance < 9) {
          pickup.collected = true
          pickup.mesh?.dispose()
          advanceObjective(pickup.mission)
          callbacks.onMessage(localizedText(text => text.combat.relayBlackBoxRecovered))
        }
      }

      const aimTarget = pickAimTarget(input)
      setAimedActor(aimTarget)
      if (boss && !boss.defeated) encounter = boss.mission
      latestStatus = {
        mission: encounter,
        boss: boss && !boss.defeated ? {
          health: boss.health, maximumHealth: boss.maxHealth,
          shield: boss.mission?.objective === 'disable-signal' ? getSignalPulseState(elapsed).open ? 0 : boss.maxShield : boss.shield,
          maximumShield: boss.maxShield,
          charging: boss.fireClock <= .43,
        } : null,
        completedObjectives: encounter ? counts.get(encounter.id) ?? 0 : 0,
        requiredObjectives: encounter ? encounter.objective === 'recover-fragments' ? 3 : encounter.requiredKills ?? 0 : 0,
        engaged: closestDistance < (closest?.site?.attackRange ?? Math.max(650, closest?.mission?.activationRadius ?? 650)) || boss !== null,
      }
    },

    dispose() {
      for (const bolt of bolts) bolt.mesh.dispose(false, false)
      for (const mesh of [...playerBoltPool, ...hostileBoltPool, ...templates]) mesh.dispose(false, false)
      for (const actor of cachedVisuals) actor.root?.dispose(false, false)
      fleetModels.dispose()
      for (const pickup of pickups) pickup.mesh?.dispose()
      shotMaterial.dispose()
      pickupMaterial.dispose()
      for (const material of hostileMaterials.values()) material.dispose()
    },
  }
}
