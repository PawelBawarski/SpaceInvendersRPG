import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS, getDamageResistance, MAX_DAMAGE_RESISTANCE, type ResistanceProfile } from '../domain/damageTypes'
import './ShipResistanceReadout.css'

interface ShipResistanceReadoutProps {
  resistances: ResistanceProfile
  language: 'pl' | 'en'
  collapsible?: boolean
}

export function ShipResistanceReadout({ resistances, language, collapsible = true }: ShipResistanceReadoutProps) {
  const title = language === 'pl' ? 'Odporności statku' : 'Ship resistances'
  const summary = DAMAGE_TYPES.map(type => `${DAMAGE_TYPE_LABELS[type][language]}: ${Math.round(getDamageResistance(type, resistances) * 100)}%`).join(' · ')
  const values = <dl className="ship-resistance-values">
    {DAMAGE_TYPES.map(type => {
      const value = getDamageResistance(type, resistances)
      return <div key={type} className={`ship-resistance-value resistance-${type}`}>
        <dt>{DAMAGE_TYPE_LABELS[type][language]}</dt><dd>{Math.round(value * 100)}%</dd>
        <span className="ship-resistance-bar" aria-hidden="true"><i style={{ width: `${value / MAX_DAMAGE_RESISTANCE * 100}%` }} /></span>
      </div>
    })}
  </dl>

  return collapsible
    ? <details className="ship-resistance-readout"><summary title={summary}><span>{title}</span><small>{language === 'pl' ? '4 typy' : '4 types'}</small></summary>{values}</details>
    : <section className="ship-resistance-readout" aria-label={title}><strong className="ship-resistance-title">{title}</strong>{values}</section>
}
