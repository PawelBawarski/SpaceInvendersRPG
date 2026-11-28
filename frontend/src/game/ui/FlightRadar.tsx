import { formatNumber, formatText, gameText, type GameLanguage } from '../i18n'
import type { RadarBlip } from '../domain/flightRadar'
import type { SectorPosition } from '../domain/exploration'
import { IconButton } from './ActionIcon'

export function FlightRadar({ language, galaxy, position, radius, blips, zoneLevel, hasOverdrive, overdriveRemaining, onOverdrive }: {
  language: GameLanguage
  galaxy: string
  position: SectorPosition
  radius: number
  blips: readonly RadarBlip[]
  zoneLevel: number
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
    <small className="radar-danger-zone">{formatText(text.dangerZone, { level: zoneLevel })}</small>
    <svg className="flight-radar-map is-3d" viewBox="0 0 100 100" aria-hidden="true" style={{ transform: 'perspective(240px) rotateX(16deg)' }}>
      <path d="M6 50A44 44 0 0 1 94 50Z" className="radar-forward" />
      {[15, 30, 44].map(radius => <circle key={radius} cx="50" cy="50" r={radius} className="radar-grid"/>)}
      <path d="M6 50H94M50 6V94" className="radar-grid" />
      <ellipse cx="50" cy="50" rx="44" ry="10" className="radar-horizon" />
      {visible.map(blip => {
        const cy = blip.y - blip.elev * 7
        const scale = 1 + blip.elev * 0.25
        return blip.kind === 'boss' || blip.kind === 'station' || blip.kind === 'megastation'
          ? <rect key={blip.id} x={blip.x - (blip.kind === 'megastation' ? 2.4 : 1.65) * scale} y={cy - (blip.kind === 'megastation' ? 2.4 : 1.65) * scale}
            width={(blip.kind === 'megastation' ? 4.8 : 3.3) * scale} height={(blip.kind === 'megastation' ? 4.8 : 3.3) * scale}
            transform={`rotate(45 ${blip.x} ${cy})`} className={`radar-${blip.kind}`} />
          : <circle key={blip.id} cx={blip.x} cy={cy} r={(blip.kind === 'planet' ? 2.2 : 1.7) * scale} className={`radar-${blip.kind}`} />;
      })}
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
