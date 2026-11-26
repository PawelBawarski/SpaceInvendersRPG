import { expect, it } from 'vitest'
import { DEFAULT_GAME_LANGUAGE, GAME_LANGUAGES, gameText } from './index'

function describeEntries(value: unknown, path = ''): Record<string, string[]> {
  if (typeof value === 'string') {
    return { [path]: [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]))].sort() }
  }
  return Object.assign({}, ...Object.entries(value as object)
    .map(([key, entry]) => describeEntries(entry, path ? path + '.' + key : key)))
}

it('provides the same translation keys, list entries and template parameters in every language', () => {
  const expected = describeEntries(gameText(DEFAULT_GAME_LANGUAGE))
  for (const language of GAME_LANGUAGES) expect(describeEntries(gameText(language))).toEqual(expected)
})
