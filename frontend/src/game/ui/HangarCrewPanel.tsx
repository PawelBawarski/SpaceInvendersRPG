import { useState } from 'react'
import { HANGAR_CREW } from '../hangar/crew'

export function HangarCrewPanel({ language }: { language: 'pl' | 'en' }) {
  const [selected, setSelected] = useState({ id: HANGAR_CREW[0].id, line: 0 })
  const member = HANGAR_CREW.find(entry => entry.id === selected.id) ?? HANGAR_CREW[0]
  const pl = language === 'pl'
  return <details className="hangar-crew-panel">
    <summary>{pl ? 'Załoga hangaru' : 'Hangar crew'}</summary>
    <div className="hangar-crew-panel-body">
      <div className="hangar-crew-roster" role="group" aria-label={pl ? 'Porozmawiaj z załogą' : 'Talk to the crew'}>
        {HANGAR_CREW.map(entry => <button key={entry.id} type="button" aria-pressed={entry.id === member.id}
          onClick={() => setSelected({ id: entry.id, line: entry.id === member.id ? (selected.line + 1) % entry.dialogue.length : 0 })}>
          {entry.name[language]}
        </button>)}
      </div>
      <div className="hangar-crew-line" aria-live="polite">
        <strong>{member.name[language]}</strong><small>{member.role[language]}</small>
        <p>{member.dialogue[selected.line][language]}</p>
      </div>
    </div>
  </details>
}
