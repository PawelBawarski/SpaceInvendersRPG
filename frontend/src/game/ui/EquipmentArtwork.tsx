import type { CSSProperties } from 'react'
import { SHIP_PART_RARITY_COLORS, type ShipPartRarity, type ShipPartSlot } from '../progress/shipParts'

interface PartArtworkProps {
  slot: ShipPartSlot
  rarity?: ShipPartRarity
}

/** Module shapes and illuminated bands match the equipment attached to the ship. */
export function PartArtwork({ slot, rarity }: PartArtworkProps) {
  const tier = rarity === 'prototype' ? 3 : rarity === 'refined' ? 2 : 1
  return (
    <span
      className={`part-artwork part-artwork-${rarity ?? 'empty'}`}
      style={{ '--part-color': rarity ? SHIP_PART_RARITY_COLORS[rarity] : '#536372' } as CSSProperties}
      aria-hidden="true"
      data-part-slot={slot}
      data-part-rarity={rarity ?? 'empty'}
    >
      <svg viewBox="0 0 80 44" fill="none">
        <ellipse cx="40" cy="37" rx="25" ry="3" fill="#08121c" opacity=".3" />
        {slot === 'armor' && <>
          <path d="M9 29 18 12 36 6 64 10 72 17 61 34 27 39Z" fill="#233548" stroke="#b7c8d1" strokeWidth="1.4"/>
          <path d="M17 26 24 15 36 10 61 14 65 18 54 26 28 33Z" fill="#7e9aac"/>
          <path d="M22 24 35 19 60 17M26 31 45 24 60 20" stroke="var(--part-color)" strokeWidth={tier}/>
        </>}
        {slot === 'reactor' && <>
          <path d="M26 5H54L65 22 54 39H26L15 22Z" fill="#253d50" stroke="#96b0c3" strokeWidth="1.4"/>
          <circle cx="40" cy="22" r="12" fill="#0c1827" stroke="var(--part-color)" strokeWidth={tier}/>
          <path d="M42 12 32 23H39L37 32 49 20H42Z" fill="var(--part-color)"/>
        </>}
        {slot === 'scanner' && <>
          <path d="M15 32 64 30 58 37H21Z" fill="#2e4559" stroke="#a2bbcc"/>
          <path d="M21 8Q39 36 65 7L64 17Q35 45 21 8Z" fill="#638396" stroke="#b5d3df"/>
          <path d="M40 28 49 12M50 7Q58 9 60 16M51 3Q64 5 67 14" stroke="var(--part-color)" strokeWidth={tier}/>
        </>}
        {slot === 'weapon' && (
          <>
            <path d="m13 23 7-10 24-2 9 7-3 14-28 2-9-5Z" fill="#24394b" stroke="#8ca4b6" />
            <path d="m20 16 22-2 6 6-3 8-23 2-5-5Z" fill="#afc1cc" />
            <path d="m43 17 25-2 4 4v7l-26 2Z" fill="#1b2d3c" stroke="#8198a9" />
            <path d="m50 18 20-1m-21 8 21-1" stroke="#d4e3eb" strokeWidth="2" />
            <path d="m27 30-2 8h10l4-9" fill="#273d50" stroke="#90a4b3" />
            {Array.from({ length: tier }, (_, index) => <path key={index} d={`m${25 + index * 6} 18-2 8`} stroke="var(--part-color)" strokeWidth="3" />)}
            <path d="M70 19v5" stroke="var(--part-color)" strokeWidth="3" />
          </>
        )}
        {slot === 'shield' && (
          <>
            <path d="m40 3 24 10-3 17-21 11-21-11-3-17Z" fill="#22394a" stroke="#9db5c6" strokeWidth="1.4" />
            <path d="m40 7 19 8-3 13-16 9-16-9-3-13Z" fill="#466276" />
            <path d="m40 11 13 6-2 8-11 7-11-7-2-8Z" fill="#112534" stroke="var(--part-color)" strokeWidth="2" />
            <path d="m40 16 7 4-1 4-6 4-6-4-1-4Z" fill="var(--part-color)" opacity=".9" />
            {Array.from({ length: tier }, (_, index) => <path key={index} d={`m${25 + index * 6} 8-3 3`} stroke="var(--part-color)" strokeWidth="2" />)}
            <path d="m18 17 4 1m36 0 4-1M26 31l2-3m24 0 2 3" stroke="#e0edf3" strokeWidth="2" />
          </>
        )}
        {slot === 'engine' && (
          <>
            <path d="m17 14 13-6 30 4 7 10-7 11-30 4-13-6Z" fill="#273d4e" stroke="#94adbe" />
            <path d="m29 11 29 4 4 7-4 8-29 4Z" fill="#a0b5c3" />
            <path d="M34 13v19m7-18v17m7-16v15" stroke="#456075" strokeWidth="3" />
            <ellipse cx="23" cy="23" rx="11" ry="13" fill="#152938" stroke="#b2c7d3" strokeWidth="2" />
            <ellipse cx="23" cy="23" rx="7" ry="9" fill="#07131e" stroke="var(--part-color)" strokeWidth="2" />
            <ellipse cx="23" cy="23" rx="3" ry="5" fill="var(--part-color)" />
            {Array.from({ length: tier }, (_, index) => <path key={index} d={`M${49 + index * 5} 17v11`} stroke="var(--part-color)" strokeWidth="2" />)}
          </>
        )}
      </svg>
    </span>
  )
}

