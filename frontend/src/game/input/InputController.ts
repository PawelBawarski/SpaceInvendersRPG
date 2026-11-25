export const FLIGHT_COMMANDS = [
  'pitchUp',
  'pitchDown',
  'yawLeft',
  'yawRight',
  'rollLeft',
  'rollRight',
  'boost',
  'fullBoost',
  'brake',
  'fire',
  'dodge',
  'lights',
  'overdrive',
] as const

export type FlightCommand = (typeof FLIGHT_COMMANDS)[number]
export type ControlBindings = Record<FlightCommand, string>
export const DEFAULT_MOUSE_SENSITIVITY = 1.5

export interface MouseFlightInput {
  yaw: number
  pitch: number
  fire: boolean
}

export const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  pitchUp: 'KeyW',
  pitchDown: 'KeyS',
  yawLeft: 'KeyA',
  yawRight: 'KeyD',
  rollLeft: 'KeyQ',
  rollRight: 'KeyE',
  boost: 'ShiftLeft',
  fullBoost: 'Space',
  brake: 'ControlLeft',
  fire: 'KeyF',
  dodge: 'KeyK',
  lights: 'KeyH',
  overdrive: 'KeyX',
}

const DEFAULT_MODIFIER_ALIASES: Partial<Record<FlightCommand, readonly string[]>> = {
  boost: ['ShiftLeft', 'ShiftRight'],
  brake: ['ControlLeft', 'ControlRight'],
}

export class InputController {
  private readonly keys = new Set<string>()
  private readonly taps = new Set<string>()
  private bindings: ControlBindings
  private mouseAim = { yaw: 0, pitch: 0 }
  private mouseFire = false
  private mouseSensitivity: number
  private suspended = false
  private readonly keyDown = (event: KeyboardEvent) => {
    if (this.suspended) return
    if (event.code === 'Space') event.preventDefault()
    if (!event.repeat && !this.keys.has(event.code)) {
      for (const command of ['lights', 'overdrive'] as const) {
        if (this.bindings[command] === event.code) this.taps.add(event.code)
      }
    }
    this.keys.add(event.code)
  }
  private readonly keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }
  private readonly pointerMove = (event: PointerEvent) => {
    if (!this.canvas || this.suspended) return
    const bounds = this.canvas.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return

    this.mouseAim = {
      yaw: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
      pitch: ((event.clientY - bounds.top) / bounds.height - 0.5) * 1.6,
    }
  }
  private readonly pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.suspended) return
    this.mouseFire = true
    event.preventDefault()
  }
  private readonly pointerLeave = () => {
    this.mouseAim = { yaw: 0, pitch: 0 }
  }
  private readonly pointerUp = (event: PointerEvent) => {
    if (event.button === 0) this.mouseFire = false
  }
  private readonly preventContextMenu = (event: MouseEvent) => event.preventDefault()
  private readonly clearInput = () => {
    this.keys.clear()
    this.taps.clear()
    this.mouseFire = false
    this.mouseAim = { yaw: 0, pitch: 0 }
  }
  private readonly canvas: HTMLCanvasElement | undefined

  dispose(): void {
    window.removeEventListener('keydown', this.keyDown)
    window.removeEventListener('keyup', this.keyUp)
    window.removeEventListener('pointerup', this.pointerUp)
    window.removeEventListener('pointercancel', this.pointerUp)
    window.removeEventListener('blur', this.clearInput)
    this.canvas?.removeEventListener('pointermove', this.pointerMove)
    this.canvas?.removeEventListener('pointerdown', this.pointerDown)
    this.canvas?.removeEventListener('pointerleave', this.pointerLeave)
    this.canvas?.removeEventListener('contextmenu', this.preventContextMenu)
  }

  constructor(
    bindings: ControlBindings = DEFAULT_CONTROL_BINDINGS,
    canvas?: HTMLCanvasElement,
    mouseSensitivity = DEFAULT_MOUSE_SENSITIVITY,
  ) {
    this.bindings = bindings
    this.canvas = canvas
    this.mouseSensitivity = mouseSensitivity
    window.addEventListener('keydown', this.keyDown)
    window.addEventListener('keyup', this.keyUp)
    window.addEventListener('pointerup', this.pointerUp)
    window.addEventListener('pointercancel', this.pointerUp)
    window.addEventListener('blur', this.clearInput)
    canvas?.addEventListener('pointermove', this.pointerMove)
    canvas?.addEventListener('pointerdown', this.pointerDown)
    canvas?.addEventListener('pointerleave', this.pointerLeave)
    canvas?.addEventListener('contextmenu', this.preventContextMenu)
  }

  isDown(command: FlightCommand): boolean {
    if (this.suspended) return false
    if (this.keys.has(this.bindings[command])) return true
    if (this.bindings[command] !== DEFAULT_CONTROL_BINDINGS[command]) return false
    return DEFAULT_MODIFIER_ALIASES[command]?.some((code) => this.keys.has(code)) ?? false
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended
    if (suspended) this.clearInput()
  }

  consumeTap(command: 'lights' | 'overdrive'): boolean {
    return !this.suspended && this.taps.delete(this.bindings[command])
  }

  updateSettings(bindings: ControlBindings, mouseSensitivity: number): void {
    this.bindings = bindings
    this.mouseSensitivity = mouseSensitivity
  }

  readMouseFlight(): MouseFlightInput {
    if (this.suspended) return { yaw: 0, pitch: 0, fire: false }
    return {
      yaw: clamp(this.mouseAim.yaw * this.mouseSensitivity, -1, 1),
      pitch: clamp(this.mouseAim.pitch * this.mouseSensitivity, -1, 1),
      fire: this.mouseFire,
    }
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
