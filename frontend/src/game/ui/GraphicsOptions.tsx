import { RENDER_SCALES, type GameSettings } from '../progress/gameSettings'

export function GraphicsOptions({ settings, onChange, compact = false }: {
  settings: GameSettings
  onChange: (change: Partial<GameSettings>) => void
  compact?: boolean
}) {
  const pl = settings.language === 'pl'
  const row = compact ? 'game-setting-row graphics-option' : 'setting-row graphics-option'
  const toggles = [
    ['bloom', pl ? 'Poświata światła' : 'Bloom'],
    ['engineParticles', pl ? 'Cząsteczki silników' : 'Engine particles'],
    ['speedEffects', pl ? 'Smugi i zmiana pola widzenia' : 'Speed streaks and field of view'],
    ['planetAtmospheres', pl ? 'Poświata planet' : 'Planet atmospheres'],
    ['hangarShadows', pl ? 'Cienie w hangarze' : 'Hangar shadows'],
  ] as const

  return <fieldset className="graphics-options">
    <legend>{pl ? 'Wydajność grafiki' : 'Graphics performance'}</legend>
    <label className={row}>
      <span>{pl ? 'Skala renderowania' : 'Render scale'}</span>
      <select value={settings.renderScale ?? ''} onChange={event => {
        const scale = Number(event.currentTarget.value)
        onChange({ renderScale: RENDER_SCALES.find(option => option === scale) ?? null })
      }}>
        <option value="">{pl ? 'Według jakości' : 'From preset'}</option>
        {RENDER_SCALES.map(scale => <option key={scale} value={scale}>{Math.round(scale * 100)}%</option>)}
      </select>
    </label>
    {toggles.map(([key, label]) => <label className={row} key={key}>
      <span>{label}</span>
      <input type="checkbox" checked={settings[key]} onChange={event => onChange({ [key]: event.currentTarget.checked })}/>
    </label>)}
  </fieldset>
}
