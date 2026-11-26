import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from './babylon'
import type { FactionId } from '../domain/worldFactions'
import { createSceneMaterial } from './sectorDepth'

function mergeArmor(root: TransformNode): void {
  const meshes = root.getChildMeshes().filter((mesh): mesh is Mesh => mesh instanceof Mesh)
  // Detach mesh-on-mesh details before MergeMeshes disposes their source parents.
  for (const mesh of meshes) mesh.setParent(root)
  for (const material of new Set(meshes.map((mesh) => mesh.material))) {
    const pieces = meshes.filter((mesh) => mesh.material === material)
    if (pieces.length < 2) continue
    const combined = Mesh.MergeMeshes(pieces, true, true)
    if (combined) {
      combined.name = `${root.name}-${material?.name ?? 'armor'}`
      combined.parent = root
    }
  }
}

function metal(scene: Scene, name: string, color: string, emission?: string): StandardMaterial {
  const material = createSceneMaterial(name, scene)
  material.diffuseColor = Color3.FromHexString(color)
  material.specularColor = new Color3(0.68, 0.78, 0.85)
  material.specularPower = 72
  if (emission) material.emissiveColor = Color3.FromHexString(emission)
  return material
}

export function createWardenVisual(scene: Scene, finalEncounter: boolean, faction?: FactionId): TransformNode {
  const root = new TransformNode(finalEncounter ? 'nullChoir' : 'meridianWarden', scene)
  const armor = metal(scene, 'wardenArmor', finalEncounter ? '#243848' : '#473b40', '#111a26')
  const edges = metal(scene, 'wardenEdgeMetal', '#627583')
  const dark = metal(scene, 'wardenRecesses', '#080d14')
  const energyColor = finalEncounter ? '#83a5ff' : '#ff6240'
  const energy = metal(scene, 'wardenEnergy', energyColor, energyColor)
  const body = MeshBuilder.CreateCylinder('wardenArmoredChassis', {
    height: 2.9, diameterTop: 2.35, diameterBottom: 3.3, tessellation: 10,
  }, scene)
  body.parent = root
  body.rotation.x = Math.PI / 2
  body.material = armor

  const reactor = MeshBuilder.CreateSphere('wardenReactor', { diameter: 1.65, segments: 20 }, scene)
  reactor.parent = root
  reactor.position.z = -1.48
  reactor.scaling.z = 0.36
  reactor.material = energy
  for (let layer = 0; layer < 3; layer += 1) {
    const collar = MeshBuilder.CreateTorus(`wardenReactorCollar${layer}`, {
      diameter: 1.8 + layer * 0.32, thickness: layer === 1 ? 0.12 : 0.055, tessellation: 48,
    }, scene)
    collar.parent = root
    collar.rotation.x = Math.PI / 2
    collar.position.z = -1.55 + layer * 0.12
    collar.material = layer === 1 ? edges : dark
  }

  const finCount = faction === 'ashen-legion' ? 8 : faction === 'meridian' ? 4 : finalEncounter ? 6 : 4
  for (let index = 0; index < finCount; index += 1) {
    const angle = index / finCount * Math.PI * 2 + Math.PI / 4
    const assembly = new TransformNode(`wardenArm${index}`, scene)
    assembly.parent = root
    assembly.rotation.z = angle
    const strut = MeshBuilder.CreateBox(`wardenArmStrut${index}`, { width: 2.5, height: 0.22, depth: 0.6 }, scene)
    strut.parent = assembly
    strut.position.set(2.1, 0, 0.15)
    strut.material = edges
    const plate = MeshBuilder.CreateCylinder(`wardenArmorBlade${index}`, {
      height: 2.5, diameterTop: 0.18, diameterBottom: 1.15, tessellation: 4,
    }, scene)
    plate.parent = assembly
    plate.position.set(2.75, 0, 0.15)
    plate.rotation.z = Math.PI / 2
    plate.scaling.z = 0.45
    plate.material = armor
    const plating = MeshBuilder.CreateCylinder(`wardenOuterPlating${index}`, {
      height: faction === 'ashen-legion' ? 3.2 : 2.4, diameterTop: .35, diameterBottom: .82, tessellation: 5,
    }, scene)
    plating.parent = assembly
    plating.position.set(3.09, 0, .47)
    plating.rotation.set(Math.PI / 2, faction === 'meridian' ? -.23 : .16, 0)
    plating.scaling.z = .51
    plating.material = edges
    const barrel = MeshBuilder.CreateCylinder(`wardenEmitter${index}`, {
      height: 1.65, diameter: 0.3, tessellation: 10,
    }, scene)
    barrel.parent = assembly
    barrel.position.set(2.6, 0, -0.45)
    barrel.rotation.x = Math.PI / 2
    barrel.material = dark
    const tip = MeshBuilder.CreateTorus(`wardenEmitterTip${index}`, { diameter: 0.3, thickness: 0.055, tessellation: 16 }, scene)
    tip.parent = assembly
    tip.rotation.x = Math.PI / 2
    tip.position.set(2.6, 0, -1.28)
    tip.material = energy
    const strip = MeshBuilder.CreateBox(`wardenBladeLight${index}`, { width: 0.85, height: 0.045, depth: 0.045 }, scene)
    strip.parent = assembly
    strip.position.set(2.25, 0.14, -0.2)
    strip.material = energy
    for (let cell = 0; cell < 3; cell++) {
      const vent = MeshBuilder.CreateBox(`wardenEngineVent${index}-${cell}`, { width: .13, height: .05, depth: .28 }, scene)
      vent.parent = assembly
      vent.position.set(1.79 + cell * .19, -.283, -.51)
      vent.material = energy
    }
  }

  const halo = MeshBuilder.CreateTorus('wardenContainmentHalo', {
    diameter: finalEncounter ? 6.3 : 5.4, thickness: 0.045, tessellation: 64,
  }, scene)
  halo.parent = root
  halo.rotation.x = Math.PI / 2
  halo.position.z = 0.8
  halo.material = energy
  const ringArmor = MeshBuilder.CreateTorus('wardenSegmentedArmorRing', {
    diameter: finalEncounter ? 6.48 : 5.55, thickness: .16, tessellation: faction === 'meridian' ? 12 : 20,
  }, scene)
  ringArmor.parent = root
  ringArmor.rotation.x = Math.PI / 2
  ringArmor.position.z = .94
  ringArmor.material = dark
  mergeArmor(root)
  return root
}

