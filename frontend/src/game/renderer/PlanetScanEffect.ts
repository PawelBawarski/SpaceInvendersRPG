import {
  Color3,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'

export function createPlanetScanEffect(scene: Scene, position: Vector3, planetRadius: number): void {
  const root = new TransformNode('planetScanEffect', scene)
  root.position.copyFrom(position)

  const material = new StandardMaterial('planetScanMaterial', scene)
  material.diffuseColor = new Color3(0.12, 0.85, 1)
  material.emissiveColor = new Color3(0.12, 0.85, 1)
  material.disableLighting = true
  material.alpha = 0.9

  const rings = [0, 0.28, 0.56].map((delay, index) => {
    const ring = MeshBuilder.CreateTorus(`planetScanRing${index}`, {
      diameter: planetRadius * 2.2,
      thickness: Math.max(0.08, planetRadius * 0.022),
      tessellation: 48,
    }, scene)
    ring.parent = root
    ring.rotation.set(index * 0.56, 0, index * 0.8)
    ring.material = material
    return { mesh: ring, delay }
  })

  const light = new PointLight('planetScanLight', new Vector3(0, planetRadius * 1.4, 0), scene)
  light.parent = root
  light.diffuse = new Color3(0.12, 0.8, 1)
  light.intensity = 3.5
  light.range = planetRadius * 5

  let elapsed = 0
  const observer = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
    elapsed += dt

    for (const { mesh, delay } of rings) {
      const progress = Math.max(0, Math.min(1, (elapsed - delay) / 1.15))
      mesh.scaling.setAll(0.28 + progress * 1.55)
      mesh.rotation.y += dt * (0.32 + delay)
    }

    material.alpha = Math.max(0, 0.9 * (1 - elapsed / 1.85))
    light.intensity = Math.max(0, 3.5 * (1 - elapsed / 1.5))

    if (elapsed >= 1.85) {
      scene.onBeforeRenderObservable.remove(observer)
      root.dispose(false, false)
      material.dispose()
    }
  })
}
