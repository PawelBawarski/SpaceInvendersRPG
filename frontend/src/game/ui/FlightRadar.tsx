import type { RadarBlip } from '../domain/flightRadar'
import type { SectorPosition } from '../domain/exploration'

export function FlightRadar({ language, galaxy, position, radius, blips, lights, lightsKey, overdriveKey, overdriveRemaining, onLights, onOverdrive }: {
  language: 'pl' | 'en'
  galaxy: string
  position: SectorPosition
  radius: number
  blips: readonly RadarBlip[]
  lights: boolean
  lightsKey: string
  overdriveKey?: string
  overdriveRemaining: number
  onLights: () => void
  onOverdrive: () => void
}) {
  const pl = language === 'pl'
  const ahead = blips.filter(blip => blip.ahead && (blip.kind === 'boss' || blip.kind === 'hostile')).length
  const km = (value: number) => (value / 1000).toLocaleString(language, { maximumFractionDigits: 1 })
  return <aside className="flight-radar" aria-label={pl ? 'Radar taktyczny' : 'Tactical radar'}>
    <header><strong>Radar</strong><span>{galaxy}</span></header>
    <svg className="flight-radar-map" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M16 24A43 43 0 0 1 84 24L50 50Z" className="radar-forward" />
      {[15, 30, 44].map(radius => <circle key={radius} cx="50" cy="50" r={radius} className="radar-grid"/>)}
      <path d="M6 50H94M50 6V94" className="radar-grid" />
      {blips.map(blip => blip.kind === 'boss' || blip.kind === 'station'
        ? <rect key={blip.id} x={blip.x - 1.65} y={blip.y - 1.65} width="3.3" height="3.3"
          transform={`rotate(45 ${blip.x} ${blip.y})`} className={`radar-${blip.kind}`} />
        : <circle key={blip.id} cx={blip.x} cy={blip.y} r="1.7" className={`radar-${blip.kind}`} />)}
      <path d="M50 46L47 53L50 51L53 53Z" className="radar-player" />
    </svg>
    <p className={ahead ? 'radar-contact-warning' : 'radar-clear'}>{ahead
      ? (pl ? `Wrogowie z przodu · ${ahead}` : `Hostiles ahead · ${ahead}`)
      : (pl ? 'Przód czysty' : 'Ahead clear')}</p>
    <small>X {km(position.x)} · Y {km(position.y)} · Z {km(position.z)} km</small>
    <small>{pl ? 'Zasięg' : 'Range'} {km(radius)} km</small>
    <div className="radar-actions">
      <button type="button" onClick={onLights} aria-pressed={lights} title={pl ? 'Reflektory statku' : 'Ship headlights'}>
        {pl ? 'Światła' : 'Lights'} <kbd>{lightsKey}</kbd>
      </button>
      {overdriveKey && <button type="button" aria-label={pl ? 'Przeciążenie napędu' : 'Drive overcharge'}
        onClick={onOverdrive} disabled={overdriveRemaining > 0}>
        {overdriveRemaining > 0 ? `${Math.ceil(overdriveRemaining)} s` : (pl ? 'Przeciąż' : 'Overcharge')} <kbd>{overdriveKey}</kbd>
      </button>}
    </div>
  </aside>
}
