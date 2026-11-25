import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONTROL_BINDINGS, InputController } from './InputController'

describe('input controller', () => {
  let input: InputController | undefined

  afterEach(() => {
    input?.dispose()
    input = undefined
  })

  it('uses saved key bindings and releases them on keyup', () => {
    input = new InputController({ ...DEFAULT_CONTROL_BINDINGS, fire: 'KeyJ' })

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }))
    expect(input.isDown('fire')).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }))
    expect(input.isDown('fire')).toBe(false)
  })

  it('uses Space exclusively for full thrust and F as the keyboard firing alternative', () => {
    input = new InputController()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    expect(input.isDown('fullBoost')).toBe(true)
    expect(input.isDown('fire')).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))
    expect(input.isDown('fullBoost')).toBe(false)
    expect(input.isDown('fire')).toBe(true)
  })

  it('updates bindings without recreating the input controller', () => {
    input = new InputController()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }))

    expect(input.isDown('fire')).toBe(false)
    input.updateSettings({ ...DEFAULT_CONTROL_BINDINGS, fire: 'KeyJ' }, 1.8)
    expect(input.isDown('fire')).toBe(true)
  })

  it('suspends held flight controls while a menu or ship sheet is open', () => {
    input = new InputController()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
    expect(input.isDown('boost')).toBe(true)
    input.setSuspended(true)
    expect(input.isDown('boost')).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    input.setSuspended(false)
    expect(input.isDown('fullBoost')).toBe(false)
  })

  it('keeps left and right modifier keys available with the default bindings', () => {
    input = new InputController()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftRight' }))
    expect(input.isDown('boost')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftRight' }))

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlRight' }))
    expect(input.isDown('brake')).toBe(true)
  })

  it('uses Q to roll left and E to roll right', () => {
    input = new InputController()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
    expect(input.isDown('rollLeft')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' }))

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    expect(input.isDown('rollRight')).toBe(true)
  })

  it('uses the mouse position for steering and the primary button for firing', () => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 500,
      width: 1000,
      height: 500,
      toJSON: () => ({}),
    })
    input = new InputController(DEFAULT_CONTROL_BINDINGS, canvas)

    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 750, clientY: 125 }))
    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }))
    const mouseFlight = input.readMouseFlight()
    expect(mouseFlight.yaw).toBeCloseTo(0.75)
    expect(mouseFlight.pitch).toBeCloseTo(-0.6)
    expect(mouseFlight.fire).toBe(true)

    window.dispatchEvent(new MouseEvent('pointerup', { button: 0 }))
    expect(input.readMouseFlight().fire).toBe(false)
  })
})
