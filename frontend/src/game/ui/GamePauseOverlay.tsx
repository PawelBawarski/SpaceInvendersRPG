import { FLIGHT_COMMANDS, type FlightCommand } from '../input/InputController'
import type { GameSettings } from '../progress/gameSettings'
import { GraphicsOptions } from './GraphicsOptions'

interface GamePauseOverlayProps {
  language: 'pl' | 'en'
  mode: 'pause' | 'settings'
  settings: GameSettings
  controlLabels: Record<FlightCommand, string>
  rebindingCommand: FlightCommand | null
  onUpdateSettings: (change: Partial<GameSettings>) => void
  onSetRebindingCommand: (command: FlightCommand | null) => void
  onResume: () => void
  onOpenSettings: () => void
  onBack: () => void
  onExit: () => void
}

function keyLabel(code: string, language: 'pl' | 'en'): string {
  if (code === 'Space') return language === 'pl' ? 'Spacja' : 'Space'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift'
  if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  return code
}

export function GamePauseOverlay({
  language,
  mode,
  settings,
  controlLabels,
  rebindingCommand,
  onUpdateSettings,
  onSetRebindingCommand,
  onResume,
  onOpenSettings,
  onBack,
  onExit,
}: GamePauseOverlayProps) {
  const polish = language === 'pl'
  const title = mode === 'pause'
    ? (polish ? 'PAUZA' : 'PAUSED')
    : (polish ? 'USTAWIENIA LOTU' : 'FLIGHT SETTINGS')
  const backToPause = () => {
    onSetRebindingCommand(null)
    onBack()
  }

  return (
    <div className="game-pause-backdrop">
      {mode === 'pause' ? (
        <section className="game-pause-dialog" role="dialog" aria-modal="true" aria-labelledby="game-pause-title">
          <p className="eyebrow">{polish ? 'NEON VOID / LOT' : 'NEON VOID / FLIGHT'}</p>
          <h1 id="game-pause-title">{title}</h1>
          <div className="game-pause-actions">
            <button type="button" className="primary-action" onClick={onResume}>
              {polish ? 'Wznów' : 'Resume'}
            </button>
            <button type="button" className="menu-action" onClick={onOpenSettings}>
              {polish ? 'Ustawienia' : 'Settings'}
            </button>
            <button type="button" className="menu-action game-pause-exit" onClick={onExit}>
              {polish ? 'Wyjdź' : 'Exit'}
            </button>
          </div>
          <p className="game-pause-hint">{polish ? 'Naciśnij Esc, aby wrócić do lotu.' : 'Press Esc to return to flight.'}</p>
        </section>
      ) : (
        <section className="game-pause-dialog game-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="game-pause-title">
          <header className="game-settings-header">
            <div>
              <p className="eyebrow">{polish ? 'NEON VOID / KONFIGURACJA' : 'NEON VOID / CONFIGURATION'}</p>
              <h1 id="game-pause-title">{title}</h1>
            </div>
            <button
              type="button"
              className="settings-close"
              aria-label={polish ? 'Zamknij ustawienia lotu' : 'Close flight settings'}
              title={polish ? 'Zamknij ustawienia lotu (Esc)' : 'Close flight settings (Esc)'}
              onClick={backToPause}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div
            className="game-settings-controls"
            role="region"
            aria-label={polish ? 'Opcje lotu' : 'Flight options'}
            tabIndex={0}
          >
            <label className="game-setting-row" htmlFor="pause-graphics">
              <span>{polish ? 'Jakość grafiki' : 'Graphics quality'}</span>
              <select
                id="pause-graphics"
                value={settings.graphicsQuality}
                onChange={(event) => {
                  const quality = event.currentTarget.value
                  if (quality === 'low' || quality === 'standard' || quality === 'high') {
                    onUpdateSettings({ graphicsQuality: quality })
                  }
                }}
              >
                <option value="low">{polish ? 'Niska' : 'Low'}</option>
                <option value="standard">{polish ? 'Standardowa' : 'Standard'}</option>
                <option value="high">{polish ? 'Wysoka' : 'High'}</option>
              </select>
            </label>
            <GraphicsOptions settings={settings} onChange={onUpdateSettings} compact />
            {([
              ['mainVolume', polish ? 'Głośność główna' : 'Master volume'],
              ['shotsVolume', polish ? 'Strzały' : 'Weapon sounds'],
              ['musicVolume', polish ? 'Muzyka' : 'Music'],
            ] as const).map(([field, label]) => (
              <label className="game-setting-row" htmlFor={`pause-${field}`} key={field}>
                <span>{label}</span>
                <input
                  id={`pause-${field}`}
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(settings[field] * 100)}
                  onChange={(event) => onUpdateSettings({ [field]: Number(event.currentTarget.value) / 100 })}
                />
                <output htmlFor={`pause-${field}`}>{Math.round(settings[field] * 100)}%</output>
              </label>
            ))}
            <label className="game-setting-row" htmlFor="pause-mouse-sensitivity">
              <span>{polish ? 'Czułość myszy' : 'Mouse sensitivity'}</span>
              <input
                id="pause-mouse-sensitivity"
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={settings.mouseSensitivity}
                onChange={(event) => onUpdateSettings({ mouseSensitivity: Number(event.currentTarget.value) })}
              />
              <output htmlFor="pause-mouse-sensitivity">{settings.mouseSensitivity.toFixed(1)}×</output>
            </label>
            <div className="game-keybindings">
              <strong>{polish ? 'Sterowanie' : 'Controls'}</strong>
              {FLIGHT_COMMANDS.map((command) => (
                <div className="game-keybinding" key={command}>
                  <span>{controlLabels[command]}</span>
                  <button
                    type="button"
                    aria-label={`${polish ? 'Zmień klawisz' : 'Rebind'}: ${controlLabels[command]}`}
                    onClick={() => onSetRebindingCommand(command)}
                  >
                    {rebindingCommand === command
                      ? (polish ? 'Naciśnij klawisz…' : 'Press a key…')
                      : keyLabel(settings.controls[command], language)}
                  </button>
                </div>
              ))}
              {rebindingCommand && (
                <p className="game-rebinding-hint" role="status">
                  {polish ? 'Naciśnij nowy klawisz. Esc anuluje zmianę.' : 'Press a new key. Esc cancels.'}
                </p>
              )}
            </div>
          </div>
          <footer className="game-settings-footer">
            <button type="button" className="primary-action game-settings-back" onClick={backToPause}>
              {polish ? 'Wróć do pauzy' : 'Back to pause'}
            </button>
          </footer>
        </section>
      )}
    </div>
  )
}
