import { afterEach, describe, expect, it, vi } from 'vitest'
import { MeshBuilder, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { createWorldShip, getGalaxyWorld, ORION_DRONES, ORION_PLANETS, type GalaxyWorld } from '../domain/exploration'
import { buildMissionHostiles, getMission, MISSIONS, type MissionId } from '../missions/definitions'
import { completeWorldMission, createEmptyMissionProgress, recordMissionObjectiveProgress, type MissionProgress } from '../progress/missionProgress'
import { createWorldCombat, type WorldCombatInput } from './WorldCombat'

vi.mock('./DamageNumber', () => ({
  createDamageNumber: (scene: Scene) => ({
    mesh: MeshBuilder.CreatePlane('testDamageNumber', {}, scene), remaining: 1, lifetime: 1, createdAt: 0,
  }),
}))
const resources: Array<{ dispose: () => void }> = []
afterEach(() => { for (const resource of resources.splice(0).reverse()) resource.dispose(); vi.restoreAllMocks() })

function setup(initial = createEmptyMissionProgress(), world?: GalaxyWorld) {
  const engine = new NullEngine({ renderWidth: 800, renderHeight: 600, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 4 })
  resources.push(engine)
  const scene = new Scene(engine)
  resources.push(scene)
  let progress: MissionProgress = initial
  const complete = vi.fn((id: MissionId) => { progress = completeWorldMission(progress, id) })
  const advance = vi.fn((id: MissionId, count: number) => { progress = recordMissionObjectiveProgress(progress, id, count) })
  const hit = vi.fn()
  const impact = vi.fn()
  const contact = vi.fn()
  const defeated = vi.fn((id: string) => { progress = { ...progress, defeatedDrones: [...progress.defeatedDrones, id] } })
  const combat = createWorldCombat(scene, {
    getProgress: () => progress, onPlayerHit: hit, onEnemyDefeated: defeated,
    onMissionComplete: complete, onMissionProgress: advance, onMessage: vi.fn(), onShot: vi.fn(),
    onImpact: impact, onPlayerContact: contact, damageNumbers: [],
  }, world)
  resources.push(combat)
  const update = (position: Vector3, options: Partial<WorldCombatInput> = {}, seconds = 0.1) => combat.update(seconds, {
    position, previousPosition: position.clone(), velocity: Vector3.Zero(), forward: Vector3.Forward(), right: Vector3.Right(),
    firing: false, bonuses: { damagePercent: 0, shieldPoints: 0, hullPoints: 0, enginePercent: 0 }, weaponRarity: 'standard', ...options,
  })
  return { combat, scene, update, hit, complete, advance, defeated, impact, contact, getProgress: () => progress }
}

describe('physical world encounters', () => {
  it('flashes a shield hit on the shot side, with shared render geometry for matching ships', () => {
    vi.spyOn(Math, 'random').mockReturnValue(.5)
    const drones = [
      createWorldShip('shielded-a', 'meridian', 'frigate', { x: 0, y: 0, z: 100 }),
      createWorldShip('shielded-b', 'meridian', 'frigate', { x: 180, y: 0, z: 100 }),
    ].map(drone => ({ ...drone, speed: 0 }))
    const { combat, scene, update, impact } = setup(undefined, { ...getGalaxyWorld('vesper', 0), drones, planets: [] })
    for (let frame = 0; frame < 12 && impact.mock.calls.length === 0; frame++) update(Vector3.Zero(), { firing: true }, .04)
    const [point, normal, , kind] = impact.mock.calls[0]
    expect(kind).toBe('shield')
    expect(point.z).toBeLessThan(100)
    expect(normal.z).toBeLessThan(0)
    const target = combat.getNameplateTargets().find(actor => actor.id === 'shielded-a')!
    expect(target.shield).toBeLessThan(target.maxShield)
    expect(target.health).toBe(target.maxHealth)
    expect(target.hitFlash).toBeGreaterThan(0)
    const parts = drones.map(drone => scene.getTransformNodeByName(drone.id)!.getChildMeshes())
    expect(parts[0]).toHaveLength(4)
    expect(parts[0].every(mesh => mesh.isEnabled())).toBe(true)
    expect(parts[0].map(mesh => mesh.geometry)).toEqual(parts[1].map(mesh => mesh.geometry))
  })

  it('sweeps ship contact at speed and keeps boss hull and shield immune to ramming', () => {
    const drone = { ...createWorldShip('ram-test', 'meridian', 'bomber', { x: 0, y: 0, z: 100 }), speed: 0 }
    const { combat, update, hit, impact, contact } = setup(undefined, { ...getGalaxyWorld('vesper', 0), drones: [drone], planets: [] })
    const behind = new Vector3(0, 0, 60)
    const through = new Vector3(0, 0, 145)
    update(behind)
    update(through, { previousPosition: behind })
    expect(hit).toHaveBeenCalledExactlyOnceWith(expect.any(Number), expect.objectContaining({ kind: 'collision' }))
    expect(contact).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ z: expect.any(Number) }))
    expect(contact.mock.calls[0][0].z).toBeLessThan(100)
    expect(impact).toHaveBeenCalledExactlyOnceWith(expect.any(Vector3), expect.any(Vector3), expect.any(Number), 'collision')
    const survivor = combat.getNameplateTargets()[0]
    expect(survivor.health + survivor.shield).toBeLessThan(survivor.maxHealth + survivor.maxShield)
    update(through, { previousPosition: behind })
    expect(hit).toHaveBeenCalledTimes(1)

    const bossCombat = setup()
    const site = getMission('warden').worldPosition
    const start = new Vector3(site.x, site.y, site.z - 170)
    bossCombat.update(start)
    const bossVitals = bossCombat.combat.getStatus().boss
    bossCombat.update(new Vector3(site.x, site.y, site.z + 150), { previousPosition: start })
    expect(bossCombat.hit).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({ kind: 'collision' }))
    expect(bossCombat.impact).not.toHaveBeenCalled()
    expect(bossCombat.combat.getStatus().boss).toMatchObject({ health: bossVitals!.health, shield: bossVitals!.shield })
  })

  it('flies roaming trios along the same route with stable wing spacing', () => {
    const { combat, update, scene } = setup()
    const player = new Vector3(-600, 600, 9200)
    update(player)
    const nodes = () => scene.transformNodes.filter(node => node.metadata?.formationId === 'squadron-1')
    expect(nodes()).toHaveLength(3)
    const before = nodes().map(node => node.position.clone())
    for (let frame = 0; frame < 100; frame++) update(player)
    expect(combat.getPerformanceStats().patrolGroups).toBe(new Set(ORION_DRONES.flatMap(site => site.formation ? [site.formation.id] : [])).size)
    const after = nodes()
    expect(Vector3.Distance(before[0], after[0].position)).toBeGreaterThan(60)
    for (let index = 1; index < 3; index++) {
      expect(Vector3.Distance(after[0].position, after[index].position)).toBeCloseTo(Vector3.Distance(before[0], before[index]), 4)
      expect(after[index].rotation.y).toBeCloseTo(after[0].rotation.y)
    }
  })

  it('alerts the whole trio when only a wingman is within engagement range', () => {
    const members = ORION_DRONES.filter(site => site.formation?.id === 'squadron-1')
    const leader = new Vector3(members[0].x, members[0].y, members[0].z)
    const wing = new Vector3(members[1].x, members[1].y, members[1].z)
    const player = leader.add(wing.subtract(leader).scale(2.2))
    expect(Vector3.Distance(player, leader)).toBeGreaterThan(members[0].attackRange! * 1.5)
    const { update, scene } = setup()
    update(player)
    const root = scene.transformNodes.find(node => node.metadata?.worldEnemyId === members[0].id)!
    const before = Vector3.Distance(root.position, player)
    update(player)
    expect(before - Vector3.Distance(root.position, player)).toBeGreaterThan(1.7)
  })

  it('skips exact collision work in empty space and reuses a bounded set of shot meshes', () => {
    const { combat, update, scene } = setup()
    const position = new Vector3(-30000, -18000, 1000)
    for (let frame = 0; frame < 500; frame++) update(position, { firing: true })
    const stats = combat.getPerformanceStats()
    expect(stats.totalActors).toBeGreaterThan(90)
    expect(stats.totalActors).toBeGreaterThan(3000)
    expect(stats.actorCandidates).toBeLessThan(stats.totalActors / 100)
    expect(stats.activeActors).toBe(0)
    expect(stats.boltPlanetBoundsChecks).toBeGreaterThan(0)
    expect(stats.boltPlanetExactChecks).toBe(0)
    expect(stats.boltActorBoundsChecks).toBe(0)
    expect(stats.boltActorExactChecks).toBe(0)
    expect(stats.boltMeshAllocations).toBeLessThanOrEqual(32)
    expect(stats.boltMeshReuses).toBeGreaterThan(400)
    for (let frame = 0; frame < 40; frame++) update(position)
    const idle = combat.getPerformanceStats()
    expect(idle.activeBolts).toBe(0)
    expect(idle.pooledBolts).toBeLessThanOrEqual(48)
    expect(scene.meshes.filter(mesh => mesh.name === 'worldPlayerBolt')).toHaveLength(0)
    expect(scene.getMaterialByName('worldPlayerShotMaterial')).not.toBeNull()
    const geometries = scene.meshes.filter(mesh => mesh.name === 'pooledPlayerBolt' || mesh.name === 'worldPlayerBoltTemplate').map(mesh => mesh.geometry)
    expect(new Set(geometries).size).toBe(1)
  })

  it('keeps planets between the player and a distant orbital enemy solid to pooled shots', () => {
    const progress = { ...createEmptyMissionProgress(), completedMissions: MISSIONS.filter(mission => mission.id !== 'glass-orbit').map(mission => mission.id) }
    const { combat, update, defeated } = setup(progress)
    const planet = ORION_PLANETS[0]
    const position = new Vector3(planet.x, planet.y, planet.z - planet.radius - 20)
    let exactPlanetChecks = 0
    for (let frame = 0; frame < 100; frame++) {
      update(position, { firing: true })
      exactPlanetChecks += combat.getPerformanceStats().boltPlanetExactChecks
    }
    expect(exactPlanetChecks).toBeGreaterThan(0)
    expect(defeated).not.toHaveBeenCalled()
  })

  it('completes an orbital mission by defeating its whole fleet around the planet', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { combat, update, complete, getProgress } = setup()
    const planet = ORION_PLANETS[0]
    let position = new Vector3(planet.x, planet.y, planet.z - planet.radius - 150)
    for (let frame = 0; frame < 240; frame++) {
      const target = combat.getNavigationTarget('glass-orbit', position)
      if (!target) break
      position = target.subtract(new Vector3(0, 0, 30))
      update(position, { firing: true, bonuses: { damagePercent: 200, shieldPoints: 0, hullPoints: 0, enginePercent: 0 } })
    }
    expect(getProgress().missionObjectiveProgress['glass-orbit']).toBe(6)
    expect(complete).toHaveBeenCalledExactlyOnceWith('glass-orbit')
    expect(combat.getNavigationTarget('glass-orbit', position)).toBeNull()
  })
  it('starts outside combat and exposes a distant boss without completing earlier missions', () => {
    const { combat, update } = setup()
    update(Vector3.Zero())
    expect(combat.getStatus().engaged).toBe(false)
    expect(combat.getStatus().boss).toBeNull()
    const mission = getMission('meridian-warlord')
    const site = mission.worldPosition
    update(new Vector3(site.x, site.y, site.z - 500))
    expect(combat.getStatus().mission?.id).toBe(mission.id)
    expect(combat.getStatus().boss?.maximumHealth).toBe(mission.bossProfile?.health)
    expect(combat.getStatus().boss?.maximumShield).toBe(mission.bossProfile?.shield)
  })

  it('keeps a completed boss and its escorts absent when returning to the world', () => {
    const progress = completeWorldMission(createEmptyMissionProgress(), 'warden')
    const { combat, update, scene } = setup(progress)
    const site = getMission('warden').worldPosition
    update(new Vector3(site.x, site.y, site.z - 50))
    expect(combat.getStatus().boss).toBeNull()
    expect(scene.transformNodes.some(node => node.metadata?.missionId === 'warden')).toBe(false)
  })

  it('hits the player at the same distance at which the boss HUD becomes active', () => {
    const { combat, update, hit } = setup()
    const site = getMission('warden').worldPosition
    const position = new Vector3(site.x, site.y, site.z - 620)
    for (let frame = 0; frame < 110; frame++) update(position)
    expect(combat.getStatus().boss).not.toBeNull()
    expect(combat.getStatus().engaged).toBe(true)
    expect(hit).toHaveBeenCalledWith(getMission('warden').bossProfile?.damage, expect.objectContaining({ kind: 'weapon', label: getMission('warden').title }))
  })

  it('carries shield damage into hull and completes a boss only once', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { combat, update, complete } = setup()
    const site = getMission('warden').worldPosition
    const position = new Vector3(site.x, site.y, site.z - 100)
    const bonuses = { damagePercent: 500, shieldPoints: 0, hullPoints: 0, enginePercent: 0 }
    for (let frame = 0; frame < 100; frame++) update(position, { firing: true, bonuses })
    expect(complete.mock.calls.filter(([id]) => id === 'warden')).toHaveLength(1)
    expect(combat.getStatus().boss).toBeNull()
  })

  it('lets escorts take damage while the signal core is shielded', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const mission = getMission('signal-source')
    const escort = buildMissionHostiles(mission)[0]
    expect(escort).toBeDefined()
    const { update, defeated } = setup()
    const position = new Vector3(escort.x, escort.y, escort.z - 24)
    for (let frame = 0; frame < 23; frame++) update(position, { firing: true })
    expect(defeated).toHaveBeenCalledWith(escort.id)
  })

  it('restores the next salvage marker from progress and rewards all three boxes once', () => {
    const initial = recordMissionObjectiveProgress(createEmptyMissionProgress(), 'silent-signal', 1)
    const { combat, update, advance, complete } = setup(initial)
    const center = getMission('silent-signal').worldPosition
    const later = new Vector3(center.x + 35, center.y, center.z + 48)
    update(later)
    expect(advance).not.toHaveBeenCalled()
    const next = combat.getNavigationTarget('silent-signal', later)!.clone()
    expect(next.y).toBe(center.y + 9)
    update(next)
    update(later)
    update(later)
    expect(advance.mock.calls).toEqual([['silent-signal', 2], ['silent-signal', 3]])
    expect(complete).toHaveBeenCalledExactlyOnceWith('silent-signal')
    expect(combat.getNavigationTarget('silent-signal', later)).toBeNull()
  })
})
