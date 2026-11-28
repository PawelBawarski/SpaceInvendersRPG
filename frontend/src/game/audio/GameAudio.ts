import { getEngineSoundProfile, type EngineSoundProfile } from './engineSound'
import { ambientChord, type AmbientLocation } from './ambience'

export interface GameAudioLevels {
  main: number
  shots: number
  music: number
}

const SHOT_SOUND = { seconds: .24, bass: 72, metal: 204, bodyCutoff: 760, snapCutoff: 3200 } as const
const FOOTSTEP_SECONDS = 0.14

export function buildFootstepBuffer(context: AudioContext): AudioBuffer {
  const { sampleRate } = context
  const buffer = context.createBuffer(1, Math.ceil(sampleRate * FOOTSTEP_SECONDS), sampleRate)
  const samples = buffer.getChannelData(0)
  let seed = 20261
  let low = 0
  const response = 1 - Math.exp(-2 * Math.PI * 520 / sampleRate)
  for (let index = 0; index < samples.length; index++) {
    const seconds = index / sampleRate
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = seed / 0x80000000 - 1
    low += (noise - low) * response
    const attack = Math.min(1, seconds / 0.004)
    const tail = Math.max(0, 1 - seconds / FOOTSTEP_SECONDS)
    samples[index] = low * 0.5 * attack * tail * tail
  }
  return buffer
}

function buildShotBuffer(context: AudioContext): AudioBuffer {
  const { sampleRate } = context
  const buffer = context.createBuffer(1, Math.ceil(sampleRate * SHOT_SOUND.seconds), sampleRate)
  const samples = buffer.getChannelData(0)
  const bodyResponse = 1 - Math.exp(-2 * Math.PI * SHOT_SOUND.bodyCutoff / sampleRate)
  const snapResponse = 1 - Math.exp(-2 * Math.PI * SHOT_SOUND.snapCutoff / sampleRate)
  let seed = 49157
  let body = 0
  let snap = 0
  for (let index = 0; index < samples.length; index++) {
    const seconds = index / sampleRate
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = seed / 0x80000000 - 1
    body += (noise - body) * bodyResponse
    snap += (noise - snap) * snapResponse
    const attack = Math.min(1, seconds / .0025)
    const tail = Math.min(1, (SHOT_SOUND.seconds - seconds) / .025)
    const thump = Math.sin(2 * Math.PI * (SHOT_SOUND.bass * seconds + .45 * (1 - Math.exp(-seconds * 75)))) * .38 * Math.exp(-seconds * 26)
    const crack = (snap - body) * .66 * Math.exp(-seconds * 77)
    const pressure = body * .53 * Math.exp(-seconds * 18)
    const chamber = Math.sin(2 * Math.PI * SHOT_SOUND.metal * seconds) * .062 * Math.exp(-seconds * 33)
    samples[index] = (thump + crack + pressure + chamber) * attack * tail
  }
  return buffer
}

export class GameAudio {
  private readonly context: AudioContext | null
  private readonly masterGain: GainNode | null
  private readonly shotGain: GainNode | null
  private readonly musicGain: GainNode | null
  private shotBuffer: AudioBuffer | null = null
  private footstepBuffer: AudioBuffer | null = null
  private musicTimer: number | undefined
  private noteIndex = 0
  private musicStarted = false
  private engineTone: OscillatorNode | null = null
  private engineHarmonic: OscillatorNode | null = null
  private engineGain: GainNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private engineProfile = getEngineSoundProfile(0, 0)
  private appliedEngineProfile: EngineSoundProfile | null = null
  private readonly ambientEnabled: boolean
  private readonly engineEnabled: boolean
  private location: AmbientLocation = 'title'
  private ambientFilter: BiquadFilterNode | null = null
  private readonly voices = new Set<OscillatorNode>()
  private disposed = false

