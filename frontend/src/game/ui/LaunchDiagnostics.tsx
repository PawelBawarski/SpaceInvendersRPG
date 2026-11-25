import { useEffect, useState } from 'react'

const IGNITION_CODE = [2, 4, 1, 3] as const
const nextTask = (mask: number) => [0, 1, 2].find(index => !(mask & 1 << index)) ?? 0

export function LaunchDiagnostics({ mask, language, onRepair, onLaunch }: {
  mask: number; language: 'pl' | 'en'; onRepair: (mask: number) => void; onLaunch: () => void
}) {
  const pl = language === 'pl'
  const labels = pl ? ['Kadłub', 'Reaktor', 'Napęd'] : ['Hull', 'Reactor', 'Drive']
  const titles = pl ? ['Połącz obwody', 'Zestrojenie reaktora', 'Sekwencja zapłonu'] : ['Connect the circuits', 'Tune the reactor', 'Ignition sequence']
  const [task, setTask] = useState(() => nextTask(mask))
  const [rotations, setRotations] = useState([1, 3, 2])
  const [voltage, setVoltage] = useState(24)
  const [frequency, setFrequency] = useState(71)
  const [ignition, setIgnition] = useState<'ready' | 'preview' | 'enter'>('ready')
  const [step, setStep] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (ignition !== 'preview') return
    const timer = window.setTimeout(() => setIgnition('enter'), 2800)
    return () => window.clearTimeout(timer)
  }, [ignition])
  const complete = (index: number) => {
    const next = mask | 1 << index
    onRepair(next)
    setTask(nextTask(next))
  }
  const rotate = (index: number) => {
    const next = rotations.map((value, circuit) => circuit === index ? (value + 1) % 4 : value)
    setRotations(next)
    if (next.every(value => value === 0)) complete(0)
  }
  const enter = (number: number) => {
    if (number !== IGNITION_CODE[step]) { setStep(0); setFailed(true); return }
    setFailed(false)
    if (step === IGNITION_CODE.length - 1) complete(2)
    else setStep(step + 1)
  }
  const tuned = voltage >= 58 && voltage <= 66 && frequency >= 32 && frequency <= 40
  const tasksDone = mask === 7

  return <section className="recovery-console" aria-label={pl ? 'Naprawa statku' : 'Repair ship'}>
    <span>{pl ? 'DIAGNOSTYKA STARTOWA' : 'LAUNCH DIAGNOSTICS'} · {labels.filter((_, index) => mask & 1 << index).length}/3</span>
    <nav className="recovery-task-tabs" aria-label={pl ? 'Układy statku' : 'Ship systems'}>
      {labels.map((label, index) => <button type="button" key={label} aria-pressed={task === index} onClick={() => setTask(index)}>
        {label}{mask & 1 << index ? <span aria-hidden="true"> ✓</span> : null}
      </button>)}
    </nav>
    <h2>{tasksDone ? (pl ? 'Gotowy do startu' : 'Ready to launch') : titles[task]}</h2>
    {!tasksDone && (mask & 1 << task ? <p>{pl ? 'Układ sprawny.' : 'System operational.'}</p> : task === 0 ? <>
      <p>{pl ? 'Obróć każdy przewód, aż połączy dwa jasne styki.' : 'Rotate each conduit until it links both lit contacts.'}</p>
      <div className="repair-circuits">{rotations.map((rotation, index) => <button type="button" key={index}
        className={rotation === 0 ? 'repaired' : ''} disabled={rotation === 0} onClick={() => rotate(index)}
        aria-label={`${pl ? 'Obróć obwód' : 'Rotate circuit'} ${index + 1}`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="38" className="circuit-ring"/><path d="M0 50H14M50 86V100" className="circuit-contact"/>
          <path d="M14 50H50V86" className="circuit-conduit" transform={`rotate(${rotation * 90} 50 50)`}/><circle cx="50" cy="50" r="4"/>
        </svg><strong>{rotation === 0 ? '✓' : `0${index + 1}`}</strong>
      </button>)}</div>
    </> : task === 1 ? <div className="recovery-tuning">
      <p>{pl ? 'Ustaw oba parametry w podanych zakresach odczytu.' : 'Bring both readings into the indicated ranges.'}</p>
      {[
        { name: pl ? 'Napięcie' : 'Voltage', value: voltage, change: setVoltage, range: '58–66' },
        { name: pl ? 'Częstotliwość' : 'Frequency', value: frequency, change: setFrequency, range: '32–40' },
      ].map(control => <label key={control.name}>
        <span>{control.name}</span><output>{control.value} / {control.range}</output>
        <input type="range" min="0" max="100" aria-label={control.name} value={control.value} onChange={event => control.change(Number(event.currentTarget.value))}/>
      </label>)}
      <button className="recovery-task-action" type="button" disabled={!tuned} onClick={() => complete(1)}>{pl ? 'Ustabilizuj reaktor' : 'Stabilize reactor'}</button>
    </div> : <div className="recovery-ignition">
      <p>{pl ? 'Zapamiętaj kolejność, a potem uruchom styki w tym samym porządku.' : 'Memorize the sequence, then activate the contacts in that order.'}</p>
      <div className="recovery-ignition-readout" aria-live="polite">
        {ignition === 'preview' ? IGNITION_CODE.join(' · ') : failed ? (pl ? 'Zła kolejność. Spróbuj od początku.' : 'Wrong order. Start again.')
          : (pl ? `Zapłon ${step}/4` : `Ignition ${step}/4`)}
      </div>
      <div className="recovery-ignition-pads">
        {[1, 2, 3, 4].map(number => <button type="button" key={number} disabled={ignition !== 'enter'}
          aria-label={`${pl ? 'Styk' : 'Contact'} ${number}`} onClick={() => enter(number)}>{number}</button>)}
      </div>
      <button className="recovery-task-action" type="button" disabled={ignition === 'preview'}
        onClick={() => { setStep(0); setFailed(false); setIgnition('preview') }}>{pl ? 'Pokaż sekwencję' : 'Show sequence'}</button>
    </div>)}
    <button className="recovery-launch" type="button" disabled={!tasksDone} onClick={onLaunch}>
      {pl ? 'Uruchom silniki i odleć' : 'Start the engines and depart'} <span aria-hidden="true">↗</span>
    </button>
  </section>
}
