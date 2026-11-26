import { formatControlKey, gameText, type GameLanguage } from '../i18n'

export function FixedControls({ language }: { language: GameLanguage }) {
  const text = gameText(language).fixedControls
  const rows = [
    [text.look, text.holdRightButton], [text.preview, text.holdRightButton], [text.fire, text.leftButton],
    [text.journal, formatControlKey('KeyL', language)], [text.statistics, formatControlKey('KeyC', language)],
    [text.inventory, formatControlKey('KeyI', language)], [text.pause, formatControlKey('Escape', language)],
    [text.sell, text.rightButton],
    [text.mapZoom, '− / +'], [text.mapPan, '↑ ↓ ← →'], [text.mapReset, '0'],
  ]
  return <dl className="fixed-controls">{rows.map(([label, key]) => <div key={label}><dt>{label}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl>
}
