import {
  Color3,
  Constants,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexData,
} from './babylon'
import {
  SHIP_PART_RARITY_COLORS,
  type EquippedPartRarities,
} from '../progress/shipParts'
import { createSceneMaterial } from './sectorDepth'
import { createProfiledHull } from './ProfiledHull'
import { addHullScars, VANTA_SCARS } from './HullDamage'

type Footprint = readonly (readonly [number, number])[]
type Point3 = readonly [number, number, number]

export interface ShipThruster {
  anchor: TransformNode
  core: Mesh
  plume: Mesh
  diameter: number
}

export interface ShipDrive {
  thrusters: ShipThruster[]
  tint: Color3
  light: PointLight
}

export function setShipDrivePower(drive: ShipDrive, power: number, elapsed: number, hyperspace = false) {
  const [idle, exhaust] = power > 0 ? [.16, .2] : [0, 0]
  for (const [index, { core, plume, diameter }] of drive.thrusters.entries()) {
    const pulse = (Math.sin(elapsed * 29 + index * 1.76) + Math.sin(elapsed * 47)) * .035 * power
    const length = .28 + diameter * 3.8 * power + pulse + (hyperspace ? .85 : 0)
    plume.position.z = -length / 2
    plume.scaling.set(1 + power * .15, length, 1 + power * .15)
    plume.visibility = idle + power * .79
    const coreLength = length * (.58 - power * .12)
    core.position.z = -coreLength / 2
    core.scaling.y = coreLength
    core.visibility = exhaust + power * .8
  }
  drive.light.intensity = .28 + power * .97
}

