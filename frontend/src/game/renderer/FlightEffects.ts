import {
  Camera,
  Color3,
  Color4,
  Constants,
  DynamicTexture,
  MeshBuilder,
  ParticleSystem,
  Scene,
  TransformNode,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core'
import type { GraphicsQuality, GraphicsSettings } from '../progress/gameSettings'
import { setShipDrivePower, type ShipDrive } from './shipVisual'
import { spaceEffectsProfile } from './spaceEffectsProfile'
import { usesSectorDepth } from './sectorDepth'

/** World-space exhaust fades behind the ship instead of moving with its hull. */
export function createFlightEffects(
  scene: Scene,
  ship: TransformNode,
  camera: Camera,
  quality: GraphicsQuality,
  maximumSpeed: number,
  appearance = ship,
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

  let profile = spaceEffectsProfile(quality)
  let engineParticles = true
  let speedEffects = true
  const drive = appearance.metadata.drive as ShipDrive
  const capacity = spaceEffectsProfile('high').trailCapacity
  const emitters = drive.thrusters.map(({ anchor, diameter }, index) => {
    const position = new Vector3()
    const particles = new ParticleSystem(`shipIonTrail${index}`, capacity, scene)
    particles.useLogarithmicDepth = usesSectorDepth(scene)
    particles.particleTexture = texture
    particles.emitter = position
    particles.createBoxEmitter(
      new Vector3(-0.08, -0.08, -1), new Vector3(0.08, 0.08, -1),
      new Vector3(-0.06, -0.06, -0.02), new Vector3(0.06, 0.06, 0.02),
    )
    particles.blendMode = ParticleSystem.BLENDMODE_ADD
    const tint = Color3.Lerp(drive.tint, Color3.White(), .28)
    particles.color1 = new Color4(tint.r, tint.g, tint.b, 0.48)
    particles.color2 = new Color4(drive.tint.r, drive.tint.g, drive.tint.b, 0.25)
    particles.colorDead = new Color4(0.08, 0.15, 0.22, 0)
    particles.minSize = diameter * .24
    particles.maxSize = diameter * .58
    particles.minLifeTime = 0.22
    particles.maxLifeTime = 0.48
    particles.minEmitPower = 1.3
    particles.maxEmitPower = 2.5
    particles.updateSpeed = 0.012
    particles.emitRate = 0
    particles.addSizeGradient(0, 0.5)
    particles.addSizeGradient(0.65, 1.2)
    particles.addSizeGradient(1, 1.8)
    particles.start()
    return { particles, position, anchor }
  })

  const streakCount = spaceEffectsProfile('high').streakCount
  const aspect = scene.getEngine().getAspectRatio(camera)
  const streaks = Array.from({ length: streakCount }, (_, index) => {
    const angle = index / streakCount * Math.PI * 2 + index * 0.13
    const radius = 1.3 + index % 6 * 0.53
    return { x: Math.cos(angle) * radius * aspect, y: Math.sin(angle) * radius, z: 5 + index * 1.13 }
  })
  const lines = streaks.map(streak => [
    new Vector3(streak.x, streak.y, 3.5), new Vector3(streak.x, streak.y, 24.2),
  ])
  const speedLines = MeshBuilder.CreateLineSystem('flightSpeedStreaks', { lines, updatable: true }, scene)
  if (speedLines.material) {
    speedLines.material.disableDepthWrite = true
    speedLines.material.depthFunction = Constants.ALWAYS
  }
  const streakPositions = new Float32Array(streakCount * 6)
  speedLines.parent = camera
  const cruiseStreakColor = new Color3(0.52, 0.77, 0.9)
  const jumpStreakColor = new Color3(0.56, 0.79, 1)
  speedLines.color.copyFrom(cruiseStreakColor)
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
    configure(graphics: GraphicsSettings) {
      profile = spaceEffectsProfile(graphics.graphicsQuality)
      engineParticles = graphics.engineParticles
      speedEffects = graphics.speedEffects
      if (!speedEffects) { speedLines.setEnabled(false); camera.fov = baseFov }
      if (!engineParticles) {
        for (const { particles } of emitters) { particles.emitRate = 0; particles.reset() }
      }
    },

    setPaused(paused: boolean) {
      if (paused) speedLines.setEnabled(false)
      for (const { particles } of emitters) {
        particles.updateSpeed = paused ? 0 : 0.012
        if (paused) particles.emitRate = 0
      }
    },

    update(dt: number, speed: number, thrust: number, hyperspace = false) {
      elapsed += dt
      const speedRatio = Math.min(1, Math.abs(speed) / Math.max(1, maximumSpeed))
      // Coasting keeps ordinary stars, but produces no acceleration overlay.
      const thrustStrength = speedRatio * Math.max(0, Math.min(1, thrust))
      strength = thrust > 0 ? strength + (thrustStrength - strength) * Math.min(1, dt * 5) : 0
      const acceleration = Math.max(0, Math.abs(speed) - Math.abs(previousSpeed)) / Math.max(0.001, dt * maximumSpeed)
      previousSpeed = speed
      const boost = thrust > 0 ? strength : 0
      const desiredFov = baseFov + (speedEffects ? boost * (hyperspace ? .18 : .085)
        + (thrust > 0 ? Math.min(.024, acceleration * .018) : 0) : 0)
      camera.fov += (desiredFov - camera.fov) * Math.min(1, dt * 3.5)

      const power = Math.min(1, speedRatio * .31 + Math.abs(thrust) * .36 + strength * .33)
      setShipDrivePower(drive, power, elapsed, hyperspace)

      ship.computeWorldMatrix(true)
      ship.getDirectionToRef(backwardAxis, backward)
      if (engineParticles) {
        for (const { particles, position, anchor } of emitters) {
          anchor.computeWorldMatrix(true)
          position.copyFrom(anchor.absolutePosition)
          particles.direction1.copyFrom(backward).addInPlaceFromFloats(-0.07, -0.07, -0.025)
          particles.direction2.copyFrom(backward).addInPlaceFromFloats(0.07, 0.07, 0.025)
          particles.emitRate = strength < 0.02 ? 0 : profile.trailRate * strength
          particles.minEmitPower = 1.6 + boost * 2.6
          particles.maxEmitPower = 2.7 + boost * 3.8
        }
      }

      const drawStreaks = speedEffects && thrust > 0 && strength > 0.08
      speedLines.setEnabled(drawStreaks)
      if (!drawStreaks) return
      for (let index = 0; index < streaks.length; index += 1) {
        const offset = index * 6
        if (!hyperspace && index >= profile.streakCount) {
          streakPositions.fill(0, offset, offset + 6)
          continue
        }
        const streak = streaks[index]
        streak.z -= dt * strength * (hyperspace ? 62 : 17 + boost * 17)
        if (streak.z < 3.5) streak.z = 20 + index % 3
        streakPositions[offset] = streak.x
        streakPositions[offset + 1] = streak.y
        streakPositions[offset + 2] = streak.z
        streakPositions[offset + 3] = streak.x
        streakPositions[offset + 4] = streak.y
        streakPositions[offset + 5] = streak.z + 0.3 + strength * (hyperspace ? 11 : 3.6)
      }
      speedLines.alpha = Math.max(0, strength - 0.08) * (hyperspace ? .7 : .25)
      speedLines.color.copyFrom(hyperspace ? jumpStreakColor : cruiseStreakColor)
      speedLines.updateVerticesData(VertexBuffer.PositionKind, streakPositions, false, false)
    },

    dispose() {
      for (const { particles } of emitters) particles.dispose(false)
      texture.dispose()
      speedLines.dispose()
    },
  }
}
