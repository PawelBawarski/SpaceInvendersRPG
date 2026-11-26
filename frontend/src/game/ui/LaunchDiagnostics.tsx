import { formatText, gameText, type GameLanguage } from '../i18n'
import { useCallback, useEffect, useState } from 'react'
import { FIRST_FLIGHT_VITALS } from '../domain/shipTelemetry'
import { RECOVERY_CIRCUIT_TURNS, RECOVERY_COMPLETE_MASK, RECOVERY_IGNITION, RECOVERY_REACTOR, RECOVERY_TASK, RECOVERY_TASKS } from '../simulation/ShipRecovery'

const nextTask = (mask: number) => RECOVERY_TASKS.find(index => !(mask & 1 << index)) ?? RECOVERY_TASK.circuits
const CIRCUIT_ORIENTATIONS = 4
const BOARD_WIDTH = 328
const CIRCUIT_POSITIONS = [54, 164, 274]
const CIRCUIT_TRACES = ['M9 51H20', 'M54 85V109H111V51H130', 'M164 85V109H221V51H240', 'M274 85V109H308']
const OSCILLOSCOPE_WIDTH = 240
const OSCILLOSCOPE_STEPS = 64
const REACTOR_SAMPLE_MS = 45

function reactorWave(voltage: number, frequency: number) {
  const amplitude = voltage * .44
  return Array.from({ length: OSCILLOSCOPE_STEPS + 1 }, (_, index) => {
    const phase = index / OSCILLOSCOPE_STEPS
    return `${phase * OSCILLOSCOPE_WIDTH},${36 - Math.sin(phase * frequency * .52) * amplitude}`
  }).join(' ')
}

const referenceWave = reactorWave((RECOVERY_REACTOR.voltage.min + RECOVERY_REACTOR.voltage.max) / 2,
  (RECOVERY_REACTOR.frequency.min + RECOVERY_REACTOR.frequency.max) / 2)

