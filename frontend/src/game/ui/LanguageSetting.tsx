import { GAME_LANGUAGES, gameText, isGameLanguage, type GameLanguage } from '../i18n'

export function LanguageSetting({ language, className, onChange }: {
  language: GameLanguage
  className: string
  onChange: (language: GameLanguage) => void
}) {
  return <label className={className}>
    <span>{gameText(language).application.ui.language}</span>
    <select name="language" value={language} onChange={event => {
      const selected = event.currentTarget.value
      if (isGameLanguage(selected)) onChange(selected)
    }}>
      {GAME_LANGUAGES.map(code => <option key={code} value={code} lang={code}>{gameText(code).common.languageName}</option>)}
    </select>
  </label>
}