export type MaterialKind = 'credits' | 'alloy' | 'copper' | 'radioactive'

export function MaterialArtwork({ kind }: { kind: MaterialKind }) {
  return (
    <svg className={`material-artwork material-artwork-${kind}`} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {kind === 'credits' && <>
        <path d="M7 23v5c0 5 22 5 22 0v-5" fill="#785426" stroke="#f2c16f" />
        <ellipse cx="18" cy="23" rx="11" ry="5" fill="#ad7c35" stroke="#f2c16f" />
        <path d="M7 15v5c0 5 22 5 22 0v-5" fill="#785426" stroke="#f2c16f" />
        <ellipse cx="18" cy="15" rx="11" ry="5" fill="#d8ad5b" stroke="#ffe3a4" />
        <path d="m20 12-5 3 5 2" stroke="#674615" strokeWidth="2" />
      </>}
      {kind === 'alloy' && <>
        <path d="m5 22 20-5 7 6-20 6Z" fill="#a5bbc9" stroke="#d3e1eb" />
        <path d="M5 22v6l7 5v-4m20-6v6l-20 4" fill="#526d80" stroke="#9cb3c4" />
        <path d="m4 12 19-6 8 6-19 6Z" fill="#bcced9" stroke="#e0eaf0" />
        <path d="M4 12v6l8 6v-6m19-6v6l-19 6" fill="#668498" stroke="#afc3d2" />
        <path d="m10 12 13-4m-4 10 9-3" stroke="#f0f5f8" opacity=".5" />
      </>}
      {kind === 'copper' && <>
        <path d="m5 12 16-5 10 7-16 5Z" fill="#df9a62" stroke="#ffcba0" />
        <path d="M5 12v14l10 7V19m16-5v14l-16 5" fill="#8f4d30" stroke="#e7a16d" />
        <path d="m10 16 1 12m9-10v11m6-13v11" stroke="#bf764e" strokeWidth="2" />
        <path d="m12 11 10 5" stroke="#ffe1be" />
      </>}
      {kind === 'radioactive' && <>
        <path d="m10 5 16 0 5 7-3 18-10 3-10-3-3-18Z" fill="#293c37" stroke="#8fe09f" />
        <path d="M12 4h12v5H12Z" fill="#7b9b86" stroke="#bddcc5" />
        <circle cx="18" cy="20" r="10" fill="#c8d276" />
        <circle cx="18" cy="20" r="2" fill="#24352d" />
        <path d="m16 16-3-5-4 7 6 1m6 0 6-1-4-7-3 5m-5 7-3 5h12l-3-5" fill="#24352d" />
      </>}
    </svg>
  )
}
