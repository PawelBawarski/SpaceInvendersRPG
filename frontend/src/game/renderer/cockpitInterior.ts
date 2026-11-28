import { Color3, DynamicTexture, MeshBuilder, PointLight, Scene, StandardMaterial, TransformNode, Vector3 } from './babylon'
import { formatSpeed } from './format'
import { createSceneMaterial } from './sectorDepth'

export interface CockpitInterior {
  root: TransformNode
  setVisible: (visible: boolean) => void
  setSpeed: (value: number) => void
}

/**
 * First-person cockpit shell parented to the ship: dashboard, control wheel,
 * side consoles and canopy struts, placed close to the eye so cockpit view
 * reads as sitting inside the hull rather than floating in the sky.
 */
export function createCockpitInterior(scene: Scene, camera: TransformNode): CockpitInterior {
  const root = new TransformNode('cockpitInterior', scene)
  root.parent = camera

  const panel = createSceneMaterial('cockpitPanel', scene)
  panel.diffuseColor = Color3.FromHexString('#1a2530')
  panel.specularColor = new Color3(0.2, 0.25, 0.3)
  panel.emissiveColor = Color3.FromHexString('#0a141d')
  const frame = createSceneMaterial('cockpitFrame', scene)
  frame.diffuseColor = Color3.FromHexString('#2b3a47')
  frame.emissiveColor = Color3.FromHexString('#0d1822')
  const glow = createSceneMaterial('cockpitGlow', scene)
  glow.diffuseColor = glow.emissiveColor = Color3.FromHexString('#6fd3ff')
  glow.disableLighting = true
  const wheelMat = createSceneMaterial('cockpitWheel', scene)
  wheelMat.diffuseColor = Color3.FromHexString('#0f1720')
  wheelMat.specularColor = new Color3(0.4, 0.5, 0.6)
  // The eye sits inside the shell, so faces must render from both sides.
  for (const material of [panel, frame, glow, wheelMat]) material.backFaceCulling = false

  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
    mesh.parent = root
    mesh.position.set(x, y, z)
    mesh.material = material
    mesh.isPickable = false
    return mesh
  }

  // Dashboard right in front of the eye, with a glowing console strip.
  box('cockpitDash', 3.0, 0.6, 0.9, 0, 0.18, 1.7, panel)
  box('cockpitConsoleGlow', 2.2, 0.07, 0.08, 0, 0.5, 1.32, glow)
  // Side consoles angled inward.
  for (const side of [-1, 1]) {
    const consoleSide = box('cockpitSideConsole' + side, 0.7, 0.5, 1.2, side * 1.15, 0.15, 1.5, panel)
    consoleSide.rotation.z = side * 0.12
    box('cockpitSideGlow' + side, 0.5, 0.05, 0.08, side * 1.05, 0.42, 1.1, glow)
    // Canopy struts framing the view.
    const pillar = box('cockpitPillar' + side, 0.14, 1.6, 0.2, side * 1.45, 0.8, 1.4, frame)
    pillar.rotation.z = side * 0.16
  }
  box('cockpitHeader', 2.9, 0.16, 0.3, 0, 1.55, 1.2, frame)

  // Control stick (yoke) rising from the console toward the pilot.
  box('cockpitStickBase', 0.22, 0.12, 0.22, 0, -0.05, 1.15, frame)
  const stick = box('cockpitStick', 0.09, 0.55, 0.09, 0, 0.2, 1.12, wheelMat)
  stick.rotation.x = -0.15
  box('cockpitStickGrip', 0.16, 0.18, 0.16, 0, 0.5, 1.05, wheelMat)
  box('cockpitStickButton', 0.06, 0.04, 0.06, 0, 0.6, 1.02, glow)

  // Three glowing MFD screens across the dashboard.
  for (const [index, x] of [-0.62, 0, 0.62].entries()) {
    box('cockpitScreenFrame' + index, 0.5, 0.34, 0.06, x, 0.3, 1.66, frame)
    box('cockpitScreen' + index, 0.4, 0.24, 0.02, x, 0.3, 1.62, glow)
  }
  // A throttle lever on the left console.
  const throttle = box('cockpitThrottle', 0.12, 0.4, 0.12, -1.0, 0.35, 1.35, wheelMat)
  throttle.rotation.x = -0.3

  // Rows of single LEDs and push buttons across the dashboard.
  for (let index = 0; index < 9; index += 1) {
    box(`cockpitLed-${index}`, 0.05, 0.03, 0.03, -0.95 + index * 0.24, 0.5, 1.33, index % 3 === 0 ? glow : frame)
  }
  for (let index = 0; index < 6; index += 1) {
    box(`cockpitButton-${index}`, 0.08, 0.05, 0.04, -0.8 + index * 0.32, 0.4, 1.36, wheelMat)
  }

  // Sit low in the seat: dashboard at the bottom, space visible above.
  root.scaling.setAll(0.6)
  root.position.set(0, -0.55, 0)
  // Soft cockpit light so the panel and buttons read against the dark hull.
  const light = new PointLight('cockpitLight', new Vector3(0, 0.7, 1.0), scene)
  light.parent = root
  light.diffuse = Color3.FromHexString('#cfe3ff')
  light.intensity = 1.15
  light.range = 6
  // A dim fill from behind the pilot keeps the shell from going pure black.
  const fill = new PointLight('cockpitFill', new Vector3(0, 0.2, -0.6), scene)
  fill.parent = root
  fill.diffuse = Color3.FromHexString('#7fa8d8')
  fill.intensity = 0.5
  fill.range = 5

  // Digital speed readout mounted on the dashboard (a 3D panel, not a screen overlay).
  const speedTexture = new DynamicTexture('cockpitSpeedTexture', { width: 256, height: 128 }, scene, false)
  const speedMaterial = createSceneMaterial('cockpitSpeedMaterial', scene)
  speedMaterial.diffuseTexture = speedTexture
  speedMaterial.emissiveColor = Color3.White()
  speedMaterial.disableLighting = true
  speedMaterial.backFaceCulling = false
  const speedPanel = MeshBuilder.CreatePlane('cockpitSpeedPanel', { width: 0.4, height: 0.2 }, scene)
  speedPanel.parent = root
  speedPanel.position.set(0, 0.46, 1.52)
  speedPanel.material = speedMaterial
  speedPanel.isPickable = false
  const drawSpeed = (value: number) => {
    const context = speedTexture.getContext() as CanvasRenderingContext2D
    context.fillStyle = '#021018'
    context.fillRect(0, 0, 256, 128)
    context.fillStyle = '#6fd3ff'
    context.font = 'bold 44px monospace'
    context.textAlign = 'center'
    context.fillText(formatSpeed(value), 128, 78)
    speedTexture.update()
  }
  drawSpeed(0)

  root.setEnabled(false)
  return { root, setVisible: (visible: boolean) => root.setEnabled(visible), setSpeed: drawSpeed }
}