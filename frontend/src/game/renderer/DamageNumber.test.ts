import { MeshBuilder, NullEngine, RawTexture, Scene, StandardMaterial } from '@babylonjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAMAGE_NUMBER_LIFETIME_SECONDS, type FloatingDamageNumber, updateDamageNumbers } from './DamageNumber'

describe('floating damage numbers', () => {
  let engine: NullEngine
  let scene: Scene

  beforeEach(() => {
    engine = new NullEngine()
    scene = new Scene(engine)
  })

  afterEach(() => {
    scene.dispose()
    engine.dispose()
  })

  const damageNumber = (createdAt: number): FloatingDamageNumber => ({
    mesh: MeshBuilder.CreatePlane('damageNumber', {}, scene),
    lifetime: DAMAGE_NUMBER_LIFETIME_SECONDS,
    remaining: DAMAGE_NUMBER_LIFETIME_SECONDS,
    createdAt,
  })

  it('stays readable, fades, and is removed exactly one second after the hit', () => {
    const number = damageNumber(100)
    const numbers = [number]

    updateDamageNumbers(numbers, 700)
    expect(number.mesh.visibility).toBe(1)
    expect(number.mesh.position.y).toBeCloseTo(0.72)

    updateDamageNumbers(numbers, 950)
    expect(number.mesh.visibility).toBeCloseTo(0.5)
    expect(number.mesh.isDisposed()).toBe(false)

    updateDamageNumbers(numbers, 1099)
    expect(numbers).toHaveLength(1)
    updateDamageNumbers(numbers, 1100)
    expect(numbers).toHaveLength(0)
    expect(number.mesh.isDisposed()).toBe(true)
  })

  it('expires after a rendering gap without extending its lifetime', () => {
    const number = damageNumber(100)
    const numbers = [number]

    updateDamageNumbers(numbers, 5100)

    expect(numbers).toHaveLength(0)
    expect(number.mesh.isDisposed()).toBe(true)
  })

  it('removes all expired hits while keeping a newer hit visible', () => {
    const expired = [damageNumber(0), damageNumber(100)]
    const recent = damageNumber(900)
    const numbers = [...expired, recent]

    updateDamageNumbers(numbers, 1200)

    expect(numbers).toEqual([recent])
    expect(expired.every(number => number.mesh.isDisposed())).toBe(true)
    expect(recent.remaining).toBeCloseTo(0.7)
    expect(recent.mesh.visibility).toBe(1)
  })

  it('releases each expired hit material and texture', () => {
    const number = damageNumber(0)
    const material = new StandardMaterial('damageMaterial', scene)
    const texture = RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene)
    const materialDisposed = vi.fn()
    const textureDisposed = vi.fn()
    material.diffuseTexture = texture
    material.onDisposeObservable.add(materialDisposed)
    texture.onDisposeObservable.add(textureDisposed)
    number.mesh.material = material

    updateDamageNumbers([number], 1000)

    expect(materialDisposed).toHaveBeenCalledOnce()
    expect(textureDisposed).toHaveBeenCalledOnce()
  })
})
