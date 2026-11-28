import { localizedText, type LocalizedText } from '../i18n'

export type SignalKind = 'distress' | 'echo' | 'anomaly'

export interface SignalSite {
  id: string
  name: LocalizedText
  kind: SignalKind
  x: number
  y: number
  z: number
}

/** Derelict beacons and strange echoes scattered near the Orion start. */
export const SIGNALS: readonly SignalSite[] = [
  {
    id: 'signal-derelict-01',
    name: localizedText((_t, l) => l === 'pl' ? 'Sygnał: dryfujący wrak' : 'Signal: drifting wreck'),
    kind: 'distress',
    x: -2600, y: 300, z: 4200,
  },
  {
    id: 'signal-echo-02',
    name: localizedText((_t, l) => l === 'pl' ? 'Echo: nieznany ślad' : 'Echo: unknown trace'),
    kind: 'echo',
    x: 3400, y: -200, z: 6800,
  },
  {
    id: 'signal-anomaly-03',
    name: localizedText((_t, l) => l === 'pl' ? 'Anomalia: pęknięcie w polu' : 'Anomaly: field fracture'),
    kind: 'anomaly',
    x: 800, y: 600, z: 9600,
  },
]

export function getSignal(id: string): SignalSite | undefined {
  return SIGNALS.find(signal => signal.id === id)
}