  constructor(levels: GameAudioLevels, options: { ambient?: boolean; engine?: boolean } = {}) {
    this.ambientEnabled = options.ambient !== false
    this.engineEnabled = options.engine !== false
    if (typeof window.AudioContext === 'undefined') {
      this.context = null
      this.masterGain = null
      this.shotGain = null
      this.musicGain = null
      return
    }

    this.context = new window.AudioContext()
    this.masterGain = this.context.createGain()
    this.shotGain = this.context.createGain()
    this.musicGain = this.context.createGain()
    this.masterGain.gain.value = levels.main
    this.shotGain.gain.value = levels.shots
    this.musicGain.gain.value = levels.music * 0.3
    this.shotGain.connect(this.masterGain)
    if (this.ambientEnabled) {
      const filter = this.context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 850
      filter.Q.value = 0.35
      this.ambientFilter = filter
      this.musicGain.connect(filter)
      filter.connect(this.masterGain)
      const delay = this.context.createDelay(2)
      const feedback = this.context.createGain()
      const wet = this.context.createGain()
      delay.delayTime.value = 0.58
      feedback.gain.value = 0.22
      wet.gain.value = 0.18
      filter.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(wet)
      wet.connect(this.masterGain)
    }
    this.masterGain.connect(this.context.destination)
  }

  resume(): Promise<void> {
    if (!this.context || this.context.state === 'closed' || this.disposed) return Promise.resolve()

    return this.context.resume().then(() => {
      if (this.disposed) return
      if (this.engineEnabled) this.startEngine()
      if (!this.ambientEnabled || (this.musicStarted && this.musicTimer !== undefined)) return
      this.musicStarted = true
      this.playAmbientNote()
    }).catch((error: unknown) => {
      console.error('Unable to start Neon Void audio.', error)
    })
  }

  setAmbience(location: AmbientLocation): void {
    this.location = location
    if (this.context && this.ambientFilter && !this.disposed) this.ambientFilter.frequency.setTargetAtTime(ambientChord(location, this.noteIndex).cutoff, this.context.currentTime, 1)
  }

