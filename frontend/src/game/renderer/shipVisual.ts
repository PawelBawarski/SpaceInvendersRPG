import {
  Color3,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexData,
} from '@babylonjs/core'
import {
  SHIP_PART_RARITY_COLORS,
  type EquippedPartRarities,
} from '../progress/shipParts'

type Footprint = readonly (readonly [number, number])[]
type Point3 = readonly [number, number, number]

/** The same +Z-facing interceptor is used in flight and on the hangar pad. */
export function createShipVisual(scene: Scene, rarityBySlot: EquippedPartRarities): TransformNode {
  const ship = new TransformNode('playerShip', scene)
  ship.metadata = { equippedPartRarities: { ...rarityBySlot } }
  const hull = createMetal(scene, 'shipCeramicArmor', '#adc3d1', 0.045)
  const dark = createMetal(scene, 'shipGraphiteFrame', '#182936', 0.06)
  const inset = createMetal(scene, 'shipInsetArmor', '#456477', 0.045)
  const canopy = createMetal(scene, 'shipCanopyGlass', '#093747', 0.16)
  canopy.specularColor = new Color3(0.65, 0.9, 1)
  canopy.specularPower = 160
  const cyan = createLightMaterial(scene, 'shipRunningLights', '#54ddff', 0.9)
  const amber = createLightMaterial(scene, 'shipPortNavigationLight', '#ffab62', 0.85)
  const weaponColor = rarityColor(rarityBySlot.weapon, '#83b7c8')
  const engineColor = rarityColor(rarityBySlot.engine, '#53ddff')
  const weaponMaterial = createMetal(scene, 'shipWeaponEquipment', weaponColor, 0.24)
  const weaponGlow = createLightMaterial(scene, 'shipWeaponModuleLights', weaponColor, 0.85)
  const engineMaterial = createMetal(scene, 'shipEngineEquipment', engineColor, 0.15)
  const engineGlow = createLightMaterial(scene, 'shipEngineModuleLights', engineColor, 0.85)
  const weaponTier = equipmentTier(rarityBySlot.weapon)
  const engineTier = equipmentTier(rarityBySlot.engine)
  const shieldTier = equipmentTier(rarityBySlot.shield)
  const exhaustMaterial = createLightMaterial(scene, 'shipEnginePlasma', engineColor, 1.2)
  exhaustMaterial.alpha = 0.7
  exhaustMaterial.backFaceCulling = false
  const ownedMaterials = [hull, dark, inset, canopy, cyan, amber, weaponMaterial, weaponGlow, engineMaterial, engineGlow, exhaustMaterial]
  ship.onDisposeObservable.addOnce(() => {
    // Uninstalled modules also allocate palette materials; release those on swaps.
    for (const material of ownedMaterials) if (scene.materials.includes(material)) material.dispose()
  })

  const plate = (name: string, outline: Footprint, bottom: number, top: number, material: StandardMaterial) => {
    const mesh = createArmorPlate(scene, name, outline, bottom, top)
    mesh.parent = ship
    mesh.material = material
    mesh.isPickable = false
    return mesh
  }
  const detail = (name: string, size: Point3, position: Point3, material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene)
    mesh.parent = ship
    mesh.position.set(...position)
    mesh.material = material
    mesh.isPickable = false
    return mesh
  }

  plate('shipLowerChassis', [
    [-0.63, -1.42], [0.63, -1.42], [0.84, -0.25], [0.38, 1.45],
    [0.08, 2.05], [-0.08, 2.05], [-0.38, 1.45], [-0.84, -0.25],
  ], -0.24, 0.02, dark)
  plate('shipUpperArmor', [
    [-0.55, -1.32], [0.55, -1.32], [0.71, -0.18], [0.32, 1.38],
    [0.06, 2], [-0.06, 2], [-0.32, 1.38], [-0.71, -0.18],
  ], 0.015, 0.21, hull)
  plate('shipNoseArmor', [[-0.22, 1.02], [0.22, 1.02], [0.045, 1.94], [-0.045, 1.94]], 0.215, 0.25, inset)
  plate('shipDorsalSpine', [[-0.15, -1.26], [0.15, -1.26], [0.2, -0.17], [-0.2, -0.17]], 0.22, 0.36, dark)
  detail('shipDorsalBeacon', [0.055, 0.025, 0.7], [0, 0.375, -0.76], cyan)

  const glass = createFacetedMesh(scene, 'shipFacetedCanopy', [
    [-0.31, 0.21, -0.05], [0.31, 0.21, -0.05], [0.22, 0.21, 1.15], [-0.22, 0.21, 1.15],
    [-0.24, 0.57, 0.07], [0.24, 0.57, 0.07], [0.12, 0.46, 0.91], [-0.12, 0.46, 0.91],
  ], [[0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0], [4, 7, 6, 5]])
  glass.parent = ship
  glass.material = canopy
  glass.isPickable = false
  for (const side of [-1, 1]) {
    const frame = MeshBuilder.CreateTube(`shipCanopyFrame${side}`, {
      path: [new Vector3(side * 0.31, 0.23, -0.05), new Vector3(side * 0.24, 0.59, 0.07), new Vector3(side * 0.12, 0.48, 0.91), new Vector3(side * 0.22, 0.23, 1.15)],
      radius: 0.025,
      tessellation: 5,
    }, scene)
    frame.parent = ship
    frame.material = dark
    frame.isPickable = false

    plate(`shipSweptWing${side}`, [
      [side * 0.52, 0.58], [side * 2.32, -0.54], [side * 2.08, -1.16], [side * 0.55, -1.02],
    ], -0.14, 0, dark)
    plate(`shipWingArmor${side}`, [
      [side * 0.72, 0.27], [side * 2.17, -0.56], [side * 1.94, -0.94], [side * 0.7, -0.84],
    ], 0.005, 0.11, hull)
    plate(`shipWingInset${side}`, [
      [side * 1.05, -0.14], [side * 1.89, -0.61], [side * 1.73, -0.74], [side * 0.94, -0.51],
    ], 0.115, 0.13, inset)
    const wingMark = detail(`shipWingIdentification${side}`, [0.09, 0.018, 0.34], [side * 1.7, 0.145, -0.59], amber)
    wingMark.rotation.y = side * -0.45
    detail(`shipWingNavigation${side}`, [0.09, 0.08, 0.2], [side * 2.18, 0.02, -0.64], side < 0 ? amber : cyan)

    plate(`shipWeaponHousing${side}`, [
      [side * 1.16, -0.46], [side * 1.5, -0.46], [side * 1.52, 0.74], [side * 1.33, 1.02], [side * 1.14, 0.74],
    ], -0.12, 0.16, dark)
    detail(`shipWeaponArmor${side}`, [0.24, 0.06, 0.65], [side * 1.33, 0.2, 0.04], rarityBySlot.weapon ? weaponMaterial : hull)
    const barrel = MeshBuilder.CreateCylinder(`shipWeaponBarrel${side}`, {
      height: 0.46 + weaponTier * 0.14,
      diameter: rarityBySlot.weapon ? 0.14 : 0.1,
      tessellation: 10,
    }, scene)
    barrel.parent = ship
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(side * 1.33, 0, 1.02)
    barrel.material = inset
    barrel.isPickable = false
    detail(`shipWeaponChargeLight${side}`, [0.055, 0.025, 0.36], [side * 1.33, 0.24, 0.08], rarityBySlot.weapon ? weaponMaterial : cyan)
    for (let band = 0; band < weaponTier; band += 1) {
      detail(`shipWeaponRarityBand${side}-${band}`, [0.26, 0.025, 0.045], [side * 1.33, 0.24, -0.18 + band * 0.15], weaponGlow)
    }
    if (weaponTier === 3) {
      detail(`shipWeaponPrototypeRail${side}`, [0.045, 0.045, 0.56], [side * 1.48, 0.12, 0.7], weaponGlow)
    }

    const engine = MeshBuilder.CreateCylinder(`shipEngineNacelle${side}`, {
      height: 1.14, diameterTop: 0.5, diameterBottom: 0.67, tessellation: 12,
    }, scene)
    engine.parent = ship
    engine.rotation.x = Math.PI / 2
    engine.position.set(side * 0.57, -0.08, -1.4)
    engine.material = dark
    engine.isPickable = false
    detail(`shipEngineCowl${side}`, [0.37, 0.11, 0.79], [side * 0.57, 0.21, -1.25], hull)
    for (let vent = 0; vent < 3; vent += 1) {
      detail(`shipEngineVent${side}-${vent}`, [0.27, 0.018, 0.045], [side * 0.57, 0.275, -1.14 - vent * 0.14], inset)
    }
    const nozzle = MeshBuilder.CreateTorus(`shipEngineNozzle${side}`, {
      diameter: 0.53, thickness: 0.09, tessellation: 16,
    }, scene)
    nozzle.parent = ship
    nozzle.rotation.x = Math.PI / 2
    nozzle.position.set(side * 0.57, -0.08, -1.98)
    nozzle.material = engineMaterial
    nozzle.isPickable = false
    for (let band = 0; band < engineTier; band += 1) {
      const coil = MeshBuilder.CreateTorus(`shipEngineRarityCoil${side}-${band}`, {
        diameter: 0.56, thickness: 0.035, tessellation: 16,
      }, scene)
      coil.parent = ship
      coil.rotation.x = Math.PI / 2
      coil.position.set(side * 0.57, -0.08, -1.5 - band * 0.13)
      coil.material = engineGlow
      coil.isPickable = false
    }
    const plasma = MeshBuilder.CreateCylinder(`shipEngineExhaust${side}`, {
      height: 0.42 + engineTier * 0.16,
      diameterTop: 0.4,
      diameterBottom: 0.06,
      tessellation: 12,
    }, scene)
    plasma.parent = ship
    plasma.rotation.x = Math.PI / 2
    plasma.position.set(side * 0.57, -0.08, -2.18 - engineTier * 0.08)
    plasma.material = exhaustMaterial
    plasma.isPickable = false
  }

  const engineLight = new PointLight('engineLight', new Vector3(0, -0.2, -1.7), scene)
  engineLight.parent = ship
  engineLight.diffuse = Color3.FromHexString(engineColor)
  engineLight.intensity = 0.65
  engineLight.range = 5

  if (rarityBySlot.shield) {
    const shieldMaterial = createLightMaterial(scene, 'shipShieldEquipment', rarityColor(rarityBySlot.shield, '#61d9f0'), 0.5)
    for (const side of [-1, 1]) {
      for (let band = 0; band < shieldTier; band += 1) {
        detail(`shipShieldEmitter${side}-${band}`, [0.14, 0.07, 0.09], [side * 0.87, 0.16, -0.39 - band * 0.15], shieldMaterial)
      }
    }
    const shieldHalo = MeshBuilder.CreateTorus('shipShieldModule', { diameter: 3.8, thickness: 0.028, tessellation: 48 }, scene)
    shieldHalo.parent = ship
    shieldHalo.position.set(0, -0.2, -0.15)
    const haloMaterial = shieldMaterial.clone('shipShieldHaloMaterial')
    haloMaterial.alpha = 0.2
    shieldHalo.material = haloMaterial
    shieldHalo.isPickable = false
    if (shieldTier === 3) {
      const outerHalo = MeshBuilder.CreateTorus('shipShieldPrototypeField', { diameter: 4.05, thickness: 0.018, tessellation: 48 }, scene)
      outerHalo.parent = ship
      outerHalo.position.set(0, -0.17, -0.15)
      outerHalo.material = haloMaterial
      outerHalo.isPickable = false
    }
  }

  return ship
}

