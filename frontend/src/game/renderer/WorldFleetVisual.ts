import { Color3, Mesh, MeshBuilder, type Scene, type StandardMaterial, TransformNode, Vector3 } from './babylon'
import { FACTIONS, type FactionId, type ShipArchetype } from '../domain/exploration'
import { BOSS_VISUAL_SCALE, ENEMY_VISUAL_SCALE } from '../domain/enemyScale'
import { createSceneMaterial } from './sectorDepth'
import { createProfiledHull, type HullSection } from './ProfiledHull'
import { addHullScars } from './HullDamage'

type Surface = 'shell' | 'alloy' | 'glass' | 'pulse'

const HULLS: Record<ShipArchetype, readonly HullSection[]> = {
  scout: [[-1.7, .03, .04], [-1.29, .27, .17], [-.48, .57, .26], [.52, .63, .28], [1.16, .42, .22], [1.38, .26, .15]],
  interceptor: [[-2.3, .025, .03], [-1.75, .21, .12], [-.7, .55, .26], [.35, .62, .29], [1.21, .48, .27], [1.57, .33, .2]],
  bomber: [[-1.7, .08, .08], [-1.35, .54, .32], [-.63, .89, .41], [.58, .92, .46], [1.32, .72, .35], [1.78, .42, .23]],
  frigate: [[-2.65, .06, .055], [-2.12, .43, .24], [-1.31, .69, .29], [-.05, .85, .41], [1.39, .85, .38], [2.17, .59, .29], [2.42, .48, .22]],
}

const BOSS_HULLS: Record<FactionId, readonly HullSection[]> = {
  meridian: [[-3.25, .04, .06], [-2.56, .43, .24], [-1.21, .91, .44], [.21, 1.21, .57], [1.54, 1.03, .53], [2.32, .73, .37], [2.63, .46, .26]],
  nacre: [[-2.84, .08, .12], [-2.15, .64, .28], [-1.37, 1.04, .44], [.22, 1.22, .57], [1.53, 1.08, .55], [2.21, .69, .34], [2.65, .46, .25]],
  'null-cult': [[-2.6, .05, .06], [-1.98, .45, .34], [-1.03, .66, .63], [.12, .79, .76], [1.22, .72, .62], [2.1, .51, .38], [2.61, .32, .23]],
  'ashen-legion': [[-2.95, .11, .12], [-2.48, .68, .34], [-1.79, 1.23, .43], [-.27, 1.54, .51], [1.39, 1.51, .45], [2.36, 1.1, .35], [2.74, .68, .22]],
}

