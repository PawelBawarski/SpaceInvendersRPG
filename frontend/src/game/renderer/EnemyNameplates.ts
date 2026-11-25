import { Camera, Matrix, Vector3 } from '@babylonjs/core'
import type { EnemyNameplateTarget } from './WorldCombat'
import type { PlanetSite } from '../domain/exploration'
import { segmentBoundsOverlapSphere } from './collisionBroadphase'
import { segmentSphereContact } from './worldCombatMath'

export interface EnemyNameplate {
  id: string; name: string; level: number; boss: boolean; x: number; y: number
}

/** Called at HUD frequency; labels reuse the DOM and allocate no GPU textures or meshes. */
export function projectEnemyNameplates(targets: readonly EnemyNameplateTarget[], camera: Camera, planets: readonly PlanetSite[], language: 'pl' | 'en'): EnemyNameplate[] {
  const engine = camera.getEngine()
  const width = engine.getRenderWidth()
  const height = engine.getRenderHeight()
  const viewport = camera.viewport.toGlobal(width, height)
  const transform = camera.getTransformationMatrix()
  const above = new Vector3()
  const projected = new Vector3()
  const bodyScreen = new Vector3()
  const up = camera.getDirection(Vector3.UpReadOnly)
  const visible = targets.filter(target => Vector3.DistanceSquared(camera.position, target.position) < (target.boss ? 1600 : 950) ** 2)
    .sort((left, right) => Number(right.boss) - Number(left.boss) || Vector3.DistanceSquared(camera.position, left.position) - Vector3.DistanceSquared(camera.position, right.position))
  const labels: EnemyNameplate[] = []
  for (const target of visible) {
    Vector3.ProjectToRef(target.position, Matrix.IdentityReadOnly, transform, viewport, bodyScreen)
    if (bodyScreen.z < 0 || bodyScreen.z > 1 || bodyScreen.x < 0 || bodyScreen.x > width || bodyScreen.y < 0 || bodyScreen.y > height) continue
    above.copyFrom(up).scaleInPlace(target.hitRadius * 1.25 + 2).addInPlace(target.position)
    Vector3.ProjectToRef(above, Matrix.IdentityReadOnly, transform, viewport, projected)
    projected.x = Math.max(80, Math.min(width - 80, projected.x))
    projected.y = Math.max(36, Math.min(height - 20, projected.y))
    if (planets.some(planet => segmentBoundsOverlapSphere(camera.position, target.position, planet, planet.radius)
      && segmentSphereContact(camera.position, target.position, planet, planet.radius) !== null)) continue
    labels.push({ id: target.id, name: target.name[language], level: target.level, boss: target.boss, x: projected.x / width * 100, y: projected.y / height * 100 })
    if (labels.length >= 32) break
  }
  return labels
}
