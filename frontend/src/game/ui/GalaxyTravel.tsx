import { useState } from 'react'
import { GALAXIES, HYPERSPACE_SECONDS, type Galaxy, type GalaxyId } from '../domain/galaxyChart'
import './SpaceDialogs.css'

export function GalaxyTravel({ language, origin, jumpingTo, onClose, onJump }: {
  language: 'pl' | 'en'
  origin: Galaxy
  jumpingTo: Galaxy | null
  onClose: () => void
  onJump: (destination: GalaxyId) => void
}) {
  const pl = language === 'pl'
  const [target, setTarget] = useState<Galaxy | null>(null)

  if (jumpingTo) return <div className="hyperspace-overlay" role="status">
    <div className="hyperspace-readout">
      <span>{pl ? 'Przelot nadprzestrzenny' : 'Hyperspace transit'}</span>
      <strong>{origin.name} <span aria-hidden="true">→</span> {jumpingTo.name}</strong>
      <i className="hyperspace-progress" aria-hidden="true" style={{ animationDuration: `${HYPERSPACE_SECONDS}s` }} />
    </div>
  </div>

  return <div className="space-dialog-backdrop">
    <section className="space-dialog galaxy-dialog" role="dialog" aria-modal="true" aria-labelledby="galaxy-travel-title">
      <header className="space-dialog-header">
        <div><span>{pl ? 'Nawigacja nadprzestrzenna' : 'Hyperspace navigation'}</span><h2 id="galaxy-travel-title">{pl ? 'Mapa galaktyk' : 'Galaxy chart'}</h2></div>
        <button type="button" className="journal-close" onClick={onClose} autoFocus aria-label={pl ? 'Zamknij mapę galaktyk' : 'Close galaxy chart'}>×</button>
      </header>
      <div className="galaxy-route-chart" role="group" aria-label={pl ? 'Galaktyki dostępne do skoku' : 'Available jump destinations'}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {GALAXIES.filter(galaxy => galaxy.id !== origin.id).map(galaxy => <line key={galaxy.id}
            x1={origin.x} y1={origin.y} x2={galaxy.x} y2={galaxy.y} className={target?.id === galaxy.id ? 'selected' : undefined}/>)}
        </svg>
        {GALAXIES.map(galaxy => <button type="button" key={galaxy.id}
          style={{ left: `${galaxy.x}%`, top: `${galaxy.y}%`, color: galaxy.color }}
          className="galaxy-chart-node" aria-pressed={galaxy.id === target?.id} disabled={galaxy.id === origin.id}
          onClick={() => setTarget(galaxy)}>
          <i aria-hidden="true"/><strong>{galaxy.name}</strong>
          {galaxy.id === origin.id && <small>{pl ? 'Obecna' : 'Current'}</small>}
        </button>)}
      </div>
      <footer className="space-dialog-footer">
        <span>{target ? `${origin.name} → ${target.name}` : pl ? 'Wybierz galaktykę docelową.' : 'Select a destination.'}</span>
        <button type="button" className="space-dialog-action" disabled={!target} onClick={() => target && onJump(target.id)}>
          {pl ? 'Wykonaj skok' : 'Make the jump'}
        </button>
      </footer>
    </section>
  </div>
}
