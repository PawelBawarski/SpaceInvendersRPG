import { DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core'

export const DAMAGE_NUMBER_LIFETIME_SECONDS = 1

export interface FloatingDamageNumber {
  mesh: Mesh
  remaining: number
  lifetime: number
  createdAt: number
}

export function createDamageNumber(
  scene: Scene,
  position: Vector3,
  damage: number,
  critical: boolean,
  kind: 'outgoing' | 'incoming' = 'outgoing',
): FloatingDamageNumber {
  const texture = new DynamicTexture('damageNumberTexture', { width: 256, height: 128 }, scene, true)
  texture.hasAlpha = true
  const context = texture.getContext()
  context.clearRect(0, 0, 256, 128)
  texture.drawText(
    `${kind === 'incoming' ? '−' : ''}${Math.round(damage)}`,
    null,
    82,
    critical ? 'bold 48px Arial' : '40px Arial',
    kind === 'incoming' ? '#ff827b' : critical ? '#ffd16e' : '#f5f8ff',
    'transparent',
    true,
  )
  texture.update()

  const material = new StandardMaterial('damageNumberMaterial', scene)
  material.disableLighting = true
  material.disableDepthWrite = true
  material.backFaceCulling = false
  material.diffuseTexture = texture
  material.emissiveTexture = texture
  material.useAlphaFromDiffuseTexture = true

  const mesh = MeshBuilder.CreatePlane('damageNumber', { width: 1.7, height: 0.85 }, scene)
  mesh.isPickable = false
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL
  mesh.position.copyFrom(position)
  mesh.position.y += 1
  mesh.material = material

  return {
    mesh,
    remaining: DAMAGE_NUMBER_LIFETIME_SECONDS,
    lifetime: DAMAGE_NUMBER_LIFETIME_SECONDS,
    createdAt: performance.now(),
  }
}

export function updateDamageNumbers(numbers: FloatingDamageNumber[], now = performance.now()): void {
  for (let index = numbers.length - 1; index >= 0; index -= 1) {
    const number = numbers[index]
    const previousRemaining = number.remaining
    number.remaining = Math.max(0, number.lifetime - Math.max(0, now - number.createdAt) / 1000)

    if (number.remaining === 0 || number.mesh.isDisposed()) {
      number.mesh.dispose(false, true)
      numbers.splice(index, 1)
      continue
    }

    number.mesh.position.y += Math.max(0, previousRemaining - number.remaining) * 1.2
    number.mesh.visibility = Math.min(1, number.remaining / 0.3)
  }
}
