import { useEffect, useState } from 'react'
import type { GameLanguage } from '../i18n'
import { CHARACTER } from '../domain/starfall'
import '../../styles/ui/IntroCutscene.scss'

interface IntroCutsceneProps {
  language: GameLanguage
  onDone: () => void
}

const BEAT_MS = 3800
const BEATS: { pl: string; en: string }[] = [
  { pl: 'Kael Ryn, ostatni strażnik Orion–7, od lat trzymał granicę przed Pożeraczem.', en: 'Kael Ryn, last guardian of Orion–7, had held the line against the Devourer for years.' },
  { pl: 'Moduł translacyjny był ostatnią rzeczą, jaka jeszcze działała na pokładzie.', en: 'The translation module was the last thing still working aboard.' },
  { pl: 'Jeden zniekształcony sygnał — i zaplanowany skok zamienił się w upadek.', en: 'One corrupted signal — and the planned jump became a fall.' },
  { pl: 'Obudziłeś się na powierzchni szklanego księżyca, we wraku własnego statku.', en: 'You woke on the surface of a glass moon, in the wreck of your own ship.' },
  { pl: 'Pożeracz jest coraz bliżej. Bez modułu nikt nie usłyszy twojego ostrzeżenia.', en: 'The Devourer is drawing closer. Without the module, no one will hear your warning.' },
  { pl: 'Znajdź części. Napraw moduł. Odzyskaj głos wśród gwiazd.', en: 'Find the parts. Repair the module. Reclaim your voice among the stars.' },
]

export function IntroCutscene({ language, onDone }: IntroCutsceneProps) {
  const [beat, setBeat] = useState(0)
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    if (finished) { onDone(); return }
    if (beat >= BEATS.length) { const t = window.setTimeout(() => setFinished(true), 4200); return () => window.clearTimeout(t) }
    const timer = window.setTimeout(() => setBeat(index => index + 1), BEAT_MS)
    return () => window.clearTimeout(timer)
  }, [beat, finished, onDone])

  const showTitle = beat >= BEATS.length
  return (
    <main className="intro-cutscene" data-testid="intro-cutscene">
      <div className="intro-starfield" aria-hidden="true" />
      <div className="intro-nebula" aria-hidden="true" />
      <div className="intro-cutscene-content">
        <p className="intro-eyebrow">NEON VOID</p>
        {showTitle ? (
          <>
            <h1 className="intro-title">{CHARACTER.name[language]}</h1>
            <p className="intro-subtitle">{language === 'pl' ? 'Ostatni strażnik Orion–7' : 'Last guardian of Orion–7'}</p>
          </>
        ) : (
          <p key={beat} className="intro-beat">{BEATS[beat][language === 'pl' ? 'pl' : 'en']}</p>
        )}
      </div>
      <button type="button" className="intro-skip" onClick={() => setFinished(true)}>
        {language === 'pl' ? 'Pomiń' : 'Skip'} →
      </button>
    </main>
  )
}