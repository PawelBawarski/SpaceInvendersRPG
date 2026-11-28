import { DEFAULT_GAME_LANGUAGE, isGameLanguage, type GameLanguage } from '../i18n'
import {
  DEFAULT_CONTROL_BINDINGS,
  DEFAULT_MOUSE_SENSITIVITY,
  FLIGHT_COMMANDS,
  MOUSE_SENSITIVITY_RANGE,
  type ControlBindings,
} from '../input/InputController'

export type { GameLanguage } from '../i18n'
export type GraphicsQuality = 'low' | 'standard' | 'high'
export const RENDER_SCALES = [0.5, 0.67, 0.85, 1, 1.2] as const
export type RenderScale = (typeof RENDER_SCALES)[number]
export type StarfieldDensity = 'low' | 'medium' | 'high'
export const STARFIELD_DENSITY_STARS: Record<StarfieldDensity, number> = { low: 90, medium: 150, high: 220 }
export const STARFIELD_DENSITIES: readonly StarfieldDensity[] = ['low', 'medium', 'high']

export interface GraphicsSettings {
  graphicsQuality: GraphicsQuality
  renderScale: RenderScale | null
  bloom: boolean
  engineParticles: boolean
  speedEffects: boolean
  planetAtmospheres: boolean
  hangarShadows: boolean
  starfieldDensity: StarfieldDensity
  damageVignette: boolean
  showFps: boolean
}

export interface GameSettings extends GraphicsSettings {
  language: GameLanguage
  controls: ControlBindings
  mouseSensitivity: number
  mainVolume: number
  shotsVolume: number
  musicVolume: number
  shipLights: boolean
}

const STORAGE_KEY = 'neon-void:settings:v1'

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  language: DEFAULT_GAME_LANGUAGE,
  graphicsQuality: 'standard',
  renderScale: null,
  bloom: true,
  engineParticles: true,
  speedEffects: true,
  planetAtmospheres: true,
  hangarShadows: true,
  starfieldDensity: 'medium',
  damageVignette: true,
  showFps: false,
  controls: DEFAULT_CONTROL_BINDINGS,
  mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
  mainVolume: 0.8,
  shotsVolume: 0.7,
  musicVolume: 0.35,
  shipLights: false,
}

function loadControlBindings(value: unknown): ControlBindings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_CONTROL_BINDINGS }
  }

  const parsed = value as Record<string, unknown>
  const controls = { ...DEFAULT_CONTROL_BINDINGS }
  const used = new Set<string>()
  // Older profiles have every original command but no full-thrust binding.
  for (const command of FLIGHT_COMMANDS.filter(command => command !== 'fullBoost' && command !== 'lights' && command !== 'overdrive')) {
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
    controls.fire = findAvailableBinding(reserved, ['KeyJ', 'KeyH', 'KeyF'])
    used.add(controls.fire)
  }
  controls.fullBoost = savedFullBoost && !used.has(savedFullBoost)
    ? savedFullBoost
    : findAvailableBinding(used, ['Space', 'KeyT', 'KeyG', 'KeyR'])
  used.add(controls.fullBoost)
  for (const command of ['lights', 'overdrive'] as const) {
    const binding = parsed[command]
    controls[command] = typeof binding === 'string' && binding && !used.has(binding)
      ? binding
      : findAvailableBinding(used, [DEFAULT_CONTROL_BINDINGS[command], 'KeyU', 'KeyY', 'KeyB'])
    used.add(controls[command])
  }
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
    ? Math.max(MOUSE_SENSITIVITY_RANGE.min, Math.min(MOUSE_SENSITIVITY_RANGE.max, value))
    : DEFAULT_MOUSE_SENSITIVITY
}

export function normalizeStarfieldDensity(value: unknown): StarfieldDensity {
  return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium'
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_CONTROL_BINDINGS } }
    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      language: isGameLanguage(parsed.language) ? parsed.language : DEFAULT_GAME_LANGUAGE,
      graphicsQuality: parsed.graphicsQuality === 'low' || parsed.graphicsQuality === 'high'
        ? parsed.graphicsQuality
        : 'standard',
      renderScale: RENDER_SCALES.find(scale => scale === parsed.renderScale) ?? null,
      bloom: parsed.bloom !== false,
      engineParticles: parsed.engineParticles !== false,
      speedEffects: parsed.speedEffects !== false,
      planetAtmospheres: parsed.planetAtmospheres !== false,
      hangarShadows: parsed.hangarShadows !== false,
      starfieldDensity: normalizeStarfieldDensity(parsed.starfieldDensity),
      damageVignette: parsed.damageVignette !== false,
      showFps: parsed.showFps === true,
      controls: loadControlBindings(parsed.controls),
      mouseSensitivity: loadMouseSensitivity(parsed.mouseSensitivity),
      mainVolume: loadVolume(parsed.mainVolume, DEFAULT_GAME_SETTINGS.mainVolume),
      shotsVolume: loadVolume(parsed.shotsVolume, DEFAULT_GAME_SETTINGS.shotsVolume),
      musicVolume: loadVolume(parsed.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume),
      shipLights: parsed.shipLights === true,
    }
  } catch {
    return { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_CONTROL_BINDINGS } }
  }
}

export function saveGameSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
