import { gameText } from '../i18n'
import { MOUSE_SENSITIVITY_RANGE } from '../input/InputController'
import type { GameSettings } from '../progress/gameSettings'

const PERCENT_SCALE = 100
const VOLUME_FIELDS = { mainVolume: 'main-volume', shotsVolume: 'shots-volume', musicVolume: 'music-volume' } as const
type VolumeField = keyof typeof VOLUME_FIELDS

interface SliderSettingsProps {
  settings: GameSettings
  onChange: (change: Partial<GameSettings>) => void
  compact?: boolean
}

export function VolumeSettings({ settings, onChange, compact = false }: SliderSettingsProps) {
  const text = gameText(settings.language).application.ui
  return (Object.keys(VOLUME_FIELDS) as VolumeField[]).map(field => {
    const id = compact ? 'pause-' + field : VOLUME_FIELDS[field]
    const percent = Math.round(settings[field] * PERCENT_SCALE)
    return <label className={compact ? 'game-setting-row' : 'volume-row'} htmlFor={id} key={field}>
      <span>{text[field]}</span>
      <input id={id} type="range" min={0} max={PERCENT_SCALE} value={percent}
        onChange={event => onChange({ [field]: Number(event.currentTarget.value) / PERCENT_SCALE })} />
      <output htmlFor={id}>{percent}%</output>
    </label>
  })
}

export function MouseSensitivitySetting({ settings, onChange, compact = false }: SliderSettingsProps) {
  const id = compact ? 'pause-mouse-sensitivity' : 'mouse-sensitivity'
  return <label className={compact ? 'game-setting-row' : 'volume-row'} htmlFor={id}>
    <span>{gameText(settings.language).application.ui.mouseSensitivity}</span>
    <input id={id} type="range" {...MOUSE_SENSITIVITY_RANGE} value={settings.mouseSensitivity}
      onChange={event => onChange({ mouseSensitivity: Number(event.currentTarget.value) })} />
    <output htmlFor={id}>{settings.mouseSensitivity.toFixed(1)}×</output>
  </label>
}
