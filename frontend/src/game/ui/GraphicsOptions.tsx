import { gameText } from '../i18n'
import { RENDER_SCALES, type GameSettings } from '../progress/gameSettings'

export function GraphicsOptions({ settings, onChange, compact = false }: {
  settings: GameSettings
  onChange: (change: Partial<GameSettings>) => void
  compact?: boolean
}) {
  const row = compact ? 'game-setting-row graphics-option' : 'setting-row graphics-option'
  const toggles = [
    ['bloom', gameText(settings.language).graphics.bloom],
    ['engineParticles', gameText(settings.language).graphics.engineParticles],
    ['speedEffects', gameText(settings.language).graphics.speedStreaksAndFieldOfView],
    ['planetAtmospheres', gameText(settings.language).graphics.planetAtmospheres],
    ['hangarShadows', gameText(settings.language).graphics.hangarShadows],
  ] as const

  return <fieldset className="graphics-options">
    <legend>{gameText(settings.language).graphics.graphicsPerformance}</legend>
    <label className={row}>
      <span>{gameText(settings.language).graphics.renderScale}</span>
      <select value={settings.renderScale ?? ''} onChange={event => {
        const scale = Number(event.currentTarget.value)
        onChange({ renderScale: RENDER_SCALES.find(option => option === scale) ?? null })
      }}>
        <option value="">{gameText(settings.language).graphics.fromPreset}</option>
        {RENDER_SCALES.map(scale => <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>)}
      </select>
    </label>
    {toggles.map(([key, label]) => <label className={row} key={key}>
      <span>{label}</span>
      <input type="checkbox" checked={settings[key]} onChange={event => onChange({ [key]: event.currentTarget.checked })}/>
    </label>)}
  </fieldset>
}
