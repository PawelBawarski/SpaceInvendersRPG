import { useState } from 'react'
import type { MerchantSite } from '../domain/exploration'
import { MERCHANT_MATERIALS, buyMerchantPart, getMerchantStock, tradeMerchantMaterial } from '../progress/merchantTrade'
import { canStoreShipPart, getBackpackShipParts, sellShipPart, type MissionProgress } from '../progress/missionProgress'
import { getShipPartLevelRequirement, getShipPartSellValue, type ShipPart } from '../progress/shipParts'
import { MaterialArtwork, PartArtwork } from './EquipmentArtwork'
import { getShipPartRarityLabel, getShipPartSlotLabel, getShipPartStatSummary } from './shipPartPresentation'
import './SpaceDialogs.css'

const materials = {
  scrapMetal: { pl: 'Złom', en: 'Scrap metal', icon: 'alloy' },
  copper: { pl: 'Miedź', en: 'Copper', icon: 'copper' },
  radioactiveResidue: { pl: 'Osad radioaktywny', en: 'Radioactive residue', icon: 'radioactive' },
  meridianCore: { pl: 'Rdzeń Meridian', en: 'Meridian core', icon: 'radioactive' },
} as const

export function MerchantPanel({ language, merchant, progress, onClose, onTrade }: {
  language: 'pl' | 'en'
  merchant: MerchantSite
  progress: MissionProgress
  onClose: () => void
  onTrade: (transaction: (current: MissionProgress) => MissionProgress) => void
}) {
  const pl = language === 'pl'
  const [section, setSection] = useState<'buy' | 'sell'>('buy')
  const buying = section === 'buy'
  const format = (credits: number) => `${credits.toLocaleString(language)} KS`
  const tradeLabel = buying ? (pl ? 'Kup' : 'Buy') : (pl ? 'Sprzedaj' : 'Sell')
  const full = !canStoreShipPart(progress)
  const parts = buying
    ? getMerchantStock(progress)
    : getBackpackShipParts(progress).map(part => ({ part, price: getShipPartSellValue(part), sold: false }))
  const partLabel = (part: ShipPart) => getShipPartSlotLabel(language, part.slot)

  return <div className="space-dialog-backdrop">
    <section className="space-dialog merchant-dialog" role="dialog" aria-modal="true" aria-labelledby="merchant-title">
      <header className="space-dialog-header">
        <div><span>{pl ? 'Statek handlowy' : 'Merchant vessel'}</span><h2 id="merchant-title">{merchant.name[language]}</h2></div>
        <output className="merchant-balance" aria-label={pl ? 'Dostępne kredyty' : 'Available credits'}>{format(progress.credits)}</output>
        <button type="button" className="journal-close" onClick={onClose} autoFocus aria-label={pl ? 'Zamknij handel' : 'Close trade'}>×</button>
      </header>
      <nav className="merchant-tabs" aria-label={pl ? 'Kierunek transakcji' : 'Trade direction'}>
        <button type="button" aria-pressed={buying} onClick={() => setSection('buy')}>{pl ? 'Kupuj' : 'Buy'}</button>
        <button type="button" aria-pressed={!buying} onClick={() => setSection('sell')}>{pl ? 'Sprzedawaj' : 'Sell'}</button>
      </nav>
      <div className="merchant-catalog" tabIndex={0} aria-label={pl ? 'Oferta handlowa' : 'Trade catalogue'}>
        <h3>{pl ? 'Materiały' : 'Materials'}</h3>
        {MERCHANT_MATERIALS.map(material => {
          const info = materials[material.key]
          const price = material[section]
          return <div className="merchant-row" key={material.key}>
            <MaterialArtwork kind={info.icon}/>
            <div><strong>{info[language]}</strong><small>{pl ? 'W ładowni' : 'In cargo'} · {progress[material.key]}</small></div>
            <button type="button" className="space-dialog-action" aria-label={`${tradeLabel} · ${info[language]} · ${format(price)}`}
              disabled={buying ? progress.credits < price : progress[material.key] < 1}
              onClick={() => onTrade(current => tradeMerchantMaterial(current, material.key, section))}>{format(price)}</button>
          </div>
        })}
        <h3>{pl ? 'Moduły' : 'Modules'}</h3>
        {buying && full && <p>{pl ? 'Plecak jest pełny.' : 'Backpack is full.'}</p>}
        {!buying && parts.length === 0 && <p>{pl ? 'Brak niezainstalowanych modułów do sprzedaży.' : 'No unequipped modules to sell.'}</p>}
        {parts.map(({ part, price, sold }) => <div className={`merchant-row rarity-${part.rarity}`} key={part.id}>
          <PartArtwork slot={part.slot} rarity={part.rarity}/>
          <div><strong>{partLabel(part)} · {getShipPartRarityLabel(language, part.rarity)}</strong>
            <small>{getShipPartStatSummary(part, language)} · {pl ? 'Poziom' : 'Level'} {getShipPartLevelRequirement(part.rarity)}</small></div>
          <button type="button" className="space-dialog-action" aria-label={`${tradeLabel} · ${partLabel(part)} ${getShipPartRarityLabel(language, part.rarity)} · ${format(price)}`}
            disabled={buying && (sold || full || progress.credits < price)}
            onClick={() => onTrade(current => buying ? buyMerchantPart(current, part.id) : sellShipPart(current, part.id))}>
            {sold ? (pl ? 'Wyprzedany' : 'Sold') : format(price)}
          </button>
        </div>)}
      </div>
    </section>
  </div>
}
