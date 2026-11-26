import { formatNumber, formatText, gameText, type GameLanguage } from '../i18n'
import type { RadarBlip } from '../domain/flightRadar'
import type { SectorPosition } from '../domain/exploration'
import { IconButton } from './ActionIcon'

export function FlightRadar({ language, galaxy, position, radius, blips, hasOverdrive, overdriveRemaining, onOverdrive }: {
  language: GameLanguage
  galaxy: string
  position: SectorPosition
  radius: number
  blips: readonly RadarBlip[]
  hasOverdrive: boolean
  overdriveRemaining: number
  onOverdrive: () => void
}) {
  const ahead = blips.filter(blip => blip.ahead && (blip.kind === 'boss' || blip.kind === 'hostile')).length
  const visible = [...blips.filter(blip => blip.kind !== 'hostile'), ...blips.filter(blip => blip.kind === 'hostile').slice(0, 24)]
  const km = (value: number) => formatNumber(value / 1000, language, 1)
  const text = gameText(language).radar
  return <aside className="flight-radar" aria-label={gameText(language).radar.tacticalRadar}>
    <header><strong>{gameText(language).radar.heading}</strong><span>{galaxy}</span></header>
    <svg className="flight-radar-map" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M6 50A44 44 0 0 1 94 50Z" className="radar-forward" />
      {[15, 30, 44].map(radius => <circle key={radius} cx="50" cy="50" r={radius} className="radar-grid"/>)}
      <path d="M6 50H94M50 6V94" className="radar-grid" />
      {visible.map(blip => blip.kind === 'boss' || blip.kind === 'station'
        ? <rect key={blip.id} x={blip.x - 1.65} y={blip.y - 1.65} width="3.3" height="3.3"
          transform={`rotate(45 ${blip.x} ${blip.y})`} className={`radar-${blip.kind}`} />
        : <circle key={blip.id} cx={blip.x} cy={blip.y} r="1.7" className={`radar-${blip.kind}`} />)}
      <path d="M50 46L47 53L50 51L53 53Z" className="radar-player" />
    </svg>
    <p className={ahead ? 'radar-contact-warning' : 'radar-clear'}>{ahead
      ? (formatText(gameText(language).radar.hostilesAhead, { ahead }))
      : (gameText(language).radar.aheadClear)}</p>
    <small>X {km(position.x)} · Y {km(position.y)} · Z {km(position.z)} km</small>
    <small>{gameText(language).radar.range} {km(radius)} km</small>
    {hasOverdrive && <div className="radar-actions">
      <IconButton icon="overdrive" label={text.driveOvercharge}
        tooltip={overdriveRemaining > 0 ? `${text.driveOvercharge} · ${Math.ceil(overdriveRemaining)} s` : text.driveOvercharge}
        onClick={onOverdrive} disabled={overdriveRemaining > 0} />
    </div>}
  </aside>
}
