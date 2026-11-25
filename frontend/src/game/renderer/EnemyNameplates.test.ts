import { afterEach, describe, expect, it } from 'vitest'
import { FreeCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'
import { ORION_PLANETS } from '../domain/exploration'
import { projectEnemyNameplates } from './EnemyNameplates'

const engines: NullEngine[] = []
afterEach(() => { for (const engine of engines.splice(0)) engine.dispose() })

describe('enemy nameplate visibility', () => {
  it('projects names above the enemy and hides labels behind the camera, far away or behind a planet', () => {
    const engine = new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 4 })
    engines.push(engine)
    const scene = new Scene(engine)
    const camera = new FreeCamera('camera', Vector3.Zero(), scene)
    camera.setTarget(Vector3.Forward())
    camera.maxZ = 3000
    camera.getViewMatrix(true)
    camera.getProjectionMatrix(true)
    const enemy = { id: 'visible', position: new Vector3(0, 0, 100), name: { pl: 'Strażnik', en: 'Warden' }, level: 10, boss: true, hitRadius: 10,
      health: 70, maxHealth: 100, shield: 10, maxShield: 40, hitFlash: .2 }
    const labels = projectEnemyNameplates([enemy,
      { ...enemy, id: 'behind', position: new Vector3(0, 0, -100) },
      { ...enemy, id: 'far', position: new Vector3(0, 0, 2000) },
    ], camera, [], 'pl')
    expect(labels).toHaveLength(1)
    expect(labels[0]).toMatchObject({ id: 'visible', name: 'Strażnik', level: 10, boss: true, x: 50, health: 70, maxHealth: 100, shield: 10, maxShield: 40 })
    expect(labels[0].y).toBeLessThan(50)
    const largeBoss = projectEnemyNameplates([{ ...enemy, hitRadius: 100 }], camera, [], 'pl')
    expect(largeBoss).toHaveLength(1)
    expect(largeBoss[0].y).toBeGreaterThan(0)
    const planet = { ...ORION_PLANETS[0], x: 0, y: 0, z: 50, radius: 20 }
    expect(projectEnemyNameplates([enemy], camera, [planet], 'en')).toHaveLength(0)
    expect(projectEnemyNameplates([enemy], camera, [{ ...planet, x: 100 }], 'en')[0].name).toBe('Warden')
  })
})
