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
export const MOUSE_SENSITIVITY_RANGE = { min: 0.5, max: 3, step: 0.1 } as const
const LOOK_RADIANS_PER_PIXEL = 0.0018

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
  private readonly mouseAim = { yaw: 0, pitch: 0 }
  private lookPosition: { x: number; y: number } | undefined
  private flightPointer: number | undefined
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
  private updatePointerButtons(event: PointerEvent) {
    this.mouseFire = (event.buttons & 1) !== 0
    if (event.buttons & 2) this.lookPosition ??= { x: event.clientX, y: event.clientY }
    else this.lookPosition = undefined
  }
  private readonly pointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.flightPointer || this.suspended) return
    const position = this.lookPosition
    this.updatePointerButtons(event)
    if (!position || !this.lookPosition) return
    this.mouseAim.yaw += event.clientX - position.x
    this.mouseAim.pitch += event.clientY - position.y
    position.x = event.clientX
    position.y = event.clientY
  }
  private readonly pointerDown = (event: PointerEvent) => {
    if (this.suspended || (event.button !== 0 && event.button !== 2)) return
    if (event.button === 0 && event.target !== this.canvas) return
    this.flightPointer = event.pointerId
    this.updatePointerButtons(event)
    event.preventDefault()
  }
  private readonly pointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.flightPointer) return
    this.flightPointer = undefined
    this.mouseFire = false
    this.lookPosition = undefined
  }
  private readonly preventContextMenu = (event: MouseEvent) => {
    const surface = this.pointerSurface
    if (surface && (!this.suspended || (event.target instanceof Node && surface.contains(event.target)))) event.preventDefault()
  }
  private readonly clearInput = () => {
    this.keys.clear()
    this.taps.clear()
    this.mouseFire = false
    this.flightPointer = undefined
    this.lookPosition = undefined
    this.mouseAim.yaw = 0
    this.mouseAim.pitch = 0
  }
  private readonly canvas: HTMLCanvasElement | undefined
  private readonly pointerSurface: HTMLElement | undefined

  dispose(): void {
    window.removeEventListener('keydown', this.keyDown)
    window.removeEventListener('keyup', this.keyUp)
    window.removeEventListener('pointerup', this.pointerEnd, true)
    window.removeEventListener('pointermove', this.pointerMove, true)
    window.removeEventListener('pointercancel', this.pointerEnd, true)
    window.removeEventListener('blur', this.clearInput)
    this.pointerSurface?.removeEventListener('pointerdown', this.pointerDown, true)
    window.removeEventListener('contextmenu', this.preventContextMenu, true)
  }

  constructor(
    bindings: ControlBindings = DEFAULT_CONTROL_BINDINGS,
    canvas?: HTMLCanvasElement,
    mouseSensitivity = DEFAULT_MOUSE_SENSITIVITY,
  ) {
    this.bindings = bindings
    this.canvas = canvas
    this.pointerSurface = canvas?.parentElement ?? canvas
    this.mouseSensitivity = mouseSensitivity
    window.addEventListener('keydown', this.keyDown)
    window.addEventListener('keyup', this.keyUp)
    window.addEventListener('pointerup', this.pointerEnd, true)
    window.addEventListener('pointermove', this.pointerMove, true)
    window.addEventListener('pointercancel', this.pointerEnd, true)
    window.addEventListener('blur', this.clearInput)
    this.pointerSurface?.addEventListener('pointerdown', this.pointerDown, true)
    if (canvas) window.addEventListener('contextmenu', this.preventContextMenu, true)
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
    const sensitivity = LOOK_RADIANS_PER_PIXEL * this.mouseSensitivity
    const update = {
      yaw: this.mouseAim.yaw * sensitivity,
      pitch: this.mouseAim.pitch * sensitivity,
      fire: this.mouseFire,
    }
    this.mouseAim.yaw = 0
    this.mouseAim.pitch = 0
    return update
  }
}
