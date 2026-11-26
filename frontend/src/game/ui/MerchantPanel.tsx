import { formatNumber, gameText, type GameLanguage } from '../i18n'
import { useState } from 'react'
import type { MerchantSite } from '../domain/exploration'
import { MERCHANT_MATERIALS, buyMerchantPart, getMerchantStock, tradeMerchantMaterial } from '../progress/merchantTrade'
import { canStoreShipPart, getBackpackShipParts, sellShipPart, type MissionProgress } from '../progress/missionProgress'
import { getShipPartLevelRequirement, getShipPartSellValue, type ShipPart } from '../progress/shipParts'
import { MaterialArtwork, PartArtwork } from './EquipmentArtwork'
import { IconButton } from './ActionIcon'
import { getShipPartRarityLabel, getShipPartSlotLabel, getShipPartStatSummary } from './shipPartPresentation'
import './SpaceDialogs.css'

const materialIcons = {
  scrapMetal: 'alloy',
  copper: 'copper',
  radioactiveResidue: 'radioactive',
  meridianCore: 'radioactive',
} as const

export function MerchantPanel({ language, merchant, progress, onClose, onTrade }: {
  language: GameLanguage
  merchant: MerchantSite
  progress: MissionProgress
  onClose: () => void
  onTrade: (transaction: (current: MissionProgress) => MissionProgress) => void
}) {
  const [section, setSection] = useState<'buy' | 'sell'>('buy')
  const buying = section === 'buy'
  const format = (credits: number) => `${formatNumber(credits, language)} KS`
  const tradeLabel = buying ? (gameText(language).merchant.buy) : (gameText(language).merchant.sell)
  const full = !canStoreShipPart(progress)
  const parts = buying
    ? getMerchantStock(progress)
    : getBackpackShipParts(progress).map(part => ({ part, price: getShipPartSellValue(part), sold: false }))
  const partLabel = (part: ShipPart) => getShipPartSlotLabel(language, part.slot)

  return <div className="space-dialog-backdrop">
    <section className="space-dialog merchant-dialog" role="dialog" aria-modal="true" aria-labelledby="merchant-title">
      <header className="space-dialog-header">
        <div><span>{gameText(language).merchant.merchantVessel}</span><h2 id="merchant-title">{merchant.name[language]}</h2></div>
        <output className="merchant-balance" aria-label={gameText(language).merchant.availableCredits}>{format(progress.credits)}</output>
        <IconButton icon="close" className="journal-close" onClick={onClose} autoFocus label={gameText(language).merchant.closeTrade} />
      </header>
      <nav className="merchant-tabs" aria-label={gameText(language).merchant.tradeDirection}>
        <button type="button" aria-pressed={buying} onClick={() => setSection('buy')}>{gameText(language).merchant.buy2}</button>
        <button type="button" aria-pressed={!buying} onClick={() => setSection('sell')}>{gameText(language).merchant.sell2}</button>
      </nav>
      <div className="merchant-catalog" tabIndex={0} aria-label={gameText(language).merchant.tradeCatalogue}>
        <h3>{gameText(language).merchant.materials}</h3>
        {MERCHANT_MATERIALS.map(material => {
          const name = gameText(language).merchant.materialNames[material.key]
          const price = material[section]
          return <div className="merchant-row" key={material.key}>
            <MaterialArtwork kind={materialIcons[material.key]}/>
            <div><strong>{name}</strong><small>{gameText(language).merchant.inCargo} · {progress[material.key]}</small></div>
            <button type="button" className="space-dialog-action" aria-label={`${tradeLabel} · ${name} · ${format(price)}`}
              disabled={buying ? progress.credits < price : progress[material.key] < 1}
              onClick={() => onTrade(current => tradeMerchantMaterial(current, material.key, section))}>{format(price)}</button>
          </div>
        })}
        <h3>{gameText(language).merchant.modules}</h3>
        {buying && full && <p>{gameText(language).merchant.backpackIsFull}</p>}
        {!buying && parts.length === 0 && <p>{gameText(language).merchant.noUnequippedModulesToSell}</p>}
        {parts.map(({ part, price, sold }) => <div className={`merchant-row rarity-${part.rarity}`} key={part.id}>
          <PartArtwork slot={part.slot} rarity={part.rarity}/>
          <div><strong>{partLabel(part)} · {getShipPartRarityLabel(language, part.rarity)}</strong>
            <small>{getShipPartStatSummary(part, language)} · {gameText(language).merchant.level} {getShipPartLevelRequirement(part.rarity)}</small></div>
          <button type="button" className="space-dialog-action" aria-label={`${tradeLabel} · ${partLabel(part)} ${getShipPartRarityLabel(language, part.rarity)} · ${format(price)}`}
            disabled={buying && (sold || full || progress.credits < price)}
            onClick={() => onTrade(current => buying ? buyMerchantPart(current, part.id) : sellShipPart(current, part.id))}>
            {sold ? (gameText(language).merchant.sold) : format(price)}
          </button>
        </div>)}
      </div>
    </section>
  </div>
}
