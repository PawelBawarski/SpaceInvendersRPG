import { MeshBuilder, Scene, StandardMaterial } from '../babylon'

/** Static hangar shell: walls, doorway, ceiling and light strips. */
export function createHangarStructure(
  scene: Scene,
  wallMaterial: StandardMaterial,
  trimMaterial: StandardMaterial,
  warmLight: StandardMaterial,
  coolLight: StandardMaterial,
): void {
  for (const side of [-1, 1]) {
    const rearWall = MeshBuilder.CreateBox(`hangarRearWall${side}`, { width: 4.5, height: 12, depth: 1 }, scene)
    rearWall.position.set(side * 10.25, 4.7, 17)
    rearWall.material = wallMaterial
  }

  const rearLintel = MeshBuilder.CreateBox('hangarRearLintel', { width: 16, height: 2.5, depth: 1 }, scene)
  rearLintel.position.set(0, 9.45, 17)
  rearLintel.material = wallMaterial

  for (const side of [-1, 1]) {
    const sideWall = MeshBuilder.CreateBox(`hangarSideWall${side}`, { width: 1, height: 9, depth: 28 }, scene)
    sideWall.position.set(side * 12, 3.2, 4)
    sideWall.material = wallMaterial

    const doorwayPillar = MeshBuilder.CreateBox(`hangarDoorPillar${side}`, {
      width: 0.8,
      height: 7.5,
      depth: 1.1,
    }, scene)
    doorwayPillar.position.set(side * 10, 2.45, 10)
    doorwayPillar.material = trimMaterial

    const sideStrip = MeshBuilder.CreateBox(`hangarSideLight${side}`, {
      width: 0.08,
      height: 0.08,
      depth: 16,
    }, scene)
    sideStrip.position.set(side * 10.1, 4.8, 1)
    sideStrip.material = side === -1 ? coolLight : warmLight
    const housing = MeshBuilder.CreateBox(`hangarLampHousing${side}`, { width: .34, height: .22, depth: 16.2 }, scene)
    housing.position.set(side * 10.25, 4.87, 1)
    housing.material = trimMaterial
  }

  const upperBeam = MeshBuilder.CreateBox('hangarDoorBeam', { width: 21, height: 0.9, depth: 1.1 }, scene)
  upperBeam.position.set(0, 6.2, 10)
  upperBeam.material = trimMaterial

  const ceiling = MeshBuilder.CreateBox('hangarCeiling', { width: 25, height: 0.7, depth: 30 }, scene)
  ceiling.position.set(0, 8, 4)
  ceiling.material = wallMaterial

  for (let index = 0; index < 4; index += 1) {
    const ceilingRib = MeshBuilder.CreateBox(`hangarCeilingRib${index}`, {
      width: 24,
      height: 0.3,
      depth: 0.4,
    }, scene)
    ceilingRib.position.set(0, 7.55, index * 6 - 4)
    ceilingRib.material = trimMaterial
    const fixture = MeshBuilder.CreateBox(`hangarCeilingLamp${index}`, { width: 2.4, height: .055, depth: .25 }, scene)
    fixture.position.set(-3, 7.4, index * 6 - 4)
    fixture.material = coolLight
  }
}

/** Painted landing guides and centre line on the hangar floor. */
export function createLandingMarkings(
  scene: Scene,
  trimMaterial: StandardMaterial,
  coolLight: StandardMaterial,
): void {
  for (const side of [-1, 1]) {
    const guide = MeshBuilder.CreateBox(`landingGuide${side}`, {
      width: 0.12,
      height: 0.025,
      depth: 11,
    }, scene)
    guide.position.set(side * 4.7, -0.95, 1.5)
    guide.material = coolLight
  }

  const centerLine = MeshBuilder.CreateBox('landingCenterLine', {
    width: 0.08,
    height: 0.025,
    depth: 7,
  }, scene)
  centerLine.position.set(0, -0.95, -2.6)
  centerLine.material = trimMaterial
}

/** Floor seams, caution markings, wall panels, workbench and supply cases. */
export function createWorkshopDetails(
  scene: Scene,
  dark: StandardMaterial,
  metal: StandardMaterial,
  amber: StandardMaterial,
  cyan: StandardMaterial,
): void {
  const box = (name: string, size: [number, number, number], position: [number, number, number], material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene)
    mesh.position.set(...position)
    mesh.material = material
    mesh.receiveShadows = true
    return mesh
  }
  for (let index = 0; index < 7; index += 1) {
    box(`hangarFloorSeam-${index}`, [24, 0.012, 0.025], [0, -1.092, -8 + index * 4], metal)
  }
  for (const side of [-1, 1]) {
    box(`hangarFloorEdge-${side}`, [0.035, 0.015, 31], [side * 8, -1.085, 4], metal)
    for (let index = 0; index < 5; index += 1) {
      const marker = box(`hangarPadCaution-${side}-${index}`, [0.24, 0.02, 0.5], [side * 5, -0.948, -3.5 + index * 2.5], amber)
      marker.rotation.y = -0.45
    }
    for (let index = 0; index < 3; index += 1) {
      const z = index * 5.5 - 1
      box(`hangarWallPanel-${side}-${index}`, [0.12, 3.2, 4.6], [side * 11.4, 1.1, z], dark)
      box(`hangarWallPanelRim-${side}-${index}`, [0.16, 0.06, 4.4], [side * 11.28, 2.6, z], metal)
    }
  }
  const padRing = MeshBuilder.CreateTorus('hangarPadOuterRing', { diameter: 11.4, thickness: 0.035, tessellation: 80 }, scene)
  padRing.position.set(0, -0.944, 1.5)
  padRing.material = cyan
  const padInnerRing = MeshBuilder.CreateTorus('hangarPadInnerRing', { diameter: 10.8, thickness: 0.025, tessellation: 80 }, scene)
  padInnerRing.position.set(0, -0.944, 1.5)
  padInnerRing.material = metal

  box('hangarWorkbench', [3.4, 0.18, 1.2], [-8, 0.1, 5], metal)
  for (const x of [-9.35, -6.65]) box(`hangarWorkbenchLeg-${x}`, [0.17, 1.15, 1], [x, -0.55, 5], dark)
  box('hangarWorkbenchConsole', [0.9, 0.5, 0.08], [-7.4, 0.5, 5.3], dark)
  box('hangarWorkbenchDisplay', [0.75, 0.29, 0.015], [-7.4, 0.53, 5.25], cyan)
  for (let index = 0; index < 3; index += 1) {
    const x = -8.8 + index * 0.62
    box(`hangarSupplyCase-${index}`, [0.5, 0.45, 0.65], [x, -0.84, 7.7], dark)
    box(`hangarSupplyLatch-${index}`, [0.12, 0.12, 0.02], [x, -0.75, 7.365], amber)
  }
}