import { afterEach, describe, expect, it } from 'vitest'
import { NullEngine, Scene, StandardMaterial, TransformNode } from '@babylonjs/core'
import { createLandingGear } from './LandingGear'
import { HANGAR_LANDED_Y, HANGAR_PAD_Y, HANGAR_SHIP_SCALE, HANGAR_TOUCHDOWN_PROGRESS, LANDING_GEAR_GEOMETRY, sampleDepartureCompression, sampleDepartureLandingGear, sampleHangarLanding } from '../simulation/HangarLanding'
import { sampleHangarDeparture } from '../simulation/StationApproach'

const engines: NullEngine[] = []
afterEach(() => { for (const engine of engines.splice(0)) engine.dispose() })

function setup() {
  const engine = new NullEngine()
  engines.push(engine)
  const scene = new Scene(engine)
  const ship = new TransformNode('ship', scene)
  ship.scaling.setAll(HANGAR_SHIP_SCALE)
  const metal = new StandardMaterial('metal', scene)
  const gear = createLandingGear(scene, ship, metal, metal)
  const footBottoms = () => [0, 1, 2].map(index => {
    const foot = scene.getMeshByName(`hangarLandingFoot-${index}`)!
    foot.computeWorldMatrix(true)
    return foot.getBoundingInfo().boundingBox.minimumWorld.y
  })
  return { scene, ship, gear, footBottoms }
}

describe('articulated landing gear', () => {
  it('unfolds and extends all three legs while hovering, then lands with every foot on the pad', () => {
    const { scene, ship, gear, footBottoms } = setup()
    const start = sampleHangarLanding(0)
    ship.position.y = start.y
    gear.update(start.gear)
    expect(scene.getTransformNodeByName('hangarLandingGear-0')!.isEnabled()).toBe(false)
    const half = sampleHangarLanding(0.44)
    gear.update(half.gear)
    expect(half.stage).toBe('deploying')
    expect(half.y).toBe(start.y)
    expect(scene.getTransformNodeByName('hangarLandingGear-0')!.rotation.x).toBeCloseTo(Math.PI / 4)
    expect(Math.min(...footBottoms())).toBeGreaterThan(HANGAR_PAD_Y + 0.4)
    const extended = sampleHangarLanding(0.68)
    expect(extended.gear).toBe(1)
    expect(extended.y).toBe(start.y)
    const landed = sampleHangarLanding(1)
    ship.position.y = landed.y
    gear.update(landed.gear, landed.compression)
    expect(landed.stage).toBe('landed')
    expect(ship.position.y).toBe(HANGAR_LANDED_Y)
    for (const bottom of footBottoms()) expect(bottom).toBeCloseTo(HANGAR_PAD_Y, 6)
  })

  it('lifts off before folding the gear and never pushes the feet through the landing pad', () => {
    const { scene, ship, gear, footBottoms } = setup()
    expect(sampleDepartureLandingGear(0)).toBe(1)
    expect(sampleDepartureLandingGear(0.16)).toBe(1)
    expect(sampleDepartureLandingGear(0.3)).toBeGreaterThan(0)
    expect(sampleDepartureLandingGear(0.3)).toBeLessThan(1)
    expect(sampleDepartureLandingGear(0.42)).toBe(0)
    for (let index = 0; index <= 100; index++) {
      const progress = index / 100
      ship.position.y = sampleHangarDeparture(progress).y
      gear.update(sampleDepartureLandingGear(progress), sampleDepartureCompression(progress))
      for (const bottom of footBottoms()) expect(bottom).toBeGreaterThanOrEqual(HANGAR_PAD_Y - 0.00001)
    }
    expect(scene.getTransformNodeByName('hangarLandingGear-0')!.isEnabled()).toBe(false)
  })

  it('compresses and rebounds gently after contact while every foot stays fixed on the pad', () => {
    const { ship, gear, footBottoms } = setup()
    const heights: number[] = []
    let peakCompression = 0
    for (let index = 0; index <= 100; index++) {
      const pose = sampleHangarLanding(HANGAR_TOUCHDOWN_PROGRESS + (1 - HANGAR_TOUCHDOWN_PROGRESS) * index / 100)
      ship.position.y = pose.y
      gear.update(pose.gear, pose.compression)
      heights.push(pose.y)
      peakCompression = Math.max(peakCompression, pose.compression)
      expect(pose.gear).toBe(1)
      for (const bottom of footBottoms()) expect(bottom).toBeCloseTo(HANGAR_PAD_Y, 6)
    }
    expect(peakCompression).toBeGreaterThan(LANDING_GEAR_GEOMETRY.loadedCompression + 0.01)
    expect(peakCompression).toBeLessThan(LANDING_GEAR_GEOMETRY.maximumCompression)
    expect(Math.min(...heights)).toBeLessThan(HANGAR_LANDED_Y - 0.01)
    expect(heights.at(-1)).toBe(HANGAR_LANDED_Y)
    expect(sampleHangarLanding(2)).toEqual(sampleHangarLanding(1))
  })
})
