import { gameText, type GameLanguage } from '../i18n'
import type { DamageBearing, DamageSource } from '../domain/damageFeedback'
import './DamageDirectionIndicator.css'

export interface DamageFeedback extends DamageBearing { id: number; createdAt: number; source: DamageSource }

export function DamageDirectionIndicator({ hits, language }: { hits: readonly DamageFeedback[]; language: GameLanguage }) {
  const last = hits.at(-1)
  if (!last) return null
  const labels = gameText(language).damageDirection.labels
  return <div className="damage-direction-feedback" aria-label={gameText(language).damageDirection.incomingDamageDirection}>
    {hits.map(hit => <svg key={hit.id} viewBox="0 0 200 200" className={`damage-bearing source-${hit.source.kind}`} data-side={hit.side}
      style={{ transform: `rotate(${hit.angle}rad)` }} aria-hidden="true">
      <path d="M48 35 A84 84 0 0 1 152 35" /><path className="damage-bearing-arrow" d="m92 17 8-8 8 8" />
    </svg>)}
    <p key={last.id} className="damage-source-label" role="status"><strong>{labels[last.side]}</strong><span>{last.source.label[language]}</span></p>
  </div>
}