export function LaunchDiagnostics({ mask, language, onRepair, onLaunch }: {
  mask: number; language: GameLanguage; onRepair: (mask: number) => void; onLaunch: () => void
}) {
  const text = gameText(language).diagnostics
  const { labels, titles } = text
  const [task, setTask] = useState<number>(() => nextTask(mask))
  const [rotations, setRotations] = useState<number[]>(() => [...RECOVERY_CIRCUIT_TURNS])
  const [voltage, setVoltage] = useState<number>(RECOVERY_REACTOR.voltage.initial)
  const [frequency, setFrequency] = useState<number>(RECOVERY_REACTOR.frequency.initial)
  const [reactorStart, setReactorStart] = useState<number | null>(null)
  const [reactorProgress, setReactorProgress] = useState(0)
  const [ignition, setIgnition] = useState<'ready' | 'preview' | 'enter'>('ready')
  const [pulse, setPulse] = useState(0)
  const [step, setStep] = useState(0)
  const [failed, setFailed] = useState(false)
  const complete = useCallback((index: number) => {
    const next = mask | 1 << index
    onRepair(next)
    setTask(nextTask(next))
  }, [mask, onRepair])
  useEffect(() => {
    if (ignition !== 'preview') return
    const timer = window.setTimeout(() => {
      if (pulse + 1 === RECOVERY_IGNITION.sequence.length) setIgnition('enter')
      else setPulse(pulse + 1)
    }, RECOVERY_IGNITION.pulseMilliseconds)
    return () => window.clearTimeout(timer)
  }, [ignition, pulse])
  const rotate = (index: number) => {
    const next = rotations.map((value, circuit) => circuit === index ? (value + 1) % CIRCUIT_ORIENTATIONS : value)
    setRotations(next)
    if (next.every(value => value === 0)) complete(RECOVERY_TASK.circuits)
  }
  const enter = (number: number) => {
    if (number !== RECOVERY_IGNITION.sequence[step]) { setStep(0); setFailed(true); return }
    setFailed(false)
    if (step === RECOVERY_IGNITION.sequence.length - 1) complete(RECOVERY_TASK.ignition)
    else setStep(step + 1)
  }
  const controls = [
    { name: text.voltage, value: voltage, change: setVoltage, band: RECOVERY_REACTOR.voltage },
    { name: text.frequency, value: frequency, change: setFrequency, band: RECOVERY_REACTOR.frequency },
  ]
  const tuned = controls.every(control => control.value >= control.band.min && control.value <= control.band.max)
  const tasksDone = mask === RECOVERY_COMPLETE_MASK
  const locking = reactorStart !== null
  useEffect(() => {
    if (reactorStart === null || !tuned) return
    const timer = window.setInterval(() => {
      const fraction = (performance.now() - reactorStart) / RECOVERY_REACTOR.synchronizationMilliseconds
      setReactorProgress(Math.min(1, fraction))
      if (fraction >= 1) {
        window.clearInterval(timer)
        setReactorStart(null)
        complete(RECOVERY_TASK.reactor)
      }
    }, REACTOR_SAMPLE_MS)
    return () => window.clearInterval(timer)
  }, [reactorStart, tuned, complete])

  const activeContact = ignition === 'preview' ? RECOVERY_IGNITION.sequence[pulse] : null
  const firstBreak = rotations.findIndex(rotation => rotation !== 0)
  const powered = firstBreak === -1 ? rotations.length : firstBreak

  return <section className="recovery-console" aria-label={gameText(language).diagnostics.repairShip}>
    <span>{text.launchDiagnostics} · {RECOVERY_TASKS.filter(index => mask & 1 << index).length}/{RECOVERY_TASKS.length}</span>
    <nav className="recovery-task-tabs" aria-label={gameText(language).diagnostics.shipSystems}>
      {labels.map((label, index) => <button type="button" key={label} aria-pressed={task === index} onClick={() => setTask(index)}>
        {label}{mask & 1 << index ? <span aria-hidden="true"> ✓</span> : null}
      </button>)}
    </nav>
    <h2>{tasksDone ? (gameText(language).diagnostics.readyToLaunch) : titles[task]}</h2>
    {tasksDone && <p>{formatText(text.firstFlightWarning, { hull: FIRST_FLIGHT_VITALS.hull })}</p>}
    {!tasksDone && (mask & 1 << task ? <p>{text.systemOperational}</p> : task === RECOVERY_TASK.circuits ? <>
      <p>{gameText(language).diagnostics.rotateEachConduitUntilItLinks}</p>
      <div className="repair-circuits">
        <svg className="circuit-board-traces" viewBox={`0 0 ${BOARD_WIDTH} 125`} aria-hidden="true">
          {CIRCUIT_TRACES.map((trace, index) => <path className={index <= powered ? 'powered-trace' : undefined} key={trace} d={trace} />)}
          <circle cx="9" cy="51" r="4" className="powered-trace" /><circle cx="309" cy="109" r="4" />
        </svg>
        {rotations.map((rotation, index) => <button type="button" key={index}
          style={{ left: `${CIRCUIT_POSITIONS[index] / BOARD_WIDTH * 100}%` }}
          className={index < powered ? 'powered' : rotation === 0 ? 'aligned' : undefined} onClick={() => rotate(index)}
          aria-label={`${text.rotateCircuit} ${index + 1}`}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="37" className="circuit-ring" />
            <path d="M0 50H14M50 86V100" className="circuit-contact" />
            <path d="M14 50H44Q50 50 50 56V86" className="circuit-conduit" transform={`rotate(${rotation * 90} 50 50)`} />
            <circle cx="50" cy="50" r="4" />
          </svg>
        </button>)}
      </div>
    </> : task === RECOVERY_TASK.reactor ? <div className="recovery-tuning">
      <p>{text.bringBothReadingsIntoTheIndicated}</p>
      <div className="reactor-oscilloscope" data-tuned={tuned}>
        <svg viewBox={`0 0 ${OSCILLOSCOPE_WIDTH} 72`} aria-hidden="true">
          <path d="M0 36H240M60 0V72M120 0V72M180 0V72" className="reactor-grid" />
          <polyline points={referenceWave} className="reactor-reference" />
          <polyline points={reactorWave(voltage, frequency)} className="reactor-actual" />
        </svg>
      </div>
      {controls.map(control => <label key={control.name}>
        <span>{control.name}</span><output>{control.value} / {control.band.min}–{control.band.max}</output>
        <input type="range" min="0" max="100" aria-label={control.name} value={control.value} onChange={event => {
          const value = Number(event.currentTarget.value)
          control.change(value)
          if (value < control.band.min || value > control.band.max) { setReactorStart(null); setReactorProgress(0) }
        }} />
      </label>)}
      {locking && <progress className="reactor-lock" value={reactorProgress} max={1} aria-label={text.reactorLocking} />}
      <button className="recovery-task-action" type="button" disabled={!tuned || locking}
        onClick={() => setReactorStart(performance.now())}>{locking ? text.reactorLocking : text.stabilizeReactor}</button>
    </div> : <div className="recovery-ignition">
      <p>{gameText(language).diagnostics.memorizeTheSequenceThenActivateThe}</p>
      <div className="recovery-ignition-readout" aria-live="polite" data-failed={failed}>
        {ignition === 'preview' ? formatText(text.activeContact, { contact: RECOVERY_IGNITION.sequence[pulse] }) : failed ? text.wrongOrderStartAgain
          : formatText(text.ignitionProgress, { step, total: RECOVERY_IGNITION.sequence.length })}
      </div>
      <div className="recovery-ignition-pads">
        {RECOVERY_IGNITION.contacts.map(number => <button type="button" key={number} disabled={ignition !== 'enter'}
          data-pulse={number === activeContact} aria-label={`${text.contact} ${number}`} onClick={() => enter(number)}>{number}</button>)}
      </div>
      <button className="recovery-task-action" type="button" disabled={ignition === 'preview'}
        onClick={() => { setPulse(0); setStep(0); setFailed(false); setIgnition('preview') }}>{text.showSequence}</button>
    </div>)}
    <button className="recovery-launch" type="button" disabled={!tasksDone} onClick={onLaunch}>
      {gameText(language).diagnostics.startTheEnginesAndDepart} <span aria-hidden="true">↗</span>
    </button>
  </section>
}
