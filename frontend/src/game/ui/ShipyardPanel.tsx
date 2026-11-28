import type { GameLanguage } from '../i18n'
import { canPurchaseShip, SHIP_TIERS } from '../domain/shipTiers'
import { getPilotLevel, type MissionProgress } from '../progress/missionProgress'
import { IconButton } from './ActionIcon'
import '../../styles/ui/ShipyardPanel.scss'

interface ShipyardPanelProps {
  language: GameLanguage
  progress: MissionProgress
  onBuy: (id: string) => void
  onSelect: (id: string) => void
  onClose: () => void
}

export function ShipyardPanel({ language, progress, onBuy, onSelect, onClose }: ShipyardPanelProps) {
  const level = getPilotLevel(progress.experience)
  const pl = language === 'pl'
  return (
    <aside className="shipyard-panel" role="dialog" aria-modal="true" aria-label={pl ? 'Stocznia' : 'Shipyard'}>
      <header className="shipyard-header">
        <h2>{pl ? 'Stocznia' : 'Shipyard'}</h2>
        <IconButton icon="close" label={pl ? 'Zamknij' : 'Close'} onClick={onClose} />
      </header>
      <p className="shipyard-sub">{pl ? `Poziom pilota ${level} · Kredyty ${progress.credits}` : `Pilot level ${level} · Credits ${progress.credits}`}</p>
      <ul className="shipyard-list">
        {SHIP_TIERS.map(tier => {
          const owned = progress.ownedShips.includes(tier.id)
          const active = progress.activeShip === tier.id
          const buyable = canPurchaseShip(tier, progress.credits, level, progress.ownedShips)
          return (
            <li key={tier.id} className={`shipyard-tier${active ? ' is-active' : ''}${owned ? ' is-owned' : ''}`} data-tier={tier.tier}>
              <div className="shipyard-tier-head">
                <strong>{tier.name[language]}</strong>
                <span>{pl ? `Tier ${tier.tier}` : `Tier ${tier.tier}`}</span>
              </div>
              <p>{tier.blurb[language]}</p>
              <div className="shipyard-tier-foot">
                <small>{pl ? `Wymagany poziom ${tier.requiredLevel}` : `Requires level ${tier.requiredLevel}`}</small>
                {owned
                  ? (active
                    ? <em>{pl ? 'Aktywny' : 'Active'}</em>
                    : <button type="button" className="primary-action" onClick={() => onSelect(tier.id)}>{pl ? 'Wybierz' : 'Select'}</button>)
                  : <button type="button" className="primary-action" disabled={!buyable} onClick={() => onBuy(tier.id)}>
                      {pl ? `Kup · ${tier.price}` : `Buy · ${tier.price}`}
                    </button>}
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}