function equipmentTier(rarity: EquippedPartRarities['weapon']): number {
  return rarity === 'prototype' ? 3 : rarity === 'refined' ? 2 : rarity === 'standard' ? 1 : 0
}

function createArmorPlate(scene: Scene, name: string, footprint: Footprint, bottom: number, top: number): Mesh {
  const outline = [...footprint]
  const area = outline.reduce((sum, [x, z], index) => {
    const next = outline[(index + 1) % outline.length]
    return sum + x * next[1] - next[0] * z
  }, 0)
  if (area < 0) outline.reverse()
  const points: Point3[] = [
    ...outline.map(([x, z]): Point3 => [x, bottom, z]),
    ...outline.map(([x, z]): Point3 => [x, top, z]),
  ]
  const count = outline.length
  const faces = [outline.map((_, i) => i), outline.map((_, i) => count * 2 - i - 1)]
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count
    faces.push([i, i + count, next + count, next])
  }
  return createFacetedMesh(scene, name, points, faces)
}

function createFacetedMesh(scene: Scene, name: string, points: readonly Point3[], faces: readonly number[][]): Mesh {
  const positions: number[] = []
  const indices: number[] = []
  for (const face of faces) {
    const start = positions.length / 3
    for (const index of face) positions.push(...points[index])
    for (let index = 1; index < face.length - 1; index += 1) indices.push(start, start + index, start + index + 1)
  }
  const normals: number[] = []
  VertexData.ComputeNormals(positions, indices, normals)
  const data = new VertexData()
  data.positions = positions
  data.indices = indices
  data.normals = normals
  const mesh = new Mesh(name, scene)
  data.applyToMesh(mesh)
  return mesh
}

function rarityColor(rarity: EquippedPartRarities['weapon'], fallback: string): string {
  return rarity ? SHIP_PART_RARITY_COLORS[rarity] : fallback
}

function createMetal(scene: Scene, name: string, color: string, emissive: number): StandardMaterial {
  const material = new StandardMaterial(name, scene)
  material.diffuseColor = Color3.FromHexString(color)
  material.emissiveColor = material.diffuseColor.scale(emissive)
  material.specularColor = new Color3(0.65, 0.77, 0.84)
  material.specularPower = 96
  material.maxSimultaneousLights = 5
  return material
}

function createLightMaterial(scene: Scene, name: string, color: string, strength: number): StandardMaterial {
  const material = new StandardMaterial(name, scene)
  material.disableLighting = true
  material.diffuseColor = Color3.FromHexString(color).scale(0.3)
  material.emissiveColor = Color3.FromHexString(color).scale(strength)
  return material
}
