import {
  Camera,
  Color3,
  Color4,
  DynamicTexture,
  MeshBuilder,
  ParticleSystem,
  Scene,
  TransformNode,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core'
import type { GraphicsQuality } from '../progress/gameSettings'
import { spaceEffectsProfile } from './spaceEffectsProfile'

/** World-space exhaust fades behind the ship instead of moving with its hull. */
export function createFlightEffects(
  scene: Scene,
  ship: TransformNode,
  camera: Camera,
  quality: GraphicsQuality,
  maximumSpeed: number,
) {
  const baseFov = camera.fov
  const texture = new DynamicTexture('flightIonTrailTexture', { width: 64, height: 64 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(225,245,255,0.9)')
  gradient.addColorStop(0.3, 'rgba(160,210,235,0.45)')
  gradient.addColorStop(1, 'rgba(70,120,150,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  texture.hasAlpha = true
  texture.update()

  const profile = spaceEffectsProfile(quality)
  const capacity = profile.trailCapacity
  const emitters = [-1, 1].map(side => {
    const position = new Vector3()
    const particles = new ParticleSystem(`shipIonTrail${side}`, capacity, scene)
    particles.particleTexture = texture
    particles.emitter = position
    particles.createBoxEmitter(
      new Vector3(-0.08, -0.08, -1), new Vector3(0.08, 0.08, -1),
      new Vector3(-0.06, -0.06, -0.02), new Vector3(0.06, 0.06, 0.02),
    )
    particles.blendMode = ParticleSystem.BLENDMODE_STANDARD
    particles.color1 = new Color4(0.34, 0.66, 0.82, 0.24)
    particles.color2 = new Color4(0.18, 0.34, 0.46, 0.13)
    particles.colorDead = new Color4(0.08, 0.15, 0.22, 0)
    particles.minSize = 0.16
    particles.maxSize = 0.36
    particles.minLifeTime = 0.3
    particles.maxLifeTime = 0.6
    particles.minEmitPower = 1.3
    particles.maxEmitPower = 2.5
    particles.updateSpeed = 0.012
    particles.emitRate = 0
    particles.addSizeGradient(0, 0.5)
    particles.addSizeGradient(0.65, 1.2)
    particles.addSizeGradient(1, 1.8)
    particles.start()
    return { particles, position, localPosition: new Vector3(side * 0.57, -0.08, -2.3) }
  })

  const plumes = ship.getChildMeshes().filter(mesh => mesh.name.startsWith('shipEngineExhaust'))
    .map(mesh => ({ mesh, startZ: mesh.position.z }))
  const streakCount = profile.streakCount
  const aspect = scene.getEngine().getAspectRatio(camera)
  const streaks = Array.from({ length: streakCount }, (_, index) => {
    const angle = index / streakCount * Math.PI * 2 + index * 0.13
    const radius = 2.7 + index % 4 * 0.55
    return { x: Math.cos(angle) * radius * aspect, y: Math.sin(angle) * radius, z: 5 + index * 1.13 }
  })
  const lines = streaks.map(streak => [
    new Vector3(streak.x, streak.y, 3.5), new Vector3(streak.x, streak.y, 24.2),
  ])
  const speedLines = MeshBuilder.CreateLineSystem('flightSpeedStreaks', { lines, updatable: true }, scene)
  const streakPositions = new Float32Array(streakCount * 6)
  speedLines.parent = camera
  speedLines.color = new Color3(0.3, 0.48, 0.61)
  speedLines.alpha = 0
  speedLines.setEnabled(false)
  speedLines.isPickable = false
  speedLines.alwaysSelectAsActiveMesh = true

  const backward = new Vector3()
  const backwardAxis = new Vector3(0, 0, -1)
  let elapsed = 0
  let strength = 0
  let previousSpeed = 0

  return {
    setPaused(paused: boolean) {
      if (paused) speedLines.setEnabled(false)
      for (const { particles } of emitters) {
        particles.updateSpeed = paused ? 0 : 0.012
        if (paused) particles.emitRate = 0
      }
    },

    update(dt: number, speed: number, thrust: number) {
      elapsed += dt
      const speedRatio = Math.min(1, Math.abs(speed) / Math.max(1, maximumSpeed))
      // Coasting keeps ordinary stars, but produces no acceleration overlay.
      const thrustStrength = speedRatio * Math.max(0, Math.min(1, thrust))
      strength = thrust > 0 ? strength + (thrustStrength - strength) * Math.min(1, dt * 5) : 0
      const acceleration = Math.max(0, Math.abs(speed) - Math.abs(previousSpeed)) / Math.max(0.001, dt * maximumSpeed)
      previousSpeed = speed
      const boost = thrust > 0 ? strength : 0
      const desiredFov = baseFov + boost * 0.07 + (thrust > 0 ? Math.min(0.015, acceleration * 0.015) : 0)
      camera.fov += (desiredFov - camera.fov) * Math.min(1, dt * 3.5)

      const pulse = Math.sin(elapsed * 24) * 0.06
      for (const { mesh, startZ } of plumes) {
        mesh.scaling.y = 0.55 + strength * 1.7 + pulse
        mesh.scaling.x = mesh.scaling.z = 0.88 + strength * 0.18
        mesh.position.z = startZ - strength * 0.32
        mesh.visibility = 0.25 + strength * 0.65
      }

      ship.computeWorldMatrix(true)
      ship.getDirectionToRef(backwardAxis, backward)
      for (const { particles, position, localPosition } of emitters) {
        Vector3.TransformCoordinatesToRef(localPosition, ship.getWorldMatrix(), position)
        particles.direction1.copyFrom(backward).addInPlaceFromFloats(-0.09, -0.09, -0.03)
        particles.direction2.copyFrom(backward).addInPlaceFromFloats(0.09, 0.09, 0.03)
        particles.emitRate = strength < 0.02 ? 0 : profile.trailRate * strength
        particles.minEmitPower = 1.2 + boost * 1.3
        particles.maxEmitPower = 2.3 + boost * 2
      }

      for (let index = 0; index < streaks.length; index += 1) {
        const streak = streaks[index]
        streak.z -= dt * strength * (13 + boost * 12)
        if (streak.z < 3.5) streak.z = 20 + index % 3
        const offset = index * 6
        streakPositions[offset] = streak.x
        streakPositions[offset + 1] = streak.y
        streakPositions[offset + 2] = streak.z
        streakPositions[offset + 3] = streak.x
        streakPositions[offset + 4] = streak.y
        streakPositions[offset + 5] = streak.z + 0.2 + strength * 1.8
      }
      speedLines.alpha = Math.max(0, strength - 0.08) * 0.085
      speedLines.setEnabled(thrust > 0 && strength > 0.08)
      speedLines.updateVerticesData(VertexBuffer.PositionKind, streakPositions, false, false)
    },

    dispose() {
      for (const { particles } of emitters) particles.dispose(false)
      texture.dispose()
      speedLines.dispose()
    },
  }
}
