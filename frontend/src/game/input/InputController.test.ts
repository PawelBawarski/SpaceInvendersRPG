import { afterEach, describe, expect, it } from 'vitest'
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

  it('steers only during a secondary-button drag and supports firing at the same time', () => {
    const canvas = document.createElement('canvas')
    input = new InputController(DEFAULT_CONTROL_BINDINGS, canvas)

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 750, clientY: 125 }))
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1 }))
    expect(input.readMouseFlight()).toEqual({ yaw: 0, pitch: 0, fire: true })

    window.dispatchEvent(new PointerEvent('pointermove', { button: 2, buttons: 3, clientX: 750, clientY: 125 }))
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 3, clientX: 850, clientY: 75 }))
    const mouseFlight = input.readMouseFlight()
    expect(mouseFlight.yaw).toBeCloseTo(0.27)
    expect(mouseFlight.pitch).toBeCloseTo(-0.135)
    expect(mouseFlight.fire).toBe(true)
    expect(input.readMouseFlight()).toEqual({ yaw: 0, pitch: 0, fire: true })

    window.dispatchEvent(new PointerEvent('pointermove', { button: 2, buttons: 1, clientX: 850, clientY: 75 }))
    window.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 950, clientY: 125 }))
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }))
    expect(input.readMouseFlight()).toEqual({ yaw: 0, pitch: 0, fire: false })
  })

  it('accepts a right drag on the flight HUD and preserves context handling outside suspended flight', () => {
    const surface = document.createElement('main')
    const canvas = document.createElement('canvas')
    const beacon = document.createElement('button')
    const overlay = document.createElement('aside')
    surface.append(canvas, beacon)
    document.body.append(surface, overlay)
    try {
      input = new InputController(DEFAULT_CONTROL_BINDINGS, canvas)
      beacon.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, bubbles: true }))
      expect(input.readMouseFlight().fire).toBe(false)
      beacon.dispatchEvent(new PointerEvent('pointerdown', { button: 2, buttons: 2, bubbles: true }))
      window.dispatchEvent(new PointerEvent('pointermove', { buttons: 2, clientX: 100 }))
      expect(input.readMouseFlight().yaw).toBeCloseTo(.27)
      const menu = () => new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true })
      expect(beacon.dispatchEvent(menu())).toBe(false)
      input.setSuspended(true)
      expect(overlay.dispatchEvent(menu())).toBe(true)
    } finally {
      surface.remove()
      overlay.remove()
    }
  })
})
