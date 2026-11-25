import type { PlanetSite, StationSite, SunSite } from './exploration'

export interface GalaxyBounds { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
export const GALAXY_BOUNDS: Readonly<GalaxyBounds> = { minX: -1600000, maxX: 1600000, minY: -1200000, maxY: 1200000, minZ: 0, maxZ: 7200000 }
export const PLANET_SURFACE_SPACING = 160000
const names = ['Echo Syren', 'Zimna Latarnia', 'Próg Ciszy', 'Rubinowa Zatoka', 'Szary Bastion', 'Oko Wędrowca', 'Nocny Przylądek', 'Morska Iglica', 'Pusty Tron', 'Gwiezdny Popiół', 'Szept Rubieży', 'Ostatnia Przystań', 'Złoty Pył', 'Mglisty Kanion', 'Srebrny Brzeg', 'Obcy Horyzont', 'Kamienny Świt', 'Lodowa Korona', 'Ciemny Przesmyk', 'Głęboka Studnia', 'Nieznany Sad', 'Błękitna Skała', 'Zew Otchłani', 'Nowy Meridian']
const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** Seed zero is the expanded legacy chart. Other seeds are stored with each new campaign. */
export function buildGalaxyLayout(base: readonly PlanetSite[], seed: number, stations: readonly StationSite[], sun: SunSite): PlanetSite[] {
  let state = seed >>> 0 || 7919
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
  const sources = [...base, ...names.map((name, index): PlanetSite => ({
    id: `uncharted-${index + 1}`, name: { pl: name, en: `Meridian frontier ${index + 1}` },
    description: { pl: 'Odległy świat. Skanery rejestrują ślady obcych cywilizacji.', en: 'A distant world with traces of foreign civilizations.' },
    color: ['#61839d', '#9a735c', '#627d69', '#777397'][index % 4], radius: 9000 + index % 7 * 4200,
    x: (index % 2 ? -1 : 1) * (180000 + index * 38000), y: (index % 5 - 2) * 125000, z: 5450000 + index * 55000,
  }))]
  // Keep the authored inner worlds available to their contracts and draw the outer worlds from the campaign seed.
  const innerWorlds = sources.slice(0, 19)
  const outerWorlds = sources.slice(innerWorlds.length)
  for (let index = outerWorlds.length - 1; index > 0; index -= 1) {
    const selection = Math.floor(random() * (index + 1))
    ;[outerWorlds[index], outerWorlds[selection]] = [outerWorlds[selection], outerWorlds[index]]
  }
  const selected = [...innerWorlds, ...outerWorlds.slice(0, Math.round(sources.length * 0.75) - innerWorlds.length)]
  const placed: PlanetSite[] = []
  for (const [index, source] of selected.entries()) {
    const radius = source.radius * 1.5
    let position = index < innerWorlds.length ? { x: source.x * 2.4, y: source.y * 2.4, z: source.z * 2.4 } : { x: source.x, y: source.y, z: source.z }
    const safe = () => placed.every(other => distance(position, other) > radius + other.radius + PLANET_SURFACE_SPACING
      && Math.hypot(position.x - other.x, position.z - other.z) > 85000)
      && position.x - radius >= GALAXY_BOUNDS.minX && position.x + radius <= GALAXY_BOUNDS.maxX
      && position.y - radius >= GALAXY_BOUNDS.minY && position.y + radius <= GALAXY_BOUNDS.maxY
      && position.z - radius >= GALAXY_BOUNDS.minZ && position.z + radius <= GALAXY_BOUNDS.maxZ
      && stations.every(station => distance(position, station) > radius + station.radius + 12000)
      && distance(position, sun) > radius + sun.radius + sun.heatRange + 30000
    if (seed !== 0 || !safe()) {
      let attempts = 0
      do {
        position = index === 0 ? { x: (random() - 0.5) * 24000, y: (random() - 0.5) * 8000, z: 65000 + random() * 25000 }
          : { x: (random() - 0.5) * 2600000, y: (random() - 0.5) * 1700000, z: 170000 + random() * 6600000 }
        if (++attempts > 10000) throw new Error('Unable to place a safe galaxy layout')
      } while (!safe())
    }
    const orbitalFaction = source.id === 'quiet-foundry' ? 'ashen-legion'
      : index % 4 === 0 || index === 1 ? (['null-cult', 'nacre', 'ashen-legion', 'meridian'] as const)[Math.floor(index / 4) % 4] : undefined
    placed.push({ ...source, ...position, radius, orbitalFaction, hasHangar: index % 8 === 0 })
  }
  return placed
}

export function buildPlanetHangars(planets: readonly PlanetSite[]): StationSite[] {
  return planets.filter(planet => planet.hasHangar).map(planet => ({
    id: `surface-${planet.id}`, planetId: planet.id,
    name: { pl: `Port · ${planet.name.pl}`, en: `Port · ${planet.name.en}` },
    x: planet.x, y: planet.y, z: planet.z - planet.radius - 180, radius: 140, dockingRange: 700,
    launchPosition: { x: planet.x, y: planet.y, z: planet.z - planet.radius - 650 }, faction: 'meridian', color: '#a2d9b6',
  }))
}
