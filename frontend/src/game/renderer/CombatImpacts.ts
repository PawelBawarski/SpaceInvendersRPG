import { Color3, Constants, MeshBuilder, Quaternion, Scene, Vector3 } from './babylon'
import { createSceneMaterial } from './sectorDepth'

export type CombatImpactKind = 'armor' | 'shield' | 'collision'
const LIFETIME = .34
const POOL_SIZE = 24

/** One pooled ring and core per hit, attached to the world-space contact point. */
export function createCombatImpacts(scene: Scene) {
  const palette: Record<CombatImpactKind, string> = { armor: '#ff8c49', shield: '#69ddff', collision: '#ffecac' }
  const materials = Object.fromEntries(Object.entries(palette).map(([kind, tint]) => {
    const material = createSceneMaterial(`combatImpact-${kind}`, scene)
    material.disableLighting = true
    material.diffuseColor = Color3.Black()
    material.emissiveColor = Color3.FromHexString(tint).scale(1.32)
    material.alphaMode = Constants.ALPHA_ADD
    material.disableDepthWrite = true
    material.alpha = .85
    return [kind, material]
  }))
  const ringTemplate = MeshBuilder.CreateTorus('impactRingTemplate', { diameter: 2, thickness: .11, tessellation: 28 }, scene)
  const sparkTemplate = MeshBuilder.CreateSphere('impactCoreTemplate', { diameter: 2, segments: 8 }, scene)
  ringTemplate.setEnabled(false)
  sparkTemplate.setEnabled(false)
  const entries = Array.from({ length: POOL_SIZE }, (_, index) => {
    const ring = ringTemplate.clone(`combatHitRing-${index}`)!
    const spark = sparkTemplate.clone(`combatHitFlash-${index}`)!
    for (const mesh of [ring, spark]) {
      mesh.isPickable = false
      mesh.setEnabled(false)
    }
    return { ring, spark, remaining: 0, scale: 1 }
  })
  let next = 0
  const axis = new Vector3()
  return {
    play(position: Vector3, normal: Vector3, scale: number, kind: CombatImpactKind) {
      const impact = entries[next]
      next = (next + 1) % entries.length
      impact.remaining = LIFETIME
      impact.scale = scale
      axis.copyFrom(normal)
      if (axis.lengthSquared() < .001) axis.set(0, 0, 1)
      axis.normalize()
      // A torus starts in the X/Z plane. Rotate its normal to the hull normal.
      const rotation = Quaternion.Identity()
      const dot = Vector3.Dot(Vector3.UpReadOnly, axis)
      if (dot < -.999) Quaternion.RotationAxisToRef(Vector3.RightReadOnly, Math.PI, rotation)
      else {
        const cross = Vector3.Cross(Vector3.UpReadOnly, axis)
        rotation.set(cross.x, cross.y, cross.z, 1 + dot).normalize()
      }
      impact.ring.rotationQuaternion = rotation
      impact.ring.position.copyFrom(position).addInPlace(axis.scaleInPlace(.18))
      impact.spark.position.copyFrom(impact.ring.position)
      for (const mesh of [impact.ring, impact.spark]) {
        mesh.material = materials[kind]
        mesh.setEnabled(true)
        mesh.visibility = 1
      }
      impact.ring.scaling.setAll(scale * .44)
      impact.spark.scaling.setAll(scale * .5)
    },
    update(dt: number) {
      for (const impact of entries) {
        if (impact.remaining <= 0) continue
        impact.remaining = Math.max(0, impact.remaining - dt)
        const fraction = impact.remaining / LIFETIME
        impact.ring.scaling.setAll(impact.scale * (.44 + (1 - fraction) * 1.75))
        impact.ring.visibility = fraction ** .7
        impact.spark.scaling.setAll(impact.scale * (.12 + fraction * .48))
        impact.spark.visibility = fraction ** 2.4
        if (!impact.remaining) { impact.ring.setEnabled(false); impact.spark.setEnabled(false) }
      }
    },
    dispose() {
      for (const { ring, spark } of entries) { ring.dispose(); spark.dispose() }
      ringTemplate.dispose()
      sparkTemplate.dispose()
      for (const material of Object.values(materials)) material.dispose()
    },
  }
}