export function createDroneVisual(scene: Scene, name: string, elite = false): TransformNode {
  const root = new TransformNode(name, scene)
  const armor = metal(scene, `${name}-armor`, elite ? '#252a44' : '#36353b')
  const trim = metal(scene, `${name}-trim`, '#71818b')
  const dark = metal(scene, `${name}-recesses`, '#0b121a')
  const glow = metal(scene, `${name}-energy`, elite ? '#ac89ff' : '#ff8f57', elite ? '#8864ef' : '#ed5c28')
  const body = MeshBuilder.CreateCylinder(`${name}-hull`, {
    height: 0.95, diameterTop: 0.6, diameterBottom: 1.2, tessellation: 8,
  }, scene)
  body.parent = root
  body.rotation.x = Math.PI / 2
  body.material = armor
  const eye = MeshBuilder.CreateSphere(`${name}-sensor`, { diameter: 0.39, segments: 12 }, scene)
  eye.parent = root
  eye.position.z = -0.5
  eye.scaling.z = 0.4
  eye.material = glow
  const rim = MeshBuilder.CreateTorus(`${name}-sensorRim`, { diameter: 0.54, thickness: 0.075, tessellation: 24 }, scene)
  rim.parent = root
  rim.rotation.x = Math.PI / 2
  rim.position.z = -0.48
  rim.material = trim
  for (const side of [-1, 1]) {
    const wing = MeshBuilder.CreateBox(`${name}-wing${side}`, { width: 0.8, height: 0.13, depth: 0.72 }, scene)
    wing.parent = root
    wing.rotation.z = side * 0.3
    wing.rotation.y = side * 0.22
    wing.position.set(side * 0.85, -0.04, 0.1)
    wing.material = armor
    const pod = MeshBuilder.CreateCylinder(`${name}-pod${side}`, { height: 0.88, diameter: 0.22, tessellation: 8 }, scene)
    pod.parent = root
    pod.rotation.x = Math.PI / 2
    pod.position.set(side * 1.12, -0.03, 0.12)
    pod.material = dark
    const light = MeshBuilder.CreateBox(`${name}-wingLight${side}`, { width: 0.36, height: 0.035, depth: 0.08 }, scene)
    light.parent = root
    light.position.set(side * 0.78, 0.08, -0.22)
    light.material = glow
    const exhaust = MeshBuilder.CreateSphere(`${name}-exhaust${side}`, { diameter: 0.17, segments: 8 }, scene)
    exhaust.parent = root
    exhaust.position.set(side * 1.12, -0.03, 0.58)
    exhaust.material = glow
  }
  mergeArmor(root)
  return root
}

export function createRelayVisual(scene: Scene): { root: TransformNode; coreMaterial: StandardMaterial } {
  const root = new TransformNode('silentRelay', scene)
  const armor = metal(scene, 'relayArmor', '#273541')
  const trim = metal(scene, 'relayTrim', '#8197a4')
  const dark = metal(scene, 'relayRecesses', '#0b141c')
  const coreMaterial = metal(scene, 'relayCoreMaterial', '#207286', '#034254')
  const core = MeshBuilder.CreatePolyhedron('relayPowerCore', { type: 2, size: 1.35 }, scene)
  core.parent = root
  core.material = coreMaterial
  for (let index = 0; index < 3; index += 1) {
    const cage = MeshBuilder.CreateTorus(`relayContainment${index}`, {
      diameter: 3.45, thickness: 0.1, tessellation: 48,
    }, scene)
    cage.parent = root
    cage.rotation.set(index * Math.PI / 3, Math.PI / 2 + index * 0.55, 0)
    cage.material = index === 1 ? coreMaterial : trim
  }
  for (const side of [-1, 1]) {
    const boom = MeshBuilder.CreateBox(`relayBoom${side}`, { width: 2.0, height: 0.24, depth: 0.48 }, scene)
    boom.parent = root
    boom.position.x = side * 2.0
    boom.material = trim
    const armorPanel = MeshBuilder.CreateBox(`relayPanel${side}`, { width: 0.55, height: 3.5, depth: 0.32 }, scene)
    armorPanel.parent = root
    armorPanel.position.x = side * 2.75
    armorPanel.rotation.z = side * 0.18
    armorPanel.material = armor
    for (let line = 0; line < 6; line += 1) {
      const vent = MeshBuilder.CreateBox(`relayVent${side}-${line}`, { width: 0.4, height: 0.045, depth: 0.04 }, scene)
      vent.parent = armorPanel
      vent.position.set(0, -1.15 + line * 0.43, -0.19)
      vent.material = dark
    }
    const antenna = MeshBuilder.CreateCylinder(`relayAntenna${side}`, { height: 1.3, diameter: 0.07, tessellation: 8 }, scene)
    antenna.parent = root
    antenna.position.set(side * 2.75, 2.15, 0)
    antenna.material = trim
  }
  mergeArmor(root)
  return { root, coreMaterial }
}