  playUiSound(kind: 'open' | 'close' | 'hover' | 'confirm' | 'dock' = 'confirm'): void {
    if (!this.context || !this.masterGain || this.context.state !== 'running' || this.disposed) return
    const now = this.context.currentTime
    const tone = this.context.createOscillator()
    const envelope = this.context.createGain()
    const duration = kind === 'dock' ? 0.6 : kind === 'hover' ? 0.07 : 0.18
    const frequency = { open: 620, close: 420, hover: 910, confirm: 740, dock: 125 }[kind]
    tone.type = 'sine'
    tone.frequency.setValueAtTime(frequency, now)
    tone.frequency.exponentialRampToValueAtTime(frequency * (kind === 'close' || kind === 'dock' ? 0.7 : 1.18), now + duration)
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(kind === 'hover' ? 0.004 : 0.022, now + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    tone.connect(envelope)
    envelope.connect(this.masterGain)
    this.voices.add(tone)
    tone.onended = () => { tone.disconnect(); envelope.disconnect(); this.voices.delete(tone) }
    tone.start(now)
    tone.stop(now + duration + 0.02)
  }

  updateEngine(speedRatio: number, thrust: number): EngineSoundProfile {
    this.engineProfile = getEngineSoundProfile(speedRatio, thrust)
    this.applyEngineProfile()
    return this.engineProfile
  }

  private startEngine(): void {
    if (!this.context || !this.masterGain || this.engineTone) return
    const tone = this.context.createOscillator()
    const harmonic = this.context.createOscillator()
    const filter = this.context.createBiquadFilter()
    const gain = this.context.createGain()
    const harmonicGain = this.context.createGain()
    tone.type = 'triangle'
    harmonic.type = 'sine'
    filter.type = 'lowpass'
    filter.Q.value = 0.55
    gain.gain.value = 0
    harmonicGain.gain.value = 0.22
    tone.connect(filter)
    harmonic.connect(harmonicGain)
    harmonicGain.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    this.engineTone = tone
    this.engineHarmonic = harmonic
    this.engineGain = gain
    this.engineFilter = filter
    tone.start()
    harmonic.start()
    this.applyEngineProfile()
  }

  private applyEngineProfile(): void {
    if (!this.context || this.context.state === 'closed' || !this.engineGain || !this.engineTone || !this.engineHarmonic || !this.engineFilter) return
    const next = this.engineProfile
    const old = this.appliedEngineProfile
    if (old && old.mode === next.mode && Math.abs(old.gain - next.gain) < 0.0002 && Math.abs(old.frequency - next.frequency) < 0.5) return
    const now = this.context.currentTime
    this.engineGain.gain.setTargetAtTime(next.gain, now, 0.12)
    this.engineTone.frequency.setTargetAtTime(next.frequency, now, 0.15)
    this.engineHarmonic.frequency.setTargetAtTime(next.frequency * 1.5, now, 0.15)
    this.engineFilter.frequency.setTargetAtTime(next.cutoff, now, 0.12)
    this.appliedEngineProfile = next
  }

  updateLevels(levels: GameAudioLevels): void {
    if (!this.context || !this.masterGain || !this.shotGain || !this.musicGain) return

    const now = this.context.currentTime
    this.masterGain.gain.setTargetAtTime(levels.main, now, 0.04)
    this.shotGain.gain.setTargetAtTime(levels.shots, now, 0.04)
    this.musicGain.gain.setTargetAtTime(levels.music * 0.3, now, 0.04)
  }

  playFootstep(run = false): void {
    if (!this.context || !this.masterGain || this.context.state !== 'running' || this.disposed) return
    this.footstepBuffer ??= buildFootstepBuffer(this.context)
    const step = this.context.createBufferSource()
    step.buffer = this.footstepBuffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = run ? 900 : 600
    const gain = this.context.createGain()
    gain.gain.value = run ? 0.05 : 0.035
    step.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    step.onended = () => { step.disconnect(); filter.disconnect(); gain.disconnect() }
    step.start()
  }

  playShot(): void {
    if (!this.context || !this.shotGain || this.context.state !== 'running' || this.disposed) return
    this.shotBuffer ??= buildShotBuffer(this.context)
    const shot = this.context.createBufferSource()
    shot.buffer = this.shotBuffer
    shot.connect(this.shotGain)
    shot.onended = () => shot.disconnect()
    shot.start()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.engineTone?.stop()
    this.engineHarmonic?.stop()
    if (this.musicTimer !== undefined) window.clearTimeout(this.musicTimer)
    for (const voice of this.voices) voice.stop()
    this.voices.clear()
    if (this.context && this.context.state !== 'closed') {
      void this.context.close().catch((error: unknown) => {
        console.error('Unable to close Neon Void audio.', error)
      })
    }
  }

  private playAmbientNote(): void {
    if (!this.context || !this.musicGain || this.context.state !== 'running') return

    const now = this.context.currentTime
    const chord = ambientChord(this.location, this.noteIndex)
    for (const [index, frequency] of chord.frequencies.entries()) {
      const tone = this.context.createOscillator()
      const envelope = this.context.createGain()
      const pan = this.context.createStereoPanner()
      tone.type = 'sine'
      tone.frequency.value = frequency
      tone.detune.value = index % 2 === 0 ? -3 : 3
      pan.pan.value = [-0.3, 0.3, -0.15, 0.15][index]
      envelope.gain.setValueAtTime(0.0001, now)
      envelope.gain.exponentialRampToValueAtTime(chord.gain * (index > 1 ? 0.65 : 1), now + 1.1)
      envelope.gain.exponentialRampToValueAtTime(chord.gain * 0.65, now + 2.8)
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 7.4)
      tone.connect(envelope)
      envelope.connect(pan)
      pan.connect(this.musicGain)
      this.voices.add(tone)
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); pan.disconnect(); this.voices.delete(tone) }
      tone.start(now)
      tone.stop(now + 7.5)
    }
    this.noteIndex += 1
    this.musicTimer = window.setTimeout(() => { this.musicTimer = undefined; this.playAmbientNote() }, 4200)
  }
}
