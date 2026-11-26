import { formatControlKey, gameText, type GameLanguage } from '../i18n'
import { FLIGHT_COMMANDS, type FlightCommand } from '../input/InputController'
import type { GameSettings } from '../progress/gameSettings'
import { GraphicsOptions } from './GraphicsOptions'
import { LanguageSetting } from './LanguageSetting'
import { MouseSensitivitySetting, VolumeSettings } from './SettingsSliders'
import { IconButton } from './ActionIcon'
import { FixedControls } from './FixedControls'

interface GamePauseOverlayProps {
  language: GameLanguage
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
  const title = mode === 'pause'
    ? (gameText(language).pause.paused)
    : (gameText(language).pause.flightSettings)
  const backToPause = () => {
    onSetRebindingCommand(null)
    onBack()
  }

  return (
    <div className="game-pause-backdrop">
      {mode === 'pause' ? (
        <section className="game-pause-dialog" role="dialog" aria-modal="true" aria-labelledby="game-pause-title">
          <p className="eyebrow">{gameText(language).pause.neonVoidFlight}</p>
          <h1 id="game-pause-title">{title}</h1>
          <div className="game-pause-actions">
            <button type="button" className="primary-action" onClick={onResume}>
              {gameText(language).pause.resume}
            </button>
            <button type="button" className="menu-action" onClick={onOpenSettings}>
              {gameText(language).pause.settings}
            </button>
            <button type="button" className="menu-action game-pause-exit" onClick={onExit}>
              {gameText(language).pause.exit}
            </button>
          </div>
        </section>
      ) : (
        <section className="game-pause-dialog game-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="game-pause-title">
          <header className="game-settings-header">
            <div>
              <p className="eyebrow">{gameText(language).pause.neonVoidConfiguration}</p>
              <h1 id="game-pause-title">{title}</h1>
            </div>
            <IconButton icon="close" className="settings-close" label={gameText(language).pause.closeFlightSettings} onClick={backToPause} />
          </header>
          <div
            className="game-settings-controls"
            role="region"
            aria-label={gameText(language).pause.flightOptions}
            tabIndex={0}
          >
            <LanguageSetting language={language} className="game-setting-row" onChange={selected => onUpdateSettings({ language: selected })} />
            <label className="game-setting-row" htmlFor="pause-graphics">
              <span>{gameText(language).pause.graphicsQuality}</span>
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
                <option value="low">{gameText(language).pause.low}</option>
                <option value="standard">{gameText(language).pause.standard}</option>
                <option value="high">{gameText(language).pause.high}</option>
              </select>
            </label>
            <GraphicsOptions settings={settings} onChange={onUpdateSettings} compact />
            <VolumeSettings settings={settings} onChange={onUpdateSettings} compact />
            <MouseSensitivitySetting settings={settings} onChange={onUpdateSettings} compact />
            <div className="game-keybindings">
              <strong>{gameText(language).pause.controls}</strong>
              <FixedControls language={language} />
              {FLIGHT_COMMANDS.map((command) => (
                <div className="game-keybinding" key={command}>
                  <span>{controlLabels[command]}</span>
                  <button
                    type="button"
                    aria-label={`${gameText(language).pause.rebind}: ${controlLabels[command]}`}
                    onClick={() => onSetRebindingCommand(command)}
                  >
                    {rebindingCommand === command
                      ? (gameText(language).pause.pressAKey)
                      : formatControlKey(settings.controls[command], language)}
                  </button>
                </div>
              ))}
              {rebindingCommand && (
                <p className="game-rebinding-hint" role="status">
                  {gameText(language).pause.pressANewKeyEscCancels}
                </p>
              )}
            </div>
          </div>
          <footer className="game-settings-footer">
            <button type="button" className="primary-action game-settings-back" onClick={backToPause}>
              {gameText(language).pause.backToPause}
            </button>
          </footer>
        </section>
      )}
    </div>
  )
}
