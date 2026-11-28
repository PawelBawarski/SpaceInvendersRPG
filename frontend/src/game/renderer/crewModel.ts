import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode } from './babylon'
import type { HangarCrewMember } from '../hangar/crew'

/** Shared PBR-ish material used by hangar and station interiors alike. */
export function createCrewMaterial(scene: Scene, name: string, color: string, emissive: string): StandardMaterial {
  const material = new StandardMaterial(name, scene)
  material.diffuseColor = Color3.FromHexString(color)
  material.emissiveColor = Color3.FromHexString(emissive).scale(0.06)
  material.specularColor = new Color3(0.3, 0.4, 0.48)
  material.specularPower = 48
  material.maxSimultaneousLights = 5
  return material
}

/**
 * The one and only humanoid/robot NPC model. Both the planetary hangar crew and
 * the Bastion Ring concourse use this builder so characters stay visually
 * consistent across the whole world.
 */
export function createCrewMemberModel(scene: Scene, member: HangarCrewMember): TransformNode {
  const root = new TransformNode(`crew-${member.id}`, scene)
  root.position.set(member.position.x, 0, member.position.z)
  if (member.species === 'alien') root.scaling.setAll(1.1)

  const suit = createCrewMaterial(scene, `crewSuit-${member.id}`, member.colors.suit, '#121d27')
  suit.diffuseColor = Color3.Lerp(suit.diffuseColor, new Color3(0.1, 0.16, 0.22), .27)
  suit.emissiveColor = suit.diffuseColor.scale(.12)
  const trim = createCrewMaterial(scene, `crewTrim-${member.id}`, member.colors.trim, '#13202a')
  trim.diffuseColor = trim.diffuseColor.scale(.88)
  trim.emissiveColor = trim.diffuseColor.scale(.2)
  const dark = createCrewMaterial(scene, `crewArmor-${member.id}`, '#18232c', '#0b131d')
  const visorMaterial = createCrewMaterial(scene, `crewVisorMaterial-${member.id}`, '#102b38', '#1b617b')
  visorMaterial.emissiveColor = new Color3(.025, .08, .108)
  visorMaterial.specularColor = new Color3(0.5, 0.75, 0.9)
  visorMaterial.specularPower = 120
  const oval = (name: string, material: StandardMaterial, size: [number, number, number], at: [number, number, number]) => {
    const mesh = MeshBuilder.CreateSphere(name + '-' + member.id, { diameter: 1, segments: 14 }, scene)
    mesh.parent = root
    mesh.scaling.set(...size)
    mesh.position.set(...at)
    mesh.material = material
    mesh.isPickable = false
    return mesh
  }
  if (member.species === 'robot') {
    const optic = createCrewMaterial(scene, 'crewRobotOptic', member.colors.trim, member.colors.trim)
    optic.disableLighting = true
    optic.emissiveColor = Color3.FromHexString(member.colors.trim).scale(.85)
    suit.diffuseColor = Color3.FromHexString(member.colors.suit)
    suit.specularPower = 88
    oval('crewRobotCore', suit, [.91, .76, .68], [0, .98, 0])
    oval('crewRobotUnderbody', dark, [.61, .28, .55], [0, .64, 0])
    oval('crewRobotOpticalHousing', dark, [.68, .31, .42], [0, 1.09, .23])
    oval('crewRobotOptics', visorMaterial, [.59, .21, .36], [0, 1.09, .29])
    for (const side of [-1, 1]) {
      oval('crewRobotEye' + side, optic, [.12, .105, .07], [side * .135, 1.10, .452])
      oval('crewRobotArmJoint' + side, trim, [.22, .23, .23], [side * .44, .98, -.01])
      oval('crewRobotServo' + side, dark, [.19, .39, .22], [side * .52, .76, .04]).rotation.z = side * .32
      oval('crewRobotGripper' + side, suit, [.17, .17, .24], [side * .56, .6, .14])
    }
    const hoverRing = MeshBuilder.CreateTorus('crewHoverRing-' + member.id, { diameter: .46, thickness: .042, tessellation: 18 }, scene)
    hoverRing.parent = root
    hoverRing.position.y = .56
    hoverRing.material = optic
    return root
  }
  const avian = member.species === 'avian'
  oval('crewBody', suit, [.65, .84, .43], [0, 1.04, 0])

  const head = MeshBuilder.CreateSphere(`crewHelmet-${member.id}`, { diameter: 0.54, segments: 16 }, scene)
  if (avian) {
    const hood = createCrewMaterial(scene, 'crewAvianHood', member.colors.skin, '#332435')
    oval('crewAvianCollar', trim, [.6, .18, .43], [0, 1.44, .01])
    head.scaling.set(.93, 1.28, .89)
    head.material = hood
    for (const side of [-1, 1]) oval('crewAvianCrest' + side, suit, [.14, .36, .27], [side * .135, 1.95, -.09]).rotation.z = -side * .32
  }
  head.position.y = 1.72
  head.parent = root
  head.material ??= dark

  const visor = MeshBuilder.CreateSphere(`crewVisor-${member.id}`, { diameter: 0.43, segments: 12 }, scene)
  visor.scaling.set(avian ? .96 : 1, avian ? .32 : .45, .4)
  visor.position.set(0, 1.75, 0.21)
  visor.parent = root
  visor.material = visorMaterial
  if (avian) {
    for (const side of [-1, 1]) oval('crewAvianEye' + side, trim, [.1, .029, .046], [side * .094, 1.756, .288]).rotation.z = side * .16
    oval('crewAvianRespirator', dark, [.19, .23, .21], [0, 1.63, .221])
  }

  oval('crewChestPlate', dark, [.48, .38, .16], [0, 1.13, .19])
  const patch = MeshBuilder.CreateBox(`crewIdentityPatch-${member.id}`, { width: 0.12, height: 0.09, depth: 0.02 }, scene)
  patch.parent = root
  patch.position.set(-0.1, 1.21, 0.245)
  patch.material = trim
  const radio = MeshBuilder.CreateBox(`crewComms-${member.id}`, { width: .095, height: .19, depth: .085 }, scene)
  radio.parent = root
  radio.position.set(.23, 1.28, .175)
  radio.material = dark
  const belt = MeshBuilder.CreateBox(`crewUtilityBelt-${member.id}`, { width: 0.59, height: 0.13, depth: 0.4 }, scene)
  belt.parent = root
  belt.position.y = 0.71
  belt.material = dark

  for (const side of [-1, 1]) {
    const arm = MeshBuilder.CreateCylinder(`crewArm-${member.id}-${side}`, { height: 0.76, diameter: 0.17, tessellation: 10 }, scene)
    arm.position.set(side * 0.37, 0.94, 0)
    arm.rotation.z = side * -0.18
    arm.parent = root
    arm.material = suit

    const leg = MeshBuilder.CreateCylinder(`crewLeg-${member.id}-${side}`, { height: 0.62, diameter: 0.22, tessellation: 10 }, scene)
    leg.position.set(side * 0.17, 0.34, 0)
    leg.parent = root
    leg.material = suit

    const boot = MeshBuilder.CreateBox(`crewBoot-${member.id}-${side}`, { width: 0.3, height: 0.15, depth: 0.42 }, scene)
    boot.position.set(side * 0.17, 0.035, 0.06)
    boot.parent = root
    boot.material = dark

    oval('crewShoulder' + side, trim, [avian ? .33 : .24, .23, .31], [side * .34, 1.29, .01]).rotation.z = side * -.12
  }

  const pack = MeshBuilder.CreateBox(`crewPack-${member.id}`, { width: 0.44, height: 0.55, depth: 0.24 }, scene)
  pack.position.set(0, 1.05, -0.34)
  pack.parent = root
  pack.material = dark

  if (member.species === 'alien') {
    for (const side of [-1, 1]) {
      const antenna = MeshBuilder.CreateCylinder(`crewAntenna-${member.id}-${side}`, { height: 0.42, diameter: 0.07, tessellation: 6 }, scene)
      antenna.position.set(side * 0.17, 2.12, -0.02)
      antenna.rotation.z = side * 0.34
      antenna.parent = root
      antenna.material = trim
      const tip = MeshBuilder.CreateSphere(`crewAntennaTip-${member.id}-${side}`, { diameter: 0.14 }, scene)
      tip.position.set(side * 0.24, 2.3, -0.02)
      tip.parent = root
      tip.material = trim
    }
  }

  return root
}