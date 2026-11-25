import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_GAME_SETTINGS, loadGameSettings, saveGameSettings } from './gameSettings'

beforeEach(() => {
  localStorage.clear()
})

describe('game settings', () => {
  it('reserves L for the journal while retaining other custom controls', () => {
    saveGameSettings({ ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_GAME_SETTINGS.controls, fire: 'KeyL', dodge: 'KeyB' } })
    const controls = loadGameSettings().controls
    expect(Object.values(controls)).not.toContain('KeyL')
    expect(controls.fire).toBe('KeyF')
    expect(controls.dodge).toBe('KeyB')
    expect(new Set(Object.values(controls)).size).toBe(Object.values(controls).length)
  })
  it('uses the default language, graphics, controls, and audio levels for a new profile', () => {
    expect(loadGameSettings()).toEqual(DEFAULT_GAME_SETTINGS)
  })

  it('persists preferences independently of campaign progress', () => {
    const settings = {
      ...DEFAULT_GAME_SETTINGS,
      language: 'en' as const,
      graphicsQuality: 'high' as const,
      renderScale: 0.67 as const,
      bloom: false,
      engineParticles: false,
      controls: { ...DEFAULT_GAME_SETTINGS.controls, fire: 'KeyJ' },
      mouseSensitivity: 2.2,
      mainVolume: 0.6,
      shotsVolume: 0.4,
      musicVolume: 0.2,
    }
    saveGameSettings(settings)

    expect(loadGameSettings()).toEqual({
      ...DEFAULT_GAME_SETTINGS,
      language: 'en',
      graphicsQuality: 'high',
      renderScale: 0.67,
      bloom: false,
      engineParticles: false,
      controls: { ...DEFAULT_GAME_SETTINGS.controls, fire: 'KeyJ' },
      mouseSensitivity: 2.2,
      mainVolume: 0.6,
      shotsVolume: 0.4,
      musicVolume: 0.2,
    })
  })

  it('falls back safely from invalid stored settings', () => {
    localStorage.setItem(
      'neon-void:settings:v1',
      JSON.stringify({
        language: 'fr',
        graphicsQuality: 'ultra',
        controls: { fire: 'KeyJ', dodge: 'KeyJ' },
        mainVolume: 1.5,
        shotsVolume: -0.5,
        musicVolume: 'loud',
      }),
    )
    expect(loadGameSettings()).toEqual({
      ...DEFAULT_GAME_SETTINGS,
      mainVolume: 1,
      shotsVolume: 0,
    })
  })

  it('loads previous settings without control or audio fields', () => {
    localStorage.setItem(
      'neon-void:settings:v1',
      '{"language":"en","graphicsQuality":"high"}',
    )

    expect(loadGameSettings()).toEqual({
      ...DEFAULT_GAME_SETTINGS,
      language: 'en',
      graphicsQuality: 'high',
    })
  })

  it('migrates the old Space firing key to full thrust without resetting custom steering', () => {
    const legacy = Object.fromEntries(Object.entries(DEFAULT_GAME_SETTINGS.controls).filter(([command]) => command !== 'fullBoost'))
    localStorage.setItem('neon-void:settings:v1', JSON.stringify({
      controls: { ...legacy, fire: 'Space', pitchUp: 'ArrowUp' },
    }))
    expect(loadGameSettings().controls).toMatchObject({ fire: 'KeyF', fullBoost: 'Space', pitchUp: 'ArrowUp' })
  })

  it('preserves a custom firing binding when adding full thrust to an older profile', () => {
    const legacy = Object.fromEntries(Object.entries(DEFAULT_GAME_SETTINGS.controls).filter(([command]) => command !== 'fullBoost'))
    localStorage.setItem('neon-void:settings:v1', JSON.stringify({ controls: { ...legacy, fire: 'KeyJ' } }))
    expect(loadGameSettings().controls).toMatchObject({ fire: 'KeyJ', fullBoost: 'Space' })
  })

  it('resolves migration conflicts using free keys while retaining custom actions', () => {
    const legacy = Object.fromEntries(Object.entries(DEFAULT_GAME_SETTINGS.controls).filter(([command]) => command !== 'fullBoost'))
    localStorage.setItem('neon-void:settings:v1', JSON.stringify({
      controls: { ...legacy, fire: 'Space', pitchUp: 'KeyF' },
    }))
    expect(loadGameSettings().controls).toMatchObject({ fire: 'KeyJ', fullBoost: 'Space', pitchUp: 'KeyF' })

    localStorage.setItem('neon-void:settings:v1', JSON.stringify({
      controls: { ...legacy, fire: 'KeyJ', dodge: 'Space' },
    }))
    const controls = loadGameSettings().controls
    expect(controls).toMatchObject({ fire: 'KeyJ', fullBoost: 'KeyT', dodge: 'Space' })
    expect(new Set(Object.values(controls)).size).toBe(Object.keys(controls).length)
  })

  it('repairs a duplicate full-thrust binding without replacing a valid existing binding', () => {
    localStorage.setItem('neon-void:settings:v1', JSON.stringify({
      controls: { ...DEFAULT_GAME_SETTINGS.controls, fullBoost: 'ShiftLeft', fire: 'KeyJ' },
    }))
    expect(loadGameSettings().controls).toMatchObject({ boost: 'ShiftLeft', fullBoost: 'Space', fire: 'KeyJ' })
  })

  it('migrates the former Q/E roll defaults and restores mouse sensitivity', () => {
    localStorage.setItem('neon-void:settings:v1', JSON.stringify({
      controls: {
        ...DEFAULT_GAME_SETTINGS.controls,
        rollLeft: 'KeyE',
        rollRight: 'KeyQ',
      },
      mouseSensitivity: 2.4,
    }))

    expect(loadGameSettings()).toMatchObject({
      controls: DEFAULT_GAME_SETTINGS.controls,
      mouseSensitivity: 2.4,
    })
  })

  it('clamps invalid mouse sensitivity and uses the faster default when absent', () => {
    localStorage.setItem('neon-void:settings:v1', '{"mouseSensitivity":8}')
    expect(loadGameSettings().mouseSensitivity).toBe(3)

    localStorage.setItem('neon-void:settings:v1', '{"language":"en"}')
    expect(loadGameSettings().mouseSensitivity).toBe(DEFAULT_GAME_SETTINGS.mouseSensitivity)
  })
})
