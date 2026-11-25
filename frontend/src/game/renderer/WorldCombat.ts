import { Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core'
import { FACTIONS, ORION_DRONES, ORION_PLANETS, SHIP_ARCHETYPES, type DroneSite, type FactionId, type ShipArchetype } from '../domain/exploration'
import { resolveBossDamage } from '../domain/combat'
import { getSignalPulseState } from '../domain/signalPulse'
import { applyArmorDamage, PLAYER_WEAPON, resolveWeaponHit } from '../domain/weapon'
import { buildMissionHostiles, isMissionComplete, MISSIONS, type MissionDefinition, type MissionId } from '../missions/definitions'
import type { MissionProgress } from '../progress/missionProgress'
import type { ShipPartBonuses, ShipPartRarity } from '../progress/shipParts'
import { createImpactEffect } from './ImpactEffect'
import { createDamageNumber, type FloatingDamageNumber } from './DamageNumber'
import { createFactionShipVisual, createWorldBossVisual } from './WorldFleetVisual'
import { segmentSphereContact } from './worldCombatMath'
import { segmentBoundsOverlapSphere } from './collisionBroadphase'
import { BOSS_VISUAL_SCALE, ENEMY_VISUAL_SCALE } from '../domain/enemyScale'
import type { DamageSource } from '../domain/damageFeedback'
import { getEnemyIdentity } from '../domain/enemyIdentity'
import { sampleFormationPosition, samplePatrolRoute, type PatrolFormation } from '../domain/patrolFormation'
import { SpatialIndex } from '../simulation/SpatialIndex'

export interface EnemyNameplateTarget {
  id: string
  position: Vector3
  name: { pl: string; en: string }
  level: number
  boss: boolean
  hitRadius: number
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
  sequence: number
  hitRadius: number
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
  boss: { health: number; maximumHealth: number; shield: number; maximumShield: number } | null
  completedObjectives: number
  requiredObjectives: number
  engaged: boolean
  targetName: string | null
  targetHealth: number
  targetMaximumHealth: number
  faction: FactionId | null
}

interface CombatCallbacks {
  getProgress: () => MissionProgress
  onPlayerHit: (amount: number, source?: DamageSource) => void
  onEnemyDefeated: (id: string) => void
  onMissionComplete: (id: MissionId) => void
  onMissionProgress: (id: MissionId, count: number) => void
  onMessage: (polish: string, english: string) => void
  onShot: () => void
  onImpact: () => void
  damageNumbers: FloatingDamageNumber[]
}

export interface WorldCombatInput {
  position: Vector3
  previousPosition: Vector3
  velocity: Vector3
  forward: Vector3
  right: Vector3
  firing: boolean
  bonuses: ShipPartBonuses
  weaponRarity: ShipPartRarity
}

const RENDER_DISTANCE = 3200
const ACTIVE_ENEMY_LIMIT = 96
const MAX_IDLE_BOLT_MESHES = 48

export function createWorldCombat(scene: Scene, callbacks: CombatCallbacks) {
  const initial = callbacks.getProgress()
  const finished = new Set<MissionId>(MISSIONS.filter(mission => isMissionComplete(initial, mission.id)).map(mission => mission.id))
  const counts = new Map<MissionId, number>(MISSIONS.map(mission => [mission.id, initial.missionObjectiveProgress?.[mission.id] ?? 0]))
  const defeated = new Set(initial.defeatedDrones)
  const actors: Actor[] = []
  const actorIds = new Set<string>()
  const spatial = new SpatialIndex<Actor>(4000, actor => actor.position)
  const cachedVisuals = new Set<Actor>()
  const awake = new Set<Actor>()
  let awakeGroups = new Set<PatrolGroup>()
  let formationClock = 1
  let visualCleanupClock = 0
  let candidateCount = 0
  const pickups: Pickup[] = []
  const bolts: Bolt[] = []
  const activeActors: Actor[] = []
  const groups = new Map<string, PatrolGroup>()
  const formationTravel = new Vector3()
  const planets = ORION_PLANETS.map(site => ({ center: new Vector3(site.x, site.y, site.z), radius: site.radius }))
  const missionPositions = new Map(MISSIONS.map(mission => [mission.id, new Vector3(mission.worldPosition.x, mission.worldPosition.y, mission.worldPosition.z)]))
  const zero = Vector3.Zero()
  const previousBoltPosition = new Vector3()
  const relativeFrom = new Vector3()
  const relativeTo = new Vector3()
  const travel = new Vector3()
  const originOffset = new Vector3()
  const factionColors = new Map(Object.entries(FACTIONS).map(([id, faction]) => [id as FactionId, Color3.FromHexString(faction.accent)]))
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
  const session = Date.now().toString(36)
  const shotMaterial = new StandardMaterial('worldPlayerShotMaterial', scene)
  shotMaterial.disableLighting = true
  shotMaterial.emissiveColor = new Color3(1, 0.68, 0.28)
  const hostileMaterials = new Map<FactionId, StandardMaterial>()
  for (const faction of Object.keys(FACTIONS) as FactionId[]) {
    const material = new StandardMaterial(`worldHostileShot-${faction}`, scene)
    material.disableLighting = true
    material.emissiveColor = Color3.FromHexString(FACTIONS[faction].accent).scale(1.1)
    hostileMaterials.set(faction, material)
  }
  const pickupMaterial = new StandardMaterial('worldRelayPickupMaterial', scene)
  pickupMaterial.diffuseColor = new Color3(0.15, 0.35, 0.42)
  pickupMaterial.emissiveColor = new Color3(0.08, 0.55, 0.72)
  let elapsed = 0
  let playerFireClock = 0
  let latestStatus: WorldCombatStatus = {
    mission: null, boss: null, completedObjectives: 0, requiredObjectives: 0,
    engaged: false, targetName: null, targetHealth: 0, targetMaximumHealth: 0, faction: null,
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
    const actor: Actor = {
      id: site.id, position, previousPosition: position.clone(), origin: position.clone(), root: null, site, mission,
      faction: site.faction ?? mission?.faction ?? 'meridian', archetype,
      ...getEnemyIdentity(site.faction ?? mission?.faction ?? 'meridian', archetype, site.health, 0, site.damage ?? SHIP_ARCHETYPES[archetype].damage),
      health: site.health, maxHealth: site.health, shield: 0, maxShield: 0,
      defeated: mission !== null && (finished.has(mission.id) || defeated.has(site.id)),
      fireClock: 0.5 + actors.length % 5 * 0.2, respawn: 0, sequence: 0,
      hitRadius: (archetype === 'frigate' ? 3.7 : archetype === 'bomber' ? 2.2 : 1.65) * ENEMY_VISUAL_SCALE,
      formationTarget: site.formation ? position.clone() : null,
    }
    actors.push(actor)
    if (!actor.defeated) spatial.update(actor)
    if (site.formation) {
      let group = groups.get(site.formation.id)
      if (!group) {
        group = { route: site.formation, center: new Vector3(), forward: new Vector3(), members: [], alerted: false }
        groups.set(site.formation.id, group)
      }
      group.members.push(actor)
    }
  }

  for (const site of ORION_DRONES) if (!site.missionId) addShip(site, null)
  for (const mission of MISSIONS) {
    if (mission.bossProfile) {
      const position = new Vector3(mission.worldPosition.x, mission.worldPosition.y, mission.worldPosition.z)
      actors.push({
        id: `world-boss-${mission.id}`, position, previousPosition: position.clone(), origin: position.clone(), root: null, site: null, mission,
        faction: mission.faction, archetype: 'frigate', health: mission.bossProfile.health,
        ...getEnemyIdentity(mission.faction, 'frigate', mission.bossProfile.health, mission.bossProfile.shield, mission.bossProfile.damage, mission.id),
        maxHealth: mission.bossProfile.health, shield: mission.bossProfile.shield,
        maxShield: mission.bossProfile.shield, defeated: finished.has(mission.id), fireClock: 1.8,
        respawn: 0, sequence: 0, hitRadius: (mission.id === 'null-choir' ? 7.2 : 6) * BOSS_VISUAL_SCALE,
        formationTarget: null,
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

  const complete = (mission: MissionDefinition) => {
    if (finished.has(mission.id)) return
    finished.add(mission.id)
    callbacks.onMissionComplete(mission.id)
    callbacks.onMessage(`Cel ukończony: ${mission.title.pl}`, `Objective complete: ${mission.title.en}`)
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
    actor.respawn = actor.mission ? Infinity : elapsed + 28
    if (actor.mission) spatial.remove(actor)
    actor.sequence += 1
    callbacks.onEnemyDefeated(actor.mission ? actor.id : `${actor.id}-${session}-${actor.sequence}`)
    if (actor.mission) {
      if (!actor.site && actor.mission.bossProfile) complete(actor.mission)
      else if (!finished.has(actor.mission.id)) advanceObjective(actor.mission)
    }
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
    bolts.push({ mesh, velocity, damage, critical, hostile, source, remaining: hostile ? 8 : 2.8 })
  }

  const releaseBolt = (bolt: Bolt) => {
    bolt.mesh.setEnabled(false)
    bolt.mesh.name = bolt.hostile ? 'pooledHostileBolt' : 'pooledPlayerBolt'
    const pool = bolt.hostile ? hostileBoltPool : playerBoltPool
    if (pool.length < MAX_IDLE_BOLT_MESHES) pool.push(bolt.mesh)
    else bolt.mesh.dispose(false, false)
  }

  const pickAimTarget = (input: WorldCombatInput) => {
    let best: Actor | null = null
    let bestScore = Infinity
    for (const actor of activeActors) {
      if (actor.defeated) continue
      const difference = actor.position.subtract(input.position)
      const distance = difference.length()
      if (distance > 580 || distance < 0.001) continue
      const alignment = Vector3.Dot(difference.scale(1 / distance), input.forward)
      if (alignment < 0.93) continue
      const score = distance + (1 - alignment) * 700
      if (score < bestScore) { best = actor; bestScore = score }
    }
    return best
  }

  const streaming = { totalActors: actors.length, activeLimit: ACTIVE_ENEMY_LIMIT, activeActors: 0, candidates: 0, cachedVisuals: 0, patrolGroups: groups.size }
  scene.metadata = { ...scene.metadata, combatStreaming: streaming }

  return {
    getStatus(): WorldCombatStatus { return latestStatus },
    getNameplateTargets(): readonly EnemyNameplateTarget[] { return activeActors.filter(actor => !actor.defeated) },

    getPerformanceStats() {
      return { totalActors: actors.length, totalPlanets: planets.length, activeActors: activeActors.length, actorCandidates: candidateCount, activeLimit: ACTIVE_ENEMY_LIMIT, cachedVisuals: cachedVisuals.size, patrolGroups: groups.size,
        activeBolts: bolts.length, pooledBolts: playerBoltPool.length + hostileBoltPool.length,
        boltMeshAllocations, boltMeshReuses, boltPlanetBoundsChecks, boltPlanetExactChecks, boltActorBoundsChecks, boltActorExactChecks }
    },

    getNavigationTarget(missionId: MissionId, position: Vector3): Vector3 | null {
      if (finished.has(missionId)) return null
      const pickup = pickups.find(item => item.mission.id === missionId && !item.collected)
      if (pickup) return pickup.position
      let closest: Actor | null = null
      let distance = Infinity
      for (const actor of actors) {
        if (actor.defeated || actor.mission?.id !== missionId) continue
        if (!actor.site) return actor.position
        const candidateDistance = Vector3.DistanceSquared(position, actor.position)
        if (candidateDistance < distance) { closest = actor; distance = candidateDistance }
      }
      return closest?.position ?? null
    },

    update(dt: number, input: WorldCombatInput) {
      const previouslyActive = [...activeActors]
      activeActors.length = 0
      boltPlanetBoundsChecks = boltPlanetExactChecks = boltActorBoundsChecks = boltActorExactChecks = 0
      elapsed += dt
      formationClock += dt
      visualCleanupClock += dt
      playerFireClock = Math.max(0, playerFireClock - dt)
      for (const mission of MISSIONS) {
        if (isMissionComplete(callbacks.getProgress(), mission.id)) finished.add(mission.id)
      }
      let closest: Actor | null = null
      let closestDistance = Infinity
      let boss: Actor | null = null
      let encounter: MissionDefinition | null = null
      let encounterDistance = Infinity
      for (const mission of MISSIONS) {
        if (finished.has(mission.id)) continue
        const distance = Vector3.Distance(input.position, missionPositions.get(mission.id)!)
        const activationRadius = mission.bossProfile ? Math.max(650, mission.activationRadius) : mission.activationRadius
        if (distance <= activationRadius && distance < encounterDistance) { encounter = mission; encounterDistance = distance }
      }

      if (formationClock >= 0.25) {
        formationClock = 0
        for (const group of groups.values()) if (!awakeGroups.has(group)) syncFormation(group)
      }
      for (const group of awakeGroups) syncFormation(group)
      const candidates = spatial.query(input.position, RENDER_DISTANCE + 250)
      candidateCount = candidates.length
      candidates.sort((a, b) => Number(!b.site) - Number(!a.site) || Vector3.DistanceSquared(input.position, a.position) - Vector3.DistanceSquared(input.position, b.position))
      const selected = candidates.slice(0, ACTIVE_ENEMY_LIMIT)
      const selectedSet = new Set(selected)
      for (const actor of previouslyActive) if (!selectedSet.has(actor)) actor.root?.setEnabled(false)
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
        actor.previousPosition.copyFrom(actor.position)
        const group = actor.site?.formation ? groups.get(actor.site.formation.id)! : null
        if (actor.defeated) {
          if (!actor.mission) {
            if (elapsed >= actor.respawn) {
              actor.defeated = false
              actor.health = actor.maxHealth
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
          if (distance > RENDER_DISTANCE * 3 && actor.root) { actor.root.dispose(false, true); actor.root = null }
          continue
        }
        if (!actor.root) {
          actor.root = actor.site
            ? createFactionShipVisual(scene, actor.id, actor.faction, actor.archetype)
            : createWorldBossVisual(scene, actor.id, actor.faction, actor.mission?.id === 'null-choir' || actor.maxHealth >= 700)
          actor.root.metadata = { worldEnemyId: actor.id, faction: actor.faction, archetype: actor.archetype, missionId: actor.mission?.id, hitRadius: actor.hitRadius, enemyName: actor.name, enemyLevel: actor.level, formationId: actor.site?.formation?.id, formationSlot: actor.site?.formation?.slot }
          cachedVisuals.add(actor)
        }
        actor.root.setEnabled(true)
        activeActors.push(actor)
        awake.add(actor)
        const base = SHIP_ARCHETYPES[actor.archetype]
        const attackRange = actor.site?.attackRange ?? Math.max(650, actor.mission?.activationRadius ?? 650)
        if (group && actor.formationTarget && !group.alerted) {
          actor.formationTarget.subtractToRef(actor.position, formationTravel)
          const travelDistance = formationTravel.length()
          const step = group.route.speed * dt * 1.8
          if (travelDistance <= step) actor.position.copyFrom(actor.formationTarget)
          else actor.position.addInPlace(formationTravel.scaleInPlace(step / travelDistance))
        } else if (actor.site && (group?.alerted || distance < attackRange * 1.5)) {
          if (distance > Math.max(30, actor.hitRadius + 8)) {
            const step = input.position.subtract(actor.position).normalize().scale((actor.site.speed ?? base.speed) * dt)
            if (Vector3.Distance(actor.position.add(step), group?.center ?? actor.origin) < (group ? 500 : actor.mission ? 350 : 220)) actor.position.addInPlace(step)
          }
        } else {
          const patrol = actor.origin.add(new Vector3(Math.sin(elapsed * 0.55 + actor.origin.z) * (actor.site ? 4 : 8), Math.cos(elapsed * 0.4 + actor.origin.x) * (actor.site ? 2 : 3), 0))
          Vector3.LerpToRef(actor.position, patrol, Math.min(1, dt * 0.8), actor.position)
        }
        for (const planet of planets) {
          const center = planet.center
          const minimumRadius = planet.radius + actor.hitRadius + 12
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
        actor.root.rotation.y = group && !group.alerted ? Math.atan2(group.forward.x, group.forward.z) + Math.PI : Math.atan2(input.position.x - actor.position.x, input.position.z - actor.position.z) + Math.PI
        if (!actor.site) actor.root.rotation.z = Math.sin(elapsed * 0.3) * 0.15
        if (distance < closestDistance) { closest = actor; closestDistance = distance }
        if (!actor.site && distance < attackRange) boss = actor
        if (actor.mission && !finished.has(actor.mission.id) && distance < 300 && distance < encounterDistance) {
          encounter = actor.mission
          encounterDistance = distance
        }
        actor.fireClock -= dt
        if (distance > attackRange || actor.fireClock > 0) continue
        const profile = actor.site ? undefined : actor.mission?.bossProfile
        const rage = actor.health < actor.maxHealth * 0.45 ? 0.78 : 1
        actor.fireClock = (actor.site?.attackInterval ?? profile?.attackInterval ?? base.attackInterval) * rage
        const speed = actor.site?.projectileSpeed ?? profile?.projectileSpeed ?? base.projectileSpeed
        const amount = actor.site?.damage ?? profile?.damage ?? base.damage
        const lead = input.velocity.scale(Math.min(0.65, distance / Math.max(1, speed)))
        const direction = input.position.add(lead).subtract(actor.position).normalize()
        const pattern = profile?.pattern ?? (actor.archetype === 'frigate' ? 'fan' : 'aimed')
        const shots = pattern === 'fan' ? 3 : pattern === 'burst' ? 2 : pattern === 'spiral' ? 5 : 1
        for (let shot = 0; shot < shots; shot += 1) {
          const spread = pattern === 'spiral' ? (shot - 2) * 0.12 + Math.sin(elapsed) * 0.15 : (shot - (shots - 1) / 2) * 0.11
          const velocityDirection = new Vector3(direction.x + spread, direction.y + (pattern === 'spiral' ? Math.cos(shot + elapsed) * 0.08 : 0), direction.z).normalize()
          spawnBolt(actor.position.add(velocityDirection.scale(actor.hitRadius + 0.5)), velocityDirection, velocityDirection.scale(speed), amount, false, actor.faction, {
            position: { x: actor.position.x, y: actor.position.y, z: actor.position.z }, label: actor.mission?.title ?? FACTIONS[actor.faction].name, kind: 'weapon',
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
      for (const actor of activeActors) { actor.root!.position.copyFrom(actor.position); spatial.update(actor) }
      streaming.activeActors = activeActors.length
      streaming.candidates = candidateCount
      streaming.cachedVisuals = cachedVisuals.size
      if (visualCleanupClock >= 1) {
        visualCleanupClock = 0
        for (const actor of cachedVisuals) {
          if (Vector3.DistanceSquared(input.position, actor.position) <= (RENDER_DISTANCE * 3) ** 2) continue
          actor.root?.dispose(false, true)
          actor.root = null
          cachedVisuals.delete(actor)
        }
      }

      const aimTarget = pickAimTarget(input)
      if (input.firing && playerFireClock <= 0) {
        playerFireClock = PLAYER_WEAPON.fireCooldown
        callbacks.onShot()
        const hit = resolveWeaponHit(input.bonuses, Math.random, false, input.weaponRarity)
        for (const side of [-1, 1]) {
          const position = input.position.add(input.forward.scale(1.8)).addInPlace(input.right.scale(side * 1.1))
          const direction = aimTarget ? aimTarget.position.subtract(position).normalize() : input.forward.clone()
          spawnBolt(position, direction, direction.scale(PLAYER_WEAPON.projectileSpeed).add(input.velocity), hit.damage, hit.critical, null)
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
            callbacks.onPlayerHit(bolt.damage, bolt.source)
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
            const isSignalCore = !target.site && target.mission?.objective === 'disable-signal'
            const pulseOpen = !isSignalCore || getSignalPulseState(elapsed).open
            if (pulseOpen) {
              const damage = applyArmorDamage(bolt.damage, target.site ? target.archetype === 'frigate' ? 5 : 2 : 5)
              callbacks.damageNumbers.push(createDamageNumber(scene, target.position, damage, bolt.critical))
              const vitals = resolveBossDamage({ health: target.health, shield: target.shield, amount: damage })
              target.health = vitals.health
              target.shield = vitals.shield
              createImpactEffect(scene, target.position, factionColors.get(target.faction)!, target.site ? 0.55 : 1.2)
              callbacks.onImpact()
              if (target.health <= 0) destroyActor(target)
            }
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
          callbacks.onMessage('Odzyskano czarną skrzynkę przekaźnika.', 'Relay black box recovered.')
        }
      }

      const visibleTarget = aimTarget ?? (closestDistance < 230 ? closest : null)
      if (boss && !boss.defeated) encounter = boss.mission
      latestStatus = {
        mission: encounter,
        boss: boss && !boss.defeated ? {
          health: boss.health, maximumHealth: boss.maxHealth,
          shield: boss.mission?.objective === 'disable-signal' ? getSignalPulseState(elapsed).open ? 0 : boss.maxShield : boss.shield,
          maximumShield: boss.maxShield,
        } : null,
        completedObjectives: encounter ? counts.get(encounter.id) ?? 0 : 0,
        requiredObjectives: encounter ? encounter.objective === 'recover-fragments' ? 3 : encounter.requiredKills ?? 0 : 0,
        engaged: closestDistance < (closest?.site?.attackRange ?? Math.max(650, closest?.mission?.activationRadius ?? 650)) || boss !== null,
        targetName: visibleTarget ? visibleTarget.mission?.bossProfile && !visibleTarget.site
          ? visibleTarget.mission.title.pl : visibleTarget.archetype : null,
        targetHealth: visibleTarget?.health ?? 0,
        targetMaximumHealth: visibleTarget?.maxHealth ?? 0,
        faction: visibleTarget?.faction ?? null,
      }
    },

    dispose() {
      for (const bolt of bolts) bolt.mesh.dispose(false, false)
      for (const mesh of [...playerBoltPool, ...hostileBoltPool, ...templates]) mesh.dispose(false, false)
      for (const actor of actors) actor.root?.dispose(false, true)
      for (const pickup of pickups) pickup.mesh?.dispose()
      shotMaterial.dispose()
      pickupMaterial.dispose()
      for (const material of hostileMaterials.values()) material.dispose()
    },
  }
}
