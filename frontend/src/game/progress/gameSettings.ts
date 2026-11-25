import {
  DEFAULT_CONTROL_BINDINGS,
  DEFAULT_MOUSE_SENSITIVITY,
  FLIGHT_COMMANDS,
  type ControlBindings,
} from '../input/InputController'

export type GameLanguage = 'pl' | 'en'
export type GraphicsQuality = 'low' | 'standard' | 'high'

export interface GameSettings {
  language: GameLanguage
  graphicsQuality: GraphicsQuality
  controls: ControlBindings
  mouseSensitivity: number
  mainVolume: number
  shotsVolume: number
  musicVolume: number
}

const STORAGE_KEY = 'neon-void:settings:v1'

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  language: 'pl',
  graphicsQuality: 'standard',
  controls: DEFAULT_CONTROL_BINDINGS,
  mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
  mainVolume: 0.8,
  shotsVolume: 0.7,
  musicVolume: 0.35,
}

function loadControlBindings(value: unknown): ControlBindings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_CONTROL_BINDINGS }
  }

  const parsed = value as Record<string, unknown>
  const controls = { ...DEFAULT_CONTROL_BINDINGS }
  const used = new Set<string>()
  // Older profiles have every original command but no full-thrust binding.
  for (const command of FLIGHT_COMMANDS.filter(command => command !== 'fullBoost')) {
    const binding = parsed[command]
    if (typeof binding !== 'string' || binding.length === 0 || used.has(binding)) {
      return { ...DEFAULT_CONTROL_BINDINGS }
    }
    controls[command] = binding
    used.add(binding)
  }
  const savedFullBoost = typeof parsed.fullBoost === 'string' && parsed.fullBoost.length > 0 ? parsed.fullBoost : null
  if (controls.fire === 'Space') {
    used.delete('Space')
    const reserved = new Set(used)
    if (savedFullBoost) reserved.add(savedFullBoost)
    controls.fire = findAvailableBinding(reserved, ['KeyF', 'KeyJ', 'KeyH'])
    used.add(controls.fire)
  }
  controls.fullBoost = savedFullBoost && !used.has(savedFullBoost)
    ? savedFullBoost
    : findAvailableBinding(used, ['Space', 'KeyT', 'KeyG', 'KeyR'])
  if (controls.rollLeft === 'KeyE' && controls.rollRight === 'KeyQ') {
    controls.rollLeft = 'KeyQ'
    controls.rollRight = 'KeyE'
  }
  for (const command of FLIGHT_COMMANDS) {
    if (controls[command] !== 'KeyL') continue
    const reserved = new Set(Object.values(controls))
    controls[command] = findAvailableBinding(reserved, [DEFAULT_CONTROL_BINDINGS[command], 'KeyJ', 'KeyH', 'KeyB'])
  }
  return controls
}

function findAvailableBinding(used: ReadonlySet<string>, preferred: readonly string[]): string {
  const candidates = [...preferred, ...Array.from({ length: 12 }, (_, index) => `F${index + 13}`)]
  return candidates.find(binding => !used.has(binding))!
}

function loadVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback
}

function loadMouseSensitivity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0.5, Math.min(3, value))
    : DEFAULT_MOUSE_SENSITIVITY
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_CONTROL_BINDINGS } }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      language: parsed.language === 'en' ? 'en' : 'pl',
      graphicsQuality: parsed.graphicsQuality === 'low' || parsed.graphicsQuality === 'high'
        ? parsed.graphicsQuality
        : 'standard',
      controls: loadControlBindings(parsed.controls),
      mouseSensitivity: loadMouseSensitivity(parsed.mouseSensitivity),
      mainVolume: loadVolume(parsed.mainVolume, DEFAULT_GAME_SETTINGS.mainVolume),
      shotsVolume: loadVolume(parsed.shotsVolume, DEFAULT_GAME_SETTINGS.shotsVolume),
      musicVolume: loadVolume(parsed.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume),
    }
  } catch {
    return { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_CONTROL_BINDINGS } }
  }
}

export function saveGameSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
