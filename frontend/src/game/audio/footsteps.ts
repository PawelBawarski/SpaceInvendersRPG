import { buildFootstepBuffer } from './GameAudio'

let context: AudioContext | null = null
let buffer: AudioBuffer | null = null

function ensureContext(): AudioContext | null {
  if (typeof window.AudioContext === 'undefined') return null
  context ??= new window.AudioContext()
  if (context.state === 'suspended') void context.resume().catch(() => {})
  return context
}

/** Lightweight footstep for on-foot scenes; lazily creates its own audio context. */
export function playFootstep(run = false): void {
  const ctx = ensureContext()
  if (!ctx || ctx.state !== 'running') return
  buffer ??= buildFootstepBuffer(ctx)
  const step = ctx.createBufferSource()
  step.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = run ? 900 : 600
  const gain = ctx.createGain()
  gain.gain.value = run ? 0.05 : 0.035
  step.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  step.onended = () => { step.disconnect(); filter.disconnect(); gain.disconnect() }
  step.start()
}