/** The same +Z-facing interceptor is used in flight and on the hangar pad. */
export function createShipVisual(scene: Scene, rarityBySlot: EquippedPartRarities): TransformNode {
  const ship = new TransformNode('playerShip', scene)
  ship.metadata = { equippedPartRarities: Object.fromEntries(Object.entries(rarityBySlot).filter(([, rarity]) => rarity)) }
  addHullScars(ship, VANTA_SCARS)
  const hull = createMetal(scene, 'shipCeramicArmor', '#b7d0df', 0.10)
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
  const exhaustMaterial = createLightMaterial(scene, 'shipEnginePlasma', engineColor, 0.95)
  exhaustMaterial.alpha = 0.33
  exhaustMaterial.alphaMode = Constants.ALPHA_ADD
  exhaustMaterial.disableDepthWrite = true
  exhaustMaterial.backFaceCulling = false
  const hotPlasma = createLightMaterial(scene, 'shipEngineHotCore', '#d6f7ff', 1.2)
  hotPlasma.alpha = 0.8
  hotPlasma.disableDepthWrite = true
  const ownedMaterials = [hull, dark, inset, canopy, cyan, amber, weaponMaterial, weaponGlow, engineMaterial, engineGlow, exhaustMaterial, hotPlasma]
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

  const chassis = createProfiledHull(scene, 'shipLowerChassis', [
    [-1.44, .51, .1, 0, -.105], [-1.26, .67, .152, 0, -.105], [-.32, .82, .20, 0, -.085],
    [.57, .57, .183, 0, -.06], [1.42, .36, .129, 0, -.047], [1.92, .12, .052, 0, -.019], [2.07, .042, .026, 0, .01],
  ], 22)
  chassis.parent = ship
  chassis.material = dark
  chassis.isPickable = false
  const fairing = createProfiledHull(scene, 'shipUpperArmor', [
    [-1.36, .44, .071, 0, .118], [-1.12, .64, .139, 0, .09], [-.23, .73, .193, 0, .093],
    [.76, .49, .168, 0, .11], [1.4, .33, .129, 0, .109], [1.9, .13, .067, 0, .123], [2.04, .042, .031, 0, .108],
  ], 24)
  fairing.parent = ship
  fairing.material = hull
  fairing.isPickable = false
  plate('shipNoseArmor', [[-0.22, 1.02], [0.22, 1.02], [0.045, 1.94], [-0.045, 1.94]], 0.215, 0.25, inset)
  plate('shipDorsalSpine', [[-0.15, -1.26], [0.15, -1.26], [0.2, -0.17], [-0.2, -0.17]], 0.22, 0.36, dark)
  detail('shipDorsalBeacon', [0.055, 0.025, 0.7], [0, 0.375, -0.76], cyan)
  for (const side of [-1, 1]) {
    plate(`shipShoulderArmor${side}`, [
      [side * .28, .37], [side * .68, -.24], [side * .77, -1.03], [side * .34, -1.21],
    ], .12, .235, hull)
    for (let index = 0; index < 3; index++) {
      detail(`shipShoulderVent${side}-${index}`, [.18, .021, .045], [side * .46, .245, -.61 - index * .16], index === 0 ? cyan : dark)
    }
  }

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
    ], 0.115, 0.13, inset).metadata = { breakawayStage: side < 0 ? 3 : 2 }
    const wingReinforcement = plate(`shipWingReinforcement${side}`, [
      [side * .92, .13], [side * 2.12, -.54], [side * 1.96, -.63], [side * .89, -.04],
    ], .113, .158, hull)
    if (side < 0) wingReinforcement.metadata = { breakawayStage: 3 }
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

  }

  const singleDrive = rarityBySlot.engine === 'prototype'
  const thrusters: ShipThruster[] = []
  for (const side of singleDrive ? [0] : [-1, 1]) {
    const x = side * 0.57
    const y = singleDrive ? -0.18 : -0.08
    const width = singleDrive ? 1.68 : 1
    const diameter = 0.52 * width
    const nozzleZ = singleDrive ? -2.31 : -2.04
    const engine = MeshBuilder.CreateCylinder(`shipEngineNacelle${side}`, {
      height: singleDrive ? 1.48 : 1.17, diameterTop: 0.45 * width, diameterBottom: 0.7 * width, tessellation: 16,
    }, scene)
    engine.parent = ship
    engine.rotation.x = Math.PI / 2
    engine.position.set(x, y, nozzleZ + (singleDrive ? 0.71 : 0.55))
    engine.material = dark
    engine.isPickable = false
    detail(`shipEngineCowl${side}`, [0.4 * width, 0.11, 0.95], [x, singleDrive ? .27 : .21, nozzleZ + .76], hull)
    for (let vent = 0; vent < 3; vent += 1) {
      detail(`shipEngineVent${side}-${vent}`, [0.29 * width, 0.025, 0.055], [x, singleDrive ? .333 : .275, nozzleZ + .94 - vent * 0.17], inset)
    }
    const nozzle = MeshBuilder.CreateTorus(`shipEngineNozzle${side}`, {
      diameter: diameter * 1.08, thickness: 0.1 * width, tessellation: 22,
    }, scene)
    nozzle.parent = ship
    nozzle.rotation.x = Math.PI / 2
    nozzle.position.set(x, y, nozzleZ)
    nozzle.material = engineMaterial
    nozzle.isPickable = false
    for (let band = 0; band <= engineTier; band += 1) {
      const coil = MeshBuilder.CreateTorus(`shipEngineRarityCoil${side}-${band}`, {
        diameter: diameter * (band === 0 ? .88 : 1.18), thickness: 0.04 * width, tessellation: 18,
      }, scene)
      coil.parent = ship
      coil.rotation.x = Math.PI / 2
      coil.position.set(x, y, nozzleZ + (band === 0 ? -.04 : .09 + band * .11))
      coil.material = engineGlow
      coil.isPickable = false
    }
    const anchor = new TransformNode(`shipThruster${side}`, scene)
    anchor.parent = ship
    anchor.position.set(x, y, nozzleZ - .035)
    const jet = (name: string, base: number, material: StandardMaterial) => {
      const mesh = MeshBuilder.CreateCylinder(name, { height: 1, diameterTop: base, diameterBottom: .02 * width, tessellation: 14 }, scene)
      mesh.parent = anchor
      mesh.rotation.x = Math.PI / 2
      mesh.position.z = -.17
      mesh.scaling.y = .34
      mesh.material = material
      mesh.visibility = 0
      mesh.isPickable = false
      return mesh
    }
    thrusters.push({ anchor, diameter, core: jet(`shipEngineExhaustCore${side}`, diameter * .43, hotPlasma),
      plume: jet(`shipEngineExhaust${side}`, diameter * .91, exhaustMaterial) })
  }

  const engineLight = new PointLight('engineLight', new Vector3(0, -0.2, -1.7), scene)
  engineLight.parent = ship
  engineLight.diffuse = Color3.FromHexString(engineColor)
  engineLight.intensity = 0.65
  engineLight.range = 5
  const drive: ShipDrive = { thrusters, tint: Color3.FromHexString(engineColor), light: engineLight }
  ship.metadata.drive = drive

  if (rarityBySlot.shield) {
    const shieldMaterial = createLightMaterial(scene, 'shipShieldEquipment', rarityColor(rarityBySlot.shield, '#61d9f0'), 0.5)
    ownedMaterials.push(shieldMaterial)
    for (const side of [-1, 1]) {
      for (let band = 0; band < shieldTier; band += 1) {
        detail(`shipShieldEmitter${side}-${band}`, [0.14, 0.07, 0.09], [side * 0.87, 0.16, -0.39 - band * 0.15], shieldMaterial)
      }
    }
    const shieldHalo = MeshBuilder.CreateTorus('shipShieldModule', { diameter: 3.8, thickness: 0.028, tessellation: 48 }, scene)
    shieldHalo.parent = ship
    shieldHalo.position.set(0, -0.2, -0.15)
    const haloMaterial = shieldMaterial.clone('shipShieldHaloMaterial')
    ownedMaterials.push(haloMaterial)
    haloMaterial.useLogarithmicDepth = shieldMaterial.useLogarithmicDepth
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

  const mounted = (mesh: Mesh, material: StandardMaterial, position: Point3) => {
    mesh.parent = ship
    mesh.material = material
    mesh.position.set(...position)
    mesh.isPickable = false
    return mesh
  }
  if (rarityBySlot.armor) {
    const laminate = createMetal(scene, 'shipArmorEquipment', rarityColor(rarityBySlot.armor, '#adc5d1'), .09)
    ownedMaterials.push(laminate)
    for (const side of [-1, 1]) {
      const cheek = createProfiledHull(scene, 'shipArmorLaminate' + side, [
        [-1.08, .07, .045, side * .72, .16], [-.79, .22, .105, side * .92, .18],
        [-.27, .23, .128, side * .77, .178], [.32, .18, .10, side * .53, .207],
        [.78, .045, .038, side * .35, .21],
      ], 14)
      mounted(cheek, laminate, [0, 0, 0])
    }
  }
  if (rarityBySlot.reactor) {
    const field = createLightMaterial(scene, 'shipReactorEquipment', rarityColor(rarityBySlot.reactor, '#76eebb'), .8)
    ownedMaterials.push(field)
    mounted(MeshBuilder.CreateSphere('shipReactorCasing', { diameter: .57, segments: 14 }, scene), inset, [0, .31, -1.1]).scaling.set(1.15, .56, 1.38)
    for (let band = 0; band < equipmentTier(rarityBySlot.reactor) + 1; band++) {
      mounted(MeshBuilder.CreateTorus('shipReactorCoil' + band, { diameter: .52, thickness: .036, tessellation: 16 }, scene),
        field, [0, .34, -1.32 + band * .14]).rotation.x = Math.PI / 2
    }
  }
  if (rarityBySlot.scanner) {
    const signal = createLightMaterial(scene, 'shipScannerEquipment', rarityColor(rarityBySlot.scanner, '#74cbff'), .72)
    ownedMaterials.push(signal)
    mounted(MeshBuilder.CreateCylinder('shipScannerBase', { height: .12, diameter: .32, tessellation: 16 }, scene), dark, [0, .37, -.43])
    mounted(MeshBuilder.CreateSphere('shipScannerDish', { diameter: .49, segments: 16 }, scene), inset, [0, .47, -.43]).scaling.y = .35
    mounted(MeshBuilder.CreateTorus('shipScannerAperture', { diameter: .43, thickness: .025, tessellation: 20 }, scene), signal, [0, .51, -.43])
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
  const center = outline.reduce(([sumX, sumZ], [x, z]) => [sumX + x / outline.length, sumZ + z / outline.length], [0, 0])
  const inset = Math.min(.06, (top - bottom) * .55)
  const points: Point3[] = [
    ...outline.map(([x, z]): Point3 => [x, bottom, z]),
    ...outline.map(([x, z]): Point3 => [x, top - inset, z]),
    ...outline.map(([x, z]): Point3 => [x + (center[0] - x) * .075, top, z + (center[1] - z) * .075]),
  ]
  const count = outline.length
  const faces = [outline.map((_, i) => i), outline.map((_, i) => count * 3 - i - 1)]
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count
    faces.push([i, i + count, next + count, next])
    faces.push([i + count, i + 2 * count, next + 2 * count, next + count])
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
  const material = createSceneMaterial(name, scene)
  material.diffuseColor = Color3.FromHexString(color)
  material.emissiveColor = material.diffuseColor.scale(emissive)
  material.specularColor = new Color3(0.65, 0.77, 0.84)
  material.specularPower = 96
  material.maxSimultaneousLights = 5
  return material
}

function createLightMaterial(scene: Scene, name: string, color: string, strength: number): StandardMaterial {
  const material = createSceneMaterial(name, scene)
  material.disableLighting = true
  material.diffuseColor = Color3.FromHexString(color).scale(0.3)
  material.emissiveColor = Color3.FromHexString(color).scale(strength)
  return material
}
