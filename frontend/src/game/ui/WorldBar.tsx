import { clamp } from '../renderer/format'

/** Horizontal progress meter used across the flight HUD. */
export function WorldBar({ label, value, maximum, shield = false }: { label: string; value: number; maximum: number; shield?: boolean }) {
  return <div className={`world-meter${shield ? ' is-shield' : ''}`} role="progressbar" aria-label={label}
    aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={Math.max(0, Math.round(value))}>
    <i style={{ width: `${clamp(value / Math.max(1, maximum) * 100, 0, 100)}%` }} />
  </div>
}