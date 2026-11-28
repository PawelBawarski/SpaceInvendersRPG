import { formatText, gameText, type GameLanguage } from '../i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FIRST_FLIGHT_VITALS } from '../domain/shipTelemetry'
import { createRecoveryChallenge, RECOVERY_CIRCUIT_TURNS, RECOVERY_COMPLETE_MASK, RECOVERY_IGNITION, RECOVERY_REACTOR, RECOVERY_TASK, RECOVERY_TASKS } from '../simulation/ShipRecovery'

const nextTask = (mask: number) => RECOVERY_TASKS.find(index => !(mask & 1 << index)) ?? RECOVERY_TASK.circuits
const CIRCUIT_ORIENTATIONS = 4
const BOARD_WIDTH = 328
const CIRCUIT_POSITIONS = [54, 164, 274]
const CIRCUIT_TRACES = ['M9 51H20', 'M54 85V109H111V51H130', 'M164 85V109H221V51H240', 'M274 85V109H308']
const OSCILLOSCOPE_WIDTH = 240
const OSCILLOSCOPE_STEPS = 64
const REACTOR_SAMPLE_MS = 45
const IGNITION_SAMPLE_MS = 45

function ignitionArc(target: number) {
  const start = -Math.PI / 2 + target - RECOVERY_IGNITION.toleranceRadians
  const end = -Math.PI / 2 + target + RECOVERY_IGNITION.toleranceRadians
  const radius = 44
  const x1 = 60 + Math.cos(start) * radius
  const y1 = 60 + Math.sin(start) * radius
  const x2 = 60 + Math.cos(end) * radius
  const y2 = 60 + Math.sin(end) * radius
  return `M 60 60 L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`
}

function reactorWave(voltage: number, frequency: number) {
  const amplitude = voltage * .44
  return Array.from({ length: OSCILLOSCOPE_STEPS + 1 }, (_, index) => {
    const phase = index / OSCILLOSCOPE_STEPS
    return `${phase * OSCILLOSCOPE_WIDTH},${36 - Math.sin(phase * frequency * .52) * amplitude}`
  }).join(' ')
}

export function LaunchDiagnostics({ mask, language, seed, onRepair, onLaunch }: {
  mask: number; language: GameLanguage; seed: number; onRepair: (mask: number) => void; onLaunch: () => void
}) {
  const challenge = useMemo(() => createRecoveryChallenge(seed), [seed])
  const referenceWave = useMemo(() => reactorWave(challenge.voltage.target, challenge.frequency.target), [challenge])
  const text = gameText(language).diagnostics
  const { labels, titles } = text
  const [task, setTask] = useState<number>(() => nextTask(mask))
  const [rotations, setRotations] = useState<number[]>(() => [...RECOVERY_CIRCUIT_TURNS])
  const [voltage, setVoltage] = useState<number>(challenge.voltage.initial)
  const [frequency, setFrequency] = useState<number>(challenge.frequency.initial)
  const [reactorStart, setReactorStart] = useState<number | null>(null)
  const [reactorProgress, setReactorProgress] = useState(0)
  const ignitionStartedAt = useRef(0)
  const [needleAngle, setNeedleAngle] = useState(0)
  const [step, setStep] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => { ignitionStartedAt.current = performance.now() }, [])
  const complete = useCallback((index: number) => {
    const next = mask | 1 << index
    onRepair(next)
    setTask(nextTask(next))
  }, [mask, onRepair])
  useEffect(() => {
    if (task !== RECOVERY_TASK.ignition || mask & 1 << RECOVERY_TASK.ignition) return
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - ignitionStartedAt.current) / 1000
      setNeedleAngle((elapsed / RECOVERY_IGNITION.rotationSeconds * Math.PI * 2) % (Math.PI * 2))
    }, IGNITION_SAMPLE_MS)
    return () => window.clearInterval(timer)
  }, [task, mask])
  const rotate = (index: number) => {
    const next = rotations.map((value, circuit) => circuit === index ? (value + 1) % CIRCUIT_ORIENTATIONS : value)
    setRotations(next)
    if (next.every(value => value === 0)) complete(RECOVERY_TASK.circuits)
  }
  const enter = () => {
    const angle = (performance.now() - ignitionStartedAt.current) / 1000 / RECOVERY_IGNITION.rotationSeconds * Math.PI * 2 % (Math.PI * 2)
    const target = challenge.ignitionTargets[step]
    const difference = Math.atan2(Math.sin(angle - target), Math.cos(angle - target))
    if (Math.abs(difference) > RECOVERY_IGNITION.toleranceRadians) { setStep(0); setFailed(true); return }
    setFailed(false)
    if (step === challenge.ignitionTargets.length - 1) complete(RECOVERY_TASK.ignition)
    else setStep(step + 1)
  }
  const controls = [
    { name: text.voltage, value: voltage, change: setVoltage, band: challenge.voltage },
    { name: text.frequency, value: frequency, change: setFrequency, band: challenge.frequency },
  ]
  const tuned = controls.every(control => Math.abs(control.value - control.band.target) <= control.band.tolerance)
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
        <span>{control.name}</span><output>{control.value} / {control.band.target}</output>
        <input type="range" min="0" max="100" aria-label={control.name} value={control.value} onChange={event => {
          const value = Number(event.currentTarget.value)
          control.change(value)
          if (Math.abs(value - control.band.target) > control.band.tolerance) { setReactorStart(null); setReactorProgress(0) }
        }} />
      </label>)}
      {locking && <progress className="reactor-lock" value={reactorProgress} max={1} aria-label={text.reactorLocking} />}
      <button className="recovery-task-action" type="button" disabled={!tuned || locking}
        onClick={() => setReactorStart(performance.now())}>{locking ? text.reactorLocking : text.stabilizeReactor}</button>
    </div> : <div className="recovery-ignition">
      <p>{text.alignTheIgnitionRing}</p>
      <p>{text.pressWhenNeedleEntersTheHighlightedArc}</p>
      <svg className="ignition-dial" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="48" className="ignition-track" />
        <path d={ignitionArc(challenge.ignitionTargets[step])} className="ignition-target" />
        <line x1="60" y1="60" x2={60 + Math.cos(needleAngle - Math.PI / 2) * 42}
          y2={60 + Math.sin(needleAngle - Math.PI / 2) * 42} className="ignition-needle" />
        <circle cx="60" cy="60" r="4" className="ignition-hub" />
      </svg>
      <div className="recovery-ignition-readout" aria-live="polite" data-failed={failed}>
        {failed ? text.missedIgnitionWindow : formatText(text.ignitionProgress, { step, total: challenge.ignitionTargets.length })}
      </div>
      <button className="recovery-task-action" type="button" onClick={enter}>{text.synchronizeIgnition}</button>
    </div>)}
    <button className="recovery-launch" type="button" disabled={!tasksDone} onClick={onLaunch}>
      {gameText(language).diagnostics.startTheEnginesAndDepart} <span aria-hidden="true">↗</span>
    </button>
  </section>
}
