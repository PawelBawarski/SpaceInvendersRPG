import { DODGE_TIMING } from '../domain/combat'
import './ShipStatusHud.css'

export interface ShipStatusHudProps {
  language: 'pl' | 'en'
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
  const polish = language === 'pl'
  const remaining = Math.max(0, dodgeRemaining ?? 0)
  const recharge = 1 - Math.min(1, remaining / Math.max(0.001, dodgeDuration))

  return (
    <aside className="ship-status-hud" aria-label={polish ? 'Stan statku' : 'Ship status'}>
      <StatusBar kind="shield" label={polish ? 'Osłony' : 'Shields'} current={shield} maximum={maxShield} />
      <StatusBar kind="hull" label={polish ? 'Kadłub' : 'Hull'} current={hull} maximum={maxHull} />
      {dodgeRemaining !== undefined && (
        <StatusBar
          kind="dodge"
          label={polish ? 'Unik' : 'Dodge'}
          current={recharge * 100}
          maximum={100}
          displayValue={remaining > 0 ? `${remaining.toFixed(1)} s` : polish ? 'Gotowy' : 'Ready'}
          ready={remaining === 0}
        />
      )}
    </aside>
  )
}
