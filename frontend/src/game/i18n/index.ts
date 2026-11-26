import en from './en.json' with { type: 'json' }
import pl from './pl.json' with { type: 'json' }

export type GameMessages = typeof pl
const catalogs = { pl, en } satisfies Record<string, GameMessages>
export type GameLanguage = keyof typeof catalogs
export type LocalizedText<T = string> = Readonly<Record<GameLanguage, T>>

export const DEFAULT_GAME_LANGUAGE: GameLanguage = 'pl'
export const GAME_LANGUAGES = Object.keys(catalogs) as GameLanguage[]
const numberFormats = new Map<string, Intl.NumberFormat>()

export function isGameLanguage(value: unknown): value is GameLanguage {
  return typeof value === 'string' && Object.hasOwn(catalogs, value)
}

export function gameText(language: GameLanguage): GameMessages {
  return catalogs[language]
}

export function localizedText<T>(pick: (catalog: GameMessages, language: GameLanguage) => T): LocalizedText<T> {
  return Object.fromEntries(GAME_LANGUAGES.map(language => [language, pick(catalogs[language], language)])) as LocalizedText<T>
}

export function formatText(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(values, key) ? String(values[key]) : match)
}

export function formatNumber(value: number, language: GameLanguage, maximumFractionDigits?: number): string {
  const key = language + '/' + (maximumFractionDigits ?? 'default')
  let formatter = numberFormats.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(language, { maximumFractionDigits })
    numberFormats.set(key, formatter)
  }
  return formatter.format(value)
}

export function formatControlKey(code: string, language: GameLanguage): string {
  const keys: Readonly<Record<string, string>> = gameText(language).application.labels
  return keys[code] ?? code.replace(/^(Key|Digit)/, '')
}
