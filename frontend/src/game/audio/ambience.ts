export type AmbientLocation = 'title' | 'flight' | 'journal' | 'hangar'

export function ambientChord(location: AmbientLocation, sequence: number) {
  const roots = { title: 65.406, flight: 65.406, journal: 73.416, hangar: 55 }
  const progression = [0, 5, 7, 3]
  const root = roots[location] * 2 ** (progression[sequence % progression.length] / 12)
  return {
    frequencies: [root, root * 1.5, root * 2, root * 2.5],
    gain: location === 'hangar' ? 0.09 : location === 'journal' ? 0.1 : 0.085,
    cutoff: location === 'hangar' ? 520 : location === 'journal' ? 1100 : 850,
  }
}