function buildFleetModel(scene: Scene, name: string, faction: FactionId, archetype: ShipArchetype, boss: boolean) {
  const root = new TransformNode(name, scene)
  const palette = FACTIONS[faction]
  const colors = {
    shell: Color3.Lerp(Color3.FromHexString(palette.color), new Color3(.75, .81, .88), .17),
    alloy: Color3.FromHexString('#283945'),
    glass: Color3.Lerp(Color3.FromHexString('#0a2334'), Color3.FromHexString(palette.accent), .15),
    pulse: Color3.FromHexString(palette.accent),
  }
  const materials = new Map<Surface, StandardMaterial>()
  for (const surface of Object.keys(colors) as Surface[]) {
    const material = createSceneMaterial(name + '-' + surface, scene)
    const color = colors[surface]
    material.diffuseColor = color
    material.specularColor = new Color3(.55, .64, .73)
    material.specularPower = surface === 'glass' ? 132 : surface === 'shell' ? 51 : 78
    material.emissiveColor = color.scale(surface === 'pulse' ? .95 : surface === 'glass' ? .13 : .17)
    material.disableLighting = surface === 'pulse'
    material.maxSimultaneousLights = 4
    materials.set(surface, material)
  }
  const mount = (mesh: Mesh, surface: Surface) => {
    mesh.parent = root
    mesh.material = materials.get(surface)!
    mesh.isPickable = false
    return mesh
  }
  const shell = (part: string, sections: readonly HullSection[], surface: Surface = 'shell', sides = 16) =>
    mount(createProfiledHull(scene, name + '-' + part, sections, sides), surface)
  const coil = (part: string, x: number, y: number, z: number, diameter: number, thickness: number, surface: Surface = 'pulse') => {
    const mesh = mount(MeshBuilder.CreateTorus(name + '-' + part, { diameter, thickness, tessellation: boss ? 24 : 14 }, scene), surface)
    mesh.position.set(x, y, z)
    mesh.rotation.x = Math.PI / 2
    return mesh
  }
  const guide = (part: string, coordinates: readonly (readonly [number, number, number])[], radius: number, surface: Surface = 'pulse') =>
    mount(MeshBuilder.CreateTube(name + '-' + part, { path: coordinates.map(([x, y, z]) => new Vector3(x, y, z)), radius, tessellation: 5 }, scene), surface)

  shell('pressure-shell', boss ? BOSS_HULLS[faction] : HULLS[archetype], 'shell', boss ? 24 : 20)
  const longWing = boss || archetype === 'interceptor' || archetype === 'frigate'
  const wing = boss ? faction === 'ashen-legion' ? 3.6 : 3 : archetype === 'interceptor' ? 2.1 : archetype === 'frigate' ? 1.95 : 1.55
  const mid = boss ? .94 : archetype === 'scout' ? .4 : .66
  const tail = boss ? 2.7 : archetype === 'frigate' ? 2.05 : 1.48

  for (const side of [-1, 1]) {
    const offset = (x: number) => x * side
    const wingStart = boss ? -2.02 : longWing ? -1.28 : -.76
    shell('wing-' + side, [
      [wingStart, .06, .037, offset(mid), .01],
      [wingStart + .48, wing * .22, boss ? .18 : .105, offset(wing * .43), .01],
      [.2, wing * .34, boss ? .22 : .12, offset(wing * .58), .035],
      [tail * .67, wing * .25, boss ? .19 : .1, offset(wing * .72), -.03],
      [tail * .83, .07, .034, offset(wing * .93), -.09],
    ], 'alloy', 12)
    shell('wing-inlay-' + side, [
      [wingStart + .5, .035, .025, offset(mid * 1.35), .11],
      [.01, wing * .24, boss ? .11 : .062, offset(wing * .62), boss ? .18 : .12],
      [tail * .53, wing * .18, boss ? .08 : .051, offset(wing * .73), .09],
      [tail * .74, .03, .022, offset(wing * .91), .02],
    ], 'shell', 12)
    const engineX = offset(boss ? wing * .61 : longWing ? wing * .68 : wing * .56)
    const engineY = boss ? -.15 : -.1
    const engineRadius = boss ? .42 : archetype === 'bomber' || archetype === 'frigate' ? .27 : .2
    shell('nacelle-' + side, [
      [tail - (boss || longWing ? 2.18 : 1.12), engineRadius * .28, engineRadius * .31, engineX * .89, engineY],
      [tail - .64, engineRadius * 1.16, engineRadius * .95, engineX, engineY],
      [tail - .15, engineRadius * 1.12, engineRadius, engineX, engineY],
      [tail, engineRadius * .83, engineRadius * .81, engineX, engineY],
    ], 'alloy', 14)
    coil('nozzle-' + side, engineX, engineY, tail + .01, engineRadius * 1.5, engineRadius * .37, 'shell')
    coil('nozzle-ion-' + side, engineX, engineY, tail + .025, engineRadius * 1.17, engineRadius * .2)
    const platingY = boss ? .21 : .13
    shell('wing-leading-plate-' + side, [
      [wingStart + .47, .04, .028, offset(wing * .42), platingY * .7],
      [-.13, wing * .095, .041, offset(wing * .54), platingY],
      [tail * .38, wing * .10, .051, offset(wing * .71), platingY * .84],
      [tail * .61, .021, .016, offset(wing * .89), platingY * .43],
    ], 'shell', 12)
    for (let vent = 0; vent < (boss ? 4 : 2); vent++) {
      const z = tail * (.12 + vent * .09)
      const x = offset(wing * .57)
      guide('intake-vane-' + side + '-' + vent, [[x * .85, platingY * 1.16, z], [x * 1.13, platingY * 1.04, z - .09]], boss ? .028 : .018, 'alloy')
    }
    guide('position-light-' + side, [[offset(wing * .54), boss ? .3 : .195, .04], [offset(wing * .73), boss ? .224 : .148, tail * .49], [offset(wing * .84), .08, tail * .66]], boss ? .031 : .023)
    if (boss || archetype !== 'scout') {
      const bank = offset(mid * (boss ? 1.5 : 1.13))
      const bankY = archetype === 'bomber' && !boss ? -.29 : boss ? .44 : .25
      shell('weapon-bank-' + side, [
        [wingStart - .39, .073, .06, bank, bankY],
        [wingStart - .2, boss ? .21 : .13, boss ? .15 : .095, bank, bankY],
        [wingStart + .65, boss ? .28 : .16, boss ? .23 : .13, bank, bankY],
        [.05, .07, .055, bank * .97, bankY],
      ], 'alloy', 12)
      coil('weapon-emitter-' + side, bank, bankY, wingStart - .39, boss ? .145 : .099, .032)
    }
  }
  const canopyY = boss ? .48 : archetype === 'frigate' ? .34 : .23
  shell('bridge-glass', [
    [-1.18, .035, .036, 0, canopyY * .58], [-.83, boss ? .39 : .2, .13, 0, canopyY],
    [-.31, boss ? .55 : .28, boss ? .32 : .17, 0, canopyY], [.28, boss ? .54 : .24, boss ? .32 : .14, 0, canopyY],
    [.78, .09, .06, 0, canopyY],
  ], 'glass')
  if (boss) {
    if (faction === 'null-cult') {
      coil('reactor-crown', 0, 0, 1.18, 4.32, .28, 'alloy')
      coil('reactor-ion-ring', 0, 0, 1.05, 4.24, .066)
      coil('reactor-inner-ring', 0, 0, 1.04, 3.77, .038)
      for (const side of [-1, 1]) {
        guide('crown-buttress-' + side, [[side * .62, .3, .03], [side * 1.34, .98, .62], [side * 1.46, 1.55, 1.18]], .13, 'shell')
      }
    } else {
      const heavy = faction === 'ashen-legion'
      shell('armored-deck', [
        [heavy ? -2.28 : -1.26, .08, .07, 0, .47], [-.72, heavy ? 1.22 : .51, .25, 0, .63],
        [.64, heavy ? 1.35 : .71, .26, 0, .65], [1.83, heavy ? .82 : .59, .15, 0, .57], [2.16, .11, .05, 0, .36],
      ], 'alloy', 20)
      for (const side of [-1, 1]) {
        guide('deck-light-' + side, [[side * .24, .63, -1.66], [side * (heavy ? .95 : .4), .8, -.37], [side * (heavy ? 1.06 : .47), .76, .92], [side * .41, .61, 1.77]], .041)
      }
    }
    shell('main-engine', [[1.35, .38, .24, 0, -.12], [2.31, .72, .47, 0, -.17], [2.81, .57, .49, 0, -.17]], 'alloy', 20)
    coil('main-engine-ion', 0, -.17, 2.83, .95, .14)
  }

  const parts = root.getChildMeshes(true).filter((mesh): mesh is Mesh => mesh instanceof Mesh)
  for (const [surface, material] of materials) {
    const pieces = parts.filter(piece => piece.material === material)
    if (pieces.length < 2) continue
    const batch = Mesh.MergeMeshes(pieces, true, true)
    if (!batch) continue
    batch.name = name + '-' + surface
    batch.parent = root
    batch.isPickable = false
  }
  const wingDeck = boss ? .305 : .197
  addHullScars(root, [
    [[-wing * .68, wingDeck, tail * .29, wing * .24, -.28]],
    [[wing * .7, wingDeck, tail * .27, wing * .27, .54], [-wing * .46, wingDeck, tail * .5, wing * .12, -1.1]],
    [[boss ? .58 : .26, boss ? .86 : .43, boss ? -.64 : .74, boss ? .68 : .36, 1.4]],
  ])
  root.setEnabled(false)
  return root
}

/** Flight models share immutable geometry and at most four material batches per silhouette. */
export function createFleetModelLibrary(scene: Scene) {
  const library = new Map<string, TransformNode>()
  return {
    create(name: string, faction: FactionId, archetype: ShipArchetype, boss = false, finalEncounter = false) {
      const key = faction + '-' + (boss ? 'capital' : archetype)
      let model = library.get(key)
      if (!model) {
        model = buildFleetModel(scene, 'fleet-template-' + key, faction, archetype, boss)
        library.set(key, model)
      }
      const root = new TransformNode(name, scene)
      for (const mesh of model.getChildMeshes(true)) {
        const cloneName = mesh.name.startsWith('hull-damage-') ? `${mesh.name}-${name}` : name + '-' + mesh.material?.name
        mesh.clone(cloneName, root, true)
      }
      const scale = boss
        ? (finalEncounter ? 1.9 : 1.6) * BOSS_VISUAL_SCALE
        : (archetype === 'scout' ? .85 : archetype === 'frigate' ? 1.35 : 1.1) * ENEMY_VISUAL_SCALE
      root.scaling.setAll(scale)
      return root
    },
    dispose() {
      for (const root of library.values()) root.dispose(false, true)
      library.clear()
    },
  }
}
