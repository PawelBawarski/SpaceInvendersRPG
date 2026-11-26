import { gameText, type GameLanguage } from '../i18n'
import { useState } from 'react'
import { GALAXIES, HYPERSPACE_SECONDS, type Galaxy, type GalaxyId } from '../domain/galaxyChart'
import { IconButton } from './ActionIcon'
import '../../styles/ui/SpaceDialogs.scss'

export function GalaxyTravel({ language, origin, jumpingTo, onClose, onCancelJump, onJump }: {
  language: GameLanguage
  origin: Galaxy
  jumpingTo: Galaxy | null
  onClose: () => void
  onCancelJump: () => void
  onJump: (destination: GalaxyId) => void
}) {
  const [target, setTarget] = useState<Galaxy | null>(null)

  if (jumpingTo) return <div className="hyperspace-overlay" role="status">
    <div className="hyperspace-readout">
      <IconButton icon="close" className="hyperspace-cancel" onClick={onCancelJump} label={gameText(language).travel.cancelJump} />
      <span>{gameText(language).travel.hyperspaceTransit}</span>
      <strong>{origin.name} <span aria-hidden="true">→</span> {jumpingTo.name}</strong>
      <i className="hyperspace-progress" aria-hidden="true" style={{ animationDuration: `${HYPERSPACE_SECONDS}s` }} />
    </div>
  </div>

  return <div className="space-dialog-backdrop">
    <section className="space-dialog galaxy-dialog" role="dialog" aria-modal="true" aria-labelledby="galaxy-travel-title">
      <header className="space-dialog-header">
        <div><span>{gameText(language).travel.hyperspaceNavigation}</span><h2 id="galaxy-travel-title">{gameText(language).travel.galaxyChart}</h2></div>
        <IconButton icon="close" className="journal-close" onClick={onClose} autoFocus label={gameText(language).travel.closeGalaxyChart} />
      </header>
      <div className="galaxy-route-chart" role="group" aria-label={gameText(language).travel.availableJumpDestinations}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {GALAXIES.filter(galaxy => galaxy.id !== origin.id).map(galaxy => <line key={galaxy.id}
            x1={origin.x} y1={origin.y} x2={galaxy.x} y2={galaxy.y} className={target?.id === galaxy.id ? 'selected' : undefined}/>)}
        </svg>
        {GALAXIES.map(galaxy => <button type="button" key={galaxy.id}
          style={{ left: `${galaxy.x}%`, top: `${galaxy.y}%`, color: galaxy.color }}
          className="galaxy-chart-node" aria-pressed={galaxy.id === target?.id} disabled={galaxy.id === origin.id}
          onClick={() => setTarget(galaxy)}>
          <i aria-hidden="true"/><strong>{galaxy.name}</strong>
          {galaxy.id === origin.id && <small>{gameText(language).travel.current}</small>}
        </button>)}
      </div>
      <footer className="space-dialog-footer">
        <span>{target ? `${origin.name} → ${target.name}` : gameText(language).travel.selectADestination}</span>
        <button type="button" className="space-dialog-action" disabled={!target} onClick={() => target && onJump(target.id)}>
          {gameText(language).travel.makeTheJump}
        </button>
      </footer>
    </section>
  </div>
}
