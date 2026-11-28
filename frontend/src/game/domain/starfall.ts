import { localizedText, type LocalizedText } from '../i18n'

/** Protagonist history — referenced across the campaign. */
export const CHARACTER = {
  name: localizedText((_t, l) => l === 'pl' ? 'Kael Ryn' : 'Kael Ryn'),
  role: localizedText((_t, l) => l === 'pl' ? 'Strażnik sektora Orion–7' : 'Guardian of the Orion–7 sector'),
  backstory: [
    localizedText((_t, l) => l === 'pl'
      ? 'Byłeś ostatnim strażnikiem sektora Orion–7 — pilotem, który trzymał granicę przed tym, co nadeszło z pustki.'
      : 'You were the last guardian of the Orion–7 sector — the pilot who held the line against what came out of the void.'),
    localizedText((_t, l) => l === 'pl'
      ? 'Gdy nadszedł Pożeracz, twoja eskadra spłonęła w pierwszej salwie. Ostatni strzał bossa rozłupał twój statek nad SZKLANYM KSIĘŻYCEM.'
      : 'When the Devourer came, your squadron burned in the first volley. The boss’s final shot cracked your ship above the Glass Moon.'),
    localizedText((_t, l) => l === 'pl'
      ? 'Rozbiłeś się na planecie. Teraz zbierasz sojuszników, by odzyskać sektor i dokończyć to, co zacząłeś.'
      : 'You crashed on the planet. Now you gather allies to retake the sector and finish what you started.'),
  ],
} as const

/** The sector boss — a void monster that wears a three-lock carapace. */
export const SECTOR_BOSS = {
  id: 'the-devourer',
  name: localizedText((_t, l) => l === 'pl' ? 'Pożeracz' : 'The Devourer'),
  form: localizedText((_t, l) => l === 'pl' ? 'potwór z pustki w pancerzu z trzech blokad' : 'void monster clad in a three-lock carapace'),
  lore: localizedText((_t, l) => l === 'pl'
    ? 'Trzy blokady chronią jego rdzeń. Dopiero gdy padną, można go zranić — a on odpowiada falami dronów.'
    : 'Three blockades shield its core. Only when they fall can it be harmed — and it answers with waves of drones.'),
} as const

/** Opening narration beats for the intro cinematic. */
export const INTRO_BEATS: readonly LocalizedText[] = [
  CHARACTER.backstory[0],
  CHARACTER.backstory[1],
  CHARACTER.backstory[2],
]