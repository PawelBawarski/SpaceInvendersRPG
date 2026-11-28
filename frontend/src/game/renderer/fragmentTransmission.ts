import { gameText, type GameLanguage } from '../i18n'

/** Radio line for a recovered black-box fragment, or undefined past the last one. */
export function getFragmentTransmission(index: number, language: GameLanguage): string | undefined {
  return gameText(language).combatScene.labels[index]
}