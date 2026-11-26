import { gameText, type GameLanguage } from '../i18n'
import { DODGE_TIMING } from '../domain/combat'
import '../../styles/ui/ShipStatusHud.scss'

export interface ShipStatusHudProps {
  language: GameLanguage
  shield: number
  maxShield: number
  hull: number
  maxHull: number
  dodgeRemaining?: number
  dodgeDuration?: number
}

interface StatusBarProps {
  kind: 'shield' | 'hull' | 'dodge'
  label: string
  current: number
  maximum: number
  displayValue?: string
  ready?: boolean
}

function StatusBar({ kind, label, current, maximum, displayValue, ready }: StatusBarProps) {
  const safeMaximum = Math.max(1, maximum)
  const value = Math.max(0, Math.min(safeMaximum, current))
  const percent = value / safeMaximum * 100
  const critical = kind === 'hull' && percent <= 25
  const valueText = displayValue ?? `${Math.ceil(value)} / ${Math.ceil(safeMaximum)}`

  return (
    <div className={`ship-status-meter ship-status-${kind}${critical ? ' is-critical' : ''}${ready ? ' is-ready' : ''}`}>
      <div className="ship-status-label">
        <span>{kind === 'hull' ? <>HP <small>/ {label}</small></> : label}</span>
        <strong>{valueText}</strong>
      </div>
      <div
        className="ship-status-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMaximum}
        aria-valuenow={Number(value.toFixed(1))}
        aria-valuetext={valueText}
      >
        <span className="ship-status-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function ShipStatusHud({
  language,
  shield,
  maxShield,
  hull,
  maxHull,
  dodgeRemaining,
  dodgeDuration = DODGE_TIMING.cooldown,
}: ShipStatusHudProps) {
  const remaining = Math.max(0, dodgeRemaining ?? 0)
  const recharge = 1 - Math.min(1, remaining / Math.max(0.001, dodgeDuration))

  return (
    <aside className="ship-status-hud" aria-label={gameText(language).shipStatus.shipStatus}>
      <StatusBar kind="shield" label={gameText(language).shipStatus.shields} current={shield} maximum={maxShield} />
      <StatusBar kind="hull" label={gameText(language).shipStatus.hull} current={hull} maximum={maxHull} />
      {dodgeRemaining !== undefined && (
        <StatusBar
          kind="dodge"
          label={gameText(language).shipStatus.dodge}
          current={recharge * 100}
          maximum={100}
          displayValue={remaining > 0 ? `${remaining.toFixed(1)} s` : gameText(language).shipStatus.ready}
          ready={remaining === 0}
        />
      )}
    </aside>
  )
}
