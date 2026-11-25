import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode } from '@babylonjs/core'
import { FACTIONS, type FactionId, type ShipArchetype } from '../domain/exploration'
import { createDroneVisual, createWardenVisual } from './enemyVisual'
import { BOSS_VISUAL_SCALE, ENEMY_VISUAL_SCALE } from '../domain/enemyScale'

function factionMaterials(root: TransformNode, faction: FactionId) {
  const profile = FACTIONS[faction]
  const body = Color3.FromHexString(profile.color)
  const accent = Color3.FromHexString(profile.accent)
  const materials = [...new Set(root.getChildMeshes().map(mesh => mesh.material))]
    .filter((material): material is StandardMaterial => material instanceof StandardMaterial)
  for (const material of materials) {
    const name = material.name.toLowerCase()
    if (name.includes('energy')) {
      material.diffuseColor = accent
      material.emissiveColor = accent.scale(0.9)
    } else if (name.includes('armor')) {
      material.diffuseColor = body.scale(0.65)
      material.emissiveColor = body.scale(0.025)
    }
  }
  return {
    armor: materials.find(material => material.name.includes('armor')) ?? materials[0],
    trim: materials.find(material => material.name.includes('trim')) ?? materials[0],
    glow: materials.find(material => material.name.includes('energy')) ?? materials[0],
  }
}

function mergePieces(root: TransformNode) {
  const meshes = root.getChildMeshes().filter((mesh): mesh is Mesh => mesh instanceof Mesh)
  for (const material of new Set(meshes.map(mesh => mesh.material))) {
    const pieces = meshes.filter(mesh => mesh.material === material)
    if (pieces.length < 2) continue
    const merged = Mesh.MergeMeshes(pieces, true, true)
    if (merged) {
      merged.parent = root
      merged.isPickable = false
      merged.name = `${root.name}-${material?.name ?? 'hull'}`
    }
  }
}

export function createFactionShipVisual(scene: Scene, name: string, faction: FactionId, archetype: ShipArchetype): TransformNode {
  const root = createDroneVisual(scene, name, faction === 'null-cult')
  const materials = factionMaterials(root, faction)
  const plate = (suffix: string, width: number, height: number, depth: number, x: number, y: number, z: number, light = false) => {
    const mesh = MeshBuilder.CreateBox(`${name}-${suffix}`, { width, height, depth }, scene)
    mesh.parent = root
    mesh.position.set(x, y, z)
    mesh.material = light ? materials.glow : materials.armor
    mesh.isPickable = false
    return mesh
  }
  if (archetype === 'interceptor') {
    for (const side of [-1, 1]) {
      const wing = plate(`blade-${side}`, 1.6, 0.1, 1.3, side * 1.2, 0.1, 0.1)
      wing.rotation.y = side * 0.48
      plate(`blade-light-${side}`, 0.65, 0.04, 0.08, side * 1.4, 0.17, -0.45, true)
    }
  } else if (archetype === 'bomber') {
    plate('bomb-bay', 1.5, 0.65, 2, 0, -0.15, 0.15)
    for (const side of [-1, 1]) {
      plate(`ordnance-${side}`, 0.48, 0.4, 1.7, side * 1.3, -0.24, 0.2)
      plate(`ordnance-light-${side}`, 0.34, 0.12, 0.12, side * 1.3, -0.24, -0.7, true)
    }
  } else if (archetype === 'frigate') {
    plate('keel', 1.7, 0.65, 4, 0, 0, 0.35)
    plate('bridge', 1, 0.45, 1.3, 0, 0.52, 0.6)
    for (const side of [-1, 1]) {
      plate(`armor-boom-${side}`, 0.75, 0.5, 3.2, side * 1.35, 0, 0.35)
      plate(`turret-${side}`, 0.3, 0.23, 1.4, side * 1.35, 0.4, -0.3)
      plate(`turret-light-${side}`, 0.23, 0.09, 0.08, side * 1.35, 0.4, -1, true)
      plate(`engine-light-${side}`, 0.4, 0.25, 0.12, side * 1.35, 0, 2, true)
    }
  }
  mergePieces(root)
  root.scaling.setAll((archetype === 'scout' ? 0.85 : archetype === 'frigate' ? 1.35 : 1.1) * ENEMY_VISUAL_SCALE)
  return root
}

export function createWorldBossVisual(scene: Scene, name: string, faction: FactionId, finalEncounter: boolean): TransformNode {
  const root = createWardenVisual(scene, finalEncounter)
  root.name = name
  const colors = FACTIONS[faction]
  for (const mesh of root.getChildMeshes()) {
    const material = mesh.material
    if (!(material instanceof StandardMaterial)) continue
    if (material.name.includes('Energy')) {
      material.emissiveColor = Color3.FromHexString(colors.accent).scale(1.05)
      material.diffuseColor = Color3.FromHexString(colors.accent)
    } else if (material.name.includes('Armor')) material.diffuseColor = Color3.FromHexString(colors.color).scale(0.6)
  }
  root.scaling.setAll((finalEncounter ? 1.9 : 1.6) * BOSS_VISUAL_SCALE)
  return root
}
