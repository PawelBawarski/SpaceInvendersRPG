import { StandardMaterial, type Scene } from '@babylonjs/core'

const logarithmicScenes = new WeakSet<Scene>()

/** A linear depth buffer loses precision when meter-scale ships share a scene with distant stars. */
export function enableSectorDepth(scene: Scene) {
  if (scene.getEngine().getCaps().fragmentDepthSupported) logarithmicScenes.add(scene)
}

export function usesSectorDepth(scene: Scene) {
  return logarithmicScenes.has(scene)
}

export function createSceneMaterial(name: string, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene)
  if (usesSectorDepth(scene)) material.useLogarithmicDepth = true
  return material
}
