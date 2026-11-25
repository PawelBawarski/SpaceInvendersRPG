import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { createSceneMaterial } from './sectorDepth'

export function createImpactEffect(
  scene: Scene,
  position: Vector3,
  color: Color3,
  size = 1,
): void {
  const root = new TransformNode('impactEffect', scene)
  root.position.copyFrom(position)

  const material = createSceneMaterial('impactEffectMaterial', scene)
  material.diffuseColor.copyFrom(color)
  material.emissiveColor.copyFrom(color).scaleInPlace(1.7)
  material.disableLighting = true
  material.alpha = 1

  const rings = [0, 1].map((index) => {
    const ring = MeshBuilder.CreateTorus(`impactRing${index}`, {
      diameter: index === 0 ? 1.8 : 1.1,
      thickness: index === 0 ? 0.16 : 0.1,
      tessellation: 32,
    }, scene)
    ring.parent = root
    ring.rotation.x = Math.PI / 2 + index * 0.48
    ring.rotation.z = index * 0.55
    ring.material = material
    return ring
  })

  const flash = MeshBuilder.CreateSphere('impactFlash', { diameter: 0.9 }, scene)
  flash.parent = root
  flash.material = material

  const sparks: Array<{ mesh: Mesh; velocity: Vector3 }> = []
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12 + Math.random() * 0.18
    const vertical = (Math.random() - 0.5) * 1.4
    const spark = MeshBuilder.CreateSphere(`impactSpark${index}`, { diameter: 0.2 }, scene)
    spark.parent = root
    spark.material = material
    sparks.push({
      mesh: spark,
      velocity: new Vector3(Math.cos(angle), Math.sin(angle), vertical).scale((8 + Math.random() * 5) * size),
    })
  }

  let elapsed = 0
  const observer = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
    elapsed += dt
    const progress = Math.min(1, elapsed / 0.5)
    rings.forEach((ring, index) => {
      ring.scaling.setAll((0.12 + Math.max(0, progress - index * 0.12) * 3.2) * size)
      ring.rotation.y += dt * (index === 0 ? 1.2 : -1.6)
    })
    flash.scaling.setAll(Math.max(0, 1 - progress * 1.8) * size)
    material.alpha = 1 - progress

    for (const spark of sparks) {
      spark.mesh.position.addInPlace(spark.velocity.scale(dt))
      spark.mesh.scaling.setAll(Math.max(0, 1 - progress * 1.2))
    }

    if (elapsed >= 0.5) {
      scene.onBeforeRenderObservable.remove(observer)
      root.dispose(false, false)
      material.dispose()
    }
  })
}
