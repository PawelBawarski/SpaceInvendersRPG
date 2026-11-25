import { resolveWeaponHit } from './weapon'
import { createWorldShip, type FactionId, type ShipArchetype } from './worldFactions'
import type { MissionId } from '../missions/definitions'
import { sampleFormationPosition, samplePatrolRoute, type PatrolFormation } from './patrolFormation'
import { buildDeepSpacePopulation } from './worldPopulation'
export { createWorldShip, FACTIONS, SHIP_ARCHETYPES } from './worldFactions'
export type { FactionId, ShipArchetype, CombatShipProfile } from './worldFactions'

export interface SectorPosition {
  x: number
  y: number
  z: number
}

export interface PlanetSite extends SectorPosition {
  id: string
  name: { pl: string; en: string }
  description: { pl: string; en: string }
  color: string
  radius: number
}

export interface DroneSite extends SectorPosition {
  id: string
  health: number
  faction?: FactionId
  archetype?: ShipArchetype
  damage?: number
  attackInterval?: number
  attackRange?: number
  projectileSpeed?: number
  speed?: number
  missionId?: MissionId
  formation?: PatrolFormation
}

export interface StationSite extends SectorPosition {
  id: string
  name: { pl: string; en: string }
  radius: number
  dockingRange: number
  launchPosition: SectorPosition
  faction: FactionId
  color: string
}

export interface SunSite extends SectorPosition {
  id: string
  name: { pl: string; en: string }
  radius: number
  /** Distance from the photosphere at which thermal exposure begins. */
  heatRange: number
}

export const ORION_SECTOR_ID = 'orion-7'

export const ORION_SECTOR_BOUNDS = {
  minX: -560000,
  maxX: 560000,
  minY: -350000,
  maxY: 350000,
  minZ: 0,
  maxZ: 3000000,
} as const

export const ORION_SUN: Readonly<SunSite> = {
  id: 'meridian-sun', name: { pl: 'Słońce Meridian', en: 'Meridian Sun' },
  x: 153600, y: 40960, z: 1945600, radius: 192000, heatRange: 20000,
}

export const ORION_START_POSITION: Readonly<SectorPosition> = { x: 0, y: 0, z: 0 }

export const ORION_STATIONS: readonly StationSite[] = [
  {
    id: 'meridian-haven', name: { pl: 'Przystań Meridian', en: 'Meridian Haven' },
    x: 0, y: 0, z: 1800, radius: 180, dockingRange: 440,
    launchPosition: { x: 0, y: 0, z: 1480 }, faction: 'meridian', color: '#78cfff',
  },
  {
    id: 'nacre-crossing', name: { pl: 'Węzeł Nacre', en: 'Nacre Crossing' },
    x: -3600, y: 800, z: 23500, radius: 240, dockingRange: 520,
    launchPosition: { x: -3600, y: 800, z: 23120 }, faction: 'nacre', color: '#73edd3',
  },
  {
    id: 'foundry-bastion', name: { pl: 'Bastion Kuźni', en: 'Foundry Bastion' },
    x: 4200, y: 1400, z: 42000, radius: 300, dockingRange: 600,
    launchPosition: { x: 4200, y: 1400, z: 41560 }, faction: 'meridian', color: '#ffbd7b',
  },
]

const PREVIOUS_ORION_PLANETS: readonly PlanetSite[] = [
  {
    id: 'glass-moon',
    name: { pl: 'Szklany Księżyc', en: 'Glass Moon' },
    description: {
      pl: 'Pęknięta skorupa odbija ślady dawnego szlaku. Skaner wykrywa metal i miedź.',
      en: 'Its fractured crust reflects an old transit route. Scanners detect alloy and copper.',
    },
    color: '#65a9c8',
    radius: 16,
    x: 0,
    y: 0,
    z: 528,
  },
  {
    id: 'ember-world',
    name: { pl: 'Popielny Świat', en: 'Ember World' },
    description: {
      pl: 'Radioaktywne burze przesuwają się nad nocną stroną. Wartość: rzadkie pozostałości.',
      en: 'Radioactive storms roll over its dark side. Valuable residue readings.',
    },
    color: '#c77951',
    radius: 24,
    x: 384,
    y: -144,
    z: 1800,
  },
  {
    id: 'meridian-wreck',
    name: { pl: 'Wrak Meridian', en: 'Meridian Wreck' },
    description: {
      pl: 'Kadłub dawnej jednostki patrolowej. Sygnał ratunkowy urywa się w połowie nazwiska.',
      en: 'A former patrol craft. Its distress call cuts off halfway through a name.',
    },
    color: '#8a83c9',
    radius: 16,
    x: -480,
    y: 216,
    z: 3384,
  },
  {
    id: 'veil-archive',
    name: { pl: 'Archiwum Mgławicy', en: 'Veil Archive' },
    description: {
      pl: 'Ruiny stacji tkwią w lodowej skorupie. Sygnał w środku nie pochodzi z żadnego znanego nadajnika.',
      en: 'Station ruins are trapped in an icy crust. The signal inside matches no known transmitter.',
    },
    color: '#82c6c1',
    radius: 20,
    x: 648,
    y: -240,
    z: 4440,
  },
  {
    id: 'hollow-comet',
    name: { pl: 'Pusta Kometa', en: 'Hollow Comet' },
    description: {
      pl: 'Kometa skrywa w lodowym jądrze ślady starych przelotów. Czujniki wychwytują metal i radioaktywny pył.',
      en: 'The comet hides traces of old passages in its icy core. Sensors detect alloy and radioactive dust.',
    },
    color: '#78bed9',
    radius: 22,
    x: -696,
    y: -336,
    z: 2520,
  },
  {
    id: 'quiet-foundry',
    name: { pl: 'Cicha Kuźnia', en: 'Quiet Foundry' },
    description: {
      pl: 'Opuszczona stocznia wciąż emituje ciepło. Ktoś wygasił ją niedawno, nie dekady temu.',
      en: 'The abandoned shipyard still radiates heat. It was shut down recently, not decades ago.',
    },
    color: '#bd8d66',
    radius: 28,
    x: 120,
    y: 336,
    z: 3960,
  },
  {
    id: 'nacre-reef',
    name: { pl: 'Rafa Nacre', en: 'Nacre Reef' },
    description: {
      pl: 'Skupisko kryształów odbija sygnały kurierów. Załoga może tu znaleźć miedź i rzadkie pozostałości.',
      en: 'A field of crystals reflects courier signals. The crew may recover copper and rare residue here.',
    },
    color: '#8b79c9',
    radius: 18,
    x: -192,
    y: 120,
    z: 4920,
  },
  {
    id: 'ashen-crown',
    name: { pl: 'Korona Popiołu', en: 'Ashen Crown' },
    description: {
      pl: 'Na tle rdzawej atmosfery widać szczątki orbitalnego doku. Jego sygnał nawigacyjny nadal wyznacza dawny szlak.',
      en: 'The remains of an orbital dock hang against a rust-colored atmosphere. Its navigation beacon still marks the old route.',
    },
    color: '#b67c59',
    radius: 30,
    x: 680,
    y: 220,
    z: 820,
  },
  {
    id: 'pale-sanctum',
    name: { pl: 'Blada Przystań', en: 'Pale Haven' },
    description: {
      pl: 'Jasne równiny pokrywają opuszczone kopuły kolonii. Pod lodem skaner rozpoznaje regularne pasy dawnych lądowisk.',
      en: 'Pale plains cover an abandoned colony’s domes. Beneath the ice, the scanner detects regular strips of old landing fields.',
    },
    color: '#b9c8bd',
    radius: 20,
    x: -340,
    y: 130,
    z: 1120,
  },
  {
    id: 'obsidian-tide',
    name: { pl: 'Obsydianowy Przypływ', en: 'Obsidian Tide' },
    description: {
      pl: 'Ciemny ocean otacza zastygłe wyspy. Na nocnej stronie odbijają się krótkie impulsy z nieczynnej sieci Meridian.',
      en: 'A dark ocean surrounds frozen islands. Brief pulses from the dormant Meridian network reflect across the night side.',
    },
    color: '#6e689a',
    radius: 32,
    x: 110,
    y: -250,
    z: 1510,
  },
  {
    id: 'cinder-vault',
    name: { pl: 'Skarbiec Żaru', en: 'Cinder Vault' },
    description: {
      pl: 'Warstwy pyłu zasłaniają dawne kopalnie. Wśród kraterów zachowały się metalowe śluzy pozbawione oznaczeń.',
      en: 'Layers of dust conceal old mines. Unmarked metal airlocks remain among the craters.',
    },
    color: '#bb654e',
    radius: 27,
    x: -730,
    y: 320,
    z: 1930,
  },
  {
    id: 'sable-garden',
    name: { pl: 'Ogród Cienia', en: 'Shadow Garden' },
    description: {
      pl: 'Zielonkawe pasma chmur otaczają pasmo stacji badawczych. Ich rejestry urywają się w dniu, w którym zamilkły szlaki.',
      en: 'Green cloud bands surround a chain of research stations. Their records end on the day the routes fell silent.',
    },
    color: '#588f7c',
    radius: 24,
    x: 730,
    y: -410,
    z: 2220,
  },
  {
    id: 'frost-threshold',
    name: { pl: 'Mroźny Próg', en: 'Frost Threshold' },
    description: {
      pl: 'Pęknięcia lodowej skorupy układają się wokół starego przekaźnika. Zasypany port oznaczono jeszcze kodem pierwszej ekspedycji.',
      en: 'Cracks in the icy crust circle an old relay. The buried port still bears the first expedition’s code.',
    },
    color: '#84b4cf',
    radius: 26,
    x: 310,
    y: 405,
    z: 2820,
  },
  {
    id: 'rusted-orbit',
    name: { pl: 'Rdzawa Orbita', en: 'Rusted Orbit' },
    description: {
      pl: 'Pył z wyschniętych mórz barwi powierzchnię na pomarańczowo. Nad dawnym równikiem krążą kadłuby statków towarowych.',
      en: 'Dust from dry seas stains the surface orange. Freighter hulls drift above the former equator.',
    },
    color: '#b78c59',
    radius: 19,
    x: -210,
    y: -390,
    z: 3120,
  },
  {
    id: 'lumen-basin',
    name: { pl: 'Kotlina Lumen', en: 'Lumen Basin' },
    description: {
      pl: 'Turkusowe wiry przesuwają się nad głęboką atmosferą. Sygnały boi pochodzą z konwoju, którego nie ma w żadnym dzienniku.',
      en: 'Turquoise vortices move through a deep atmosphere. Its buoys transmit the signature of a convoy absent from every log.',
    },
    color: '#5caaa8',
    radius: 35,
    x: 640,
    y: 95,
    z: 3560,
  },
  {
    id: 'dusk-citadel',
    name: { pl: 'Cytadela Zmierzchu', en: 'Dusk Citadel' },
    description: {
      pl: 'Na granicy światła i cienia wyrastają pozostałości fortyfikacji. Ostatnia stacja obronna powtarza pusty raport o gotowości.',
      en: 'Fortification remains rise along the terminator. The last defense station repeats an empty readiness report.',
    },
    color: '#777fae',
    radius: 31,
    x: -820,
    y: -120,
    z: 3830,
  },
  {
    id: 'silent-marsh',
    name: { pl: 'Milczące Rozlewisko', en: 'Silent Marsh' },
    description: {
      pl: 'Ciemne niziny przecina sieć porzuconych kanałów. Czujniki odnajdują równe rzędy fundamentów pod grubą warstwą osadu.',
      en: 'A network of abandoned canals crosses dark lowlands. Sensors find even rows of foundations beneath thick sediment.',
    },
    color: '#718f70',
    radius: 23,
    x: -395,
    y: 410,
    z: 4250,
  },
  {
    id: 'black-lantern',
    name: { pl: 'Czarna Latarnia', en: 'Black Lantern' },
    description: {
      pl: 'Samotna wieża na powierzchni była punktem odniesienia dla kurierów. Jej identyfikator nadal pojawia się w uszkodzonych mapach.',
      en: 'A lone surface tower once guided courier ships. Its identifier still appears in corrupted charts.',
    },
    color: '#777b8d',
    radius: 29,
    x: 385,
    y: -390,
    z: 4750,
  },
  {
    id: 'meridian-reach',
    name: { pl: 'Kres Meridian', en: 'Meridian Reach' },
    description: {
      pl: 'Za błękitnymi pasmami ostatniej dużej planety szlak znika z mapy. W odczycie pozostał tylko znak Czarnego Meridianu.',
      en: 'Beyond the blue bands of the final major planet, the route vanishes from the chart. Only the Black Meridian mark remains.',
    },
    color: '#658aaa',
    radius: 38,
    x: 60,
    y: 80,
    z: 5260,
  },
]

const FRONTIER_PLANETS: readonly PlanetSite[] = [
  { id: 'aurora-expanse', name: { pl: 'Zorza Graniczna', en: 'Frontier Aurora' }, color: '#668ea8', x: -9000, y: 3200, z: 61000, radius: 580 },
  { id: 'iron-veil', name: { pl: 'Żelazna Zasłona', en: 'Iron Veil' }, color: '#956f62', x: 14000, y: -6000, z: 70000, radius: 720 },
  { id: 'jade-silence', name: { pl: 'Jadeitowa Cisza', en: 'Jade Silence' }, color: '#548d76', x: -18000, y: -2200, z: 79000, radius: 460 },
  { id: 'titan-rest', name: { pl: 'Spoczynek Tytana', en: 'Titan Rest' }, color: '#ac8763', x: 6000, y: 8500, z: 88000, radius: 1300 },
  { id: 'silver-requiem', name: { pl: 'Srebrne Requiem', en: 'Silver Requiem' }, color: '#a4b1b7', x: 22000, y: -9000, z: 97000, radius: 510 },
  { id: 'cobalt-depths', name: { pl: 'Kobaltowa Głębia', en: 'Cobalt Depths' }, color: '#42669c', x: -12000, y: 13000, z: 106000, radius: 980 },
  { id: 'ember-cathedral', name: { pl: 'Katedra Żaru', en: 'Ember Cathedral' }, color: '#a95c49', x: 19000, y: 2000, z: 115000, radius: 640 },
  { id: 'opal-drift', name: { pl: 'Opalowy Dryf', en: 'Opal Drift' }, color: '#82a5b1', x: -25000, y: -8000, z: 124000, radius: 420 },
  { id: 'storm-cradle', name: { pl: 'Kolebka Burz', en: 'Storm Cradle' }, color: '#8f7da8', x: 9000, y: 14000, z: 133000, radius: 1500 },
  { id: 'pilgrim-stone', name: { pl: 'Kamień Pielgrzyma', en: 'Pilgrim Stone' }, color: '#8d8c75', x: -5000, y: -14000, z: 142000, radius: 360 },
  { id: 'nacre-throne', name: { pl: 'Tron Nacre', en: 'Nacre Throne' }, color: '#5aaca1', x: 25000, y: -5000, z: 151000, radius: 780 },
  { id: 'night-estuary', name: { pl: 'Ujście Nocy', en: 'Night Estuary' }, color: '#605780', x: -20000, y: 7000, z: 160000, radius: 590 },
  { id: 'rust-colossus', name: { pl: 'Rdzawy Kolos', en: 'Rusted Colossus' }, color: '#ad794f', x: -3000, y: -10000, z: 169000, radius: 1250 },
  { id: 'frozen-psalm', name: { pl: 'Zamarznięty Psalm', en: 'Frozen Psalm' }, color: '#8cb4c4', x: -26000, y: -2000, z: 178000, radius: 670 },
  { id: 'black-mirror', name: { pl: 'Czarne Zwierciadło', en: 'Black Mirror' }, color: '#626976', x: -15000, y: 14000, z: 187000, radius: 840 },
  { id: 'last-garden', name: { pl: 'Ostatni Ogród', en: 'Last Garden' }, color: '#6c9b73', x: -18000, y: 10000, z: 198000, radius: 560 },
  { id: 'horizon-end', name: { pl: 'Koniec Horyzontu', en: 'Horizon End' }, color: '#6489a9', x: -12000, y: -8000, z: 210000, radius: 1100 },
].map(planet => ({
  ...planet,
  description: {
    pl: 'Odległy świat poza dawnymi szlakami. Skaner wykrywa złoża surowców i ślady obcych patroli.',
    en: 'A remote world beyond the old routes. Scanners detect resources and traces of foreign patrols.',
  },
}))

const OUTER_REACH_PLANETS: readonly PlanetSite[] = [
  { id: 'blue-threshold', name: { pl: 'Błękitny Próg', en: 'Blue Threshold' }, color: '#6496bd', x: -36000, y: -12000, z: 222000, radius: 1400 },
  { id: 'amber-vault', name: { pl: 'Bursztynowy Skarbiec', en: 'Amber Vault' }, color: '#bd985d', x: 34000, y: 22000, z: 230000, radius: 2600 },
  { id: 'frost-prism', name: { pl: 'Mroźny Pryzmat', en: 'Frost Prism' }, color: '#8fb7c9', x: -51000, y: 14000, z: 238000, radius: 1000 },
  { id: 'goliath-ocean', name: { pl: 'Ocean Goliata', en: 'Goliath Ocean' }, color: '#426ba8', x: 8000, y: -26000, z: 246000, radius: 3800 },
  { id: 'red-pilgrimage', name: { pl: 'Czerwona Pielgrzymka', en: 'Red Pilgrimage' }, color: '#ba6d57', x: 56000, y: -14000, z: 254000, radius: 2000 },
  { id: 'emerald-crown', name: { pl: 'Szmaragdowa Korona', en: 'Emerald Crown' }, color: '#5e9879', x: -24000, y: 28000, z: 262000, radius: 3000 },
  { id: 'violet-observatory', name: { pl: 'Fioletowe Obserwatorium', en: 'Violet Observatory' }, color: '#937bb4', x: 42000, y: 4000, z: 270000, radius: 1500 },
  { id: 'titan-nocturne', name: { pl: 'Nokturn Tytana', en: 'Titan Nocturne' }, color: '#6c7d9f', x: -58000, y: -24000, z: 278000, radius: 4200 },
  { id: 'white-cairn', name: { pl: 'Biały Kurhan', en: 'White Cairn' }, color: '#b4bec0', x: -8000, y: -8000, z: 286000, radius: 1100 },
  { id: 'copper-dawn', name: { pl: 'Miedziany Świt', en: 'Copper Dawn' }, color: '#b88961', x: 23000, y: 31000, z: 294000, radius: 2400 },
  { id: 'serpent-depth', name: { pl: 'Głębia Węża', en: 'Serpent Depth' }, color: '#5a9291', x: -42000, y: 14000, z: 302000, radius: 1700 },
  { id: 'silent-giant', name: { pl: 'Milczący Olbrzym', en: 'Silent Giant' }, color: '#a3987a', x: 56000, y: -28000, z: 310000, radius: 3300 },
  { id: 'indigo-witness', name: { pl: 'Indygowy Świadek', en: 'Indigo Witness' }, color: '#646eac', x: -16000, y: 3000, z: 318000, radius: 2200 },
  { id: 'broken-coral', name: { pl: 'Pęknięty Koral', en: 'Broken Coral' }, color: '#ac7974', x: -56000, y: 27000, z: 326000, radius: 1900 },
  { id: 'oath-of-stone', name: { pl: 'Przysięga Kamienia', en: 'Oath of Stone' }, color: '#9a8d76', x: -28000, y: -22000, z: 334000, radius: 3800 },
  { id: 'jade-reliquary', name: { pl: 'Jadeitowy Relikwiarz', en: 'Jade Reliquary' }, color: '#7aa590', x: -48000, y: 7000, z: 342000, radius: 1400 },
  { id: 'last-anthem', name: { pl: 'Ostatni Hymn', en: 'Last Anthem' }, color: '#a098b5', x: -36000, y: 31000, z: 350000, radius: 2600 },
  { id: 'deep-blue-throne', name: { pl: 'Tron Otchłani', en: 'Abyssal Throne' }, color: '#466e9c', x: -59000, y: -18000, z: 358000, radius: 4100 },
  { id: 'pilgrim-haven', name: { pl: 'Azyl Pielgrzyma', en: 'Pilgrim Haven' }, color: '#93aaa4', x: -31000, y: -28000, z: 366000, radius: 1800 },
  { id: 'ash-garden', name: { pl: 'Ogród Popiołu', en: 'Ash Garden' }, color: '#9c8170', x: -52000, y: 24000, z: 374000, radius: 3100 },
  { id: 'crystal-dusk', name: { pl: 'Kryształowy Zmierzch', en: 'Crystal Dusk' }, color: '#8b9cb7', x: -40000, y: -10000, z: 382000, radius: 1600 },
  { id: 'eternal-drift', name: { pl: 'Wieczny Dryf', en: 'Eternal Drift' }, color: '#6b929d', x: -61000, y: 8000, z: 394000, radius: 2700 },
  { id: 'meridian-colossus', name: { pl: 'Kolos Meridian', en: 'Meridian Colossus' }, color: '#8d817d', x: -29000, y: -29000, z: 406000, radius: 3900 },
  { id: 'beyond-the-veil', name: { pl: 'Za Zasłoną', en: 'Beyond the Veil' }, color: '#7888ba', x: -50000, y: 25000, z: 420000, radius: 2300 },
].map(planet => ({ ...planet, description: {
  pl: 'Ogromny świat na rubieżach Meridian. Wokół złóż krążą uzbrojone patrole.',
  en: 'A vast world on the Meridian frontier. Armed patrols circle its deposits.',
} }))

export const ORION_PLANETS: readonly PlanetSite[] = [
  ...PREVIOUS_ORION_PLANETS.map(planet => ({
    ...planet, x: planet.x * 10, y: planet.y * 10, z: planet.z * 10, radius: planet.radius * 12,
  })),
  ...FRONTIER_PLANETS.map(planet => ({ ...planet, radius: planet.radius * 1.5 })),
  ...OUTER_REACH_PLANETS,
].map(planet => ({ ...planet, x: planet.x * 5.12, y: planet.y * 5.12, z: planet.z * 5.12, radius: planet.radius * 9 }))

const PREVIOUS_ORION_DRONES: readonly DroneSite[] = [
  { id: 'drone-a', x: -120, y: 48, z: 612, health: 45 },
  { id: 'drone-b', x: 348, y: -84, z: 1680, health: 55 },
  { id: 'drone-c', x: -384, y: 192, z: 3288, health: 65 },
  { id: 'drone-d', x: 624, y: -204, z: 4344, health: 55 },
  { id: 'drone-e', x: -648, y: -312, z: 2424, health: 60 },
  { id: 'drone-f', x: 168, y: 288, z: 3840, health: 70 },
  { id: 'drone-g', x: -264, y: 84, z: 4800, health: 65 },
  { id: 'drone-h', x: 36, y: -168, z: 1200, health: 50 },
  { id: 'drone-i', x: 552, y: 132, z: 2880, health: 75 },
  { id: 'drone-j', x: -480, y: -108, z: 4080, health: 80 },
]

const FLEET_FACTIONS: readonly FactionId[] = ['meridian', 'nacre', 'null-cult', 'ashen-legion']
const FLEET_ARCHETYPES: readonly ShipArchetype[] = ['scout', 'interceptor', 'bomber', 'frigate']

export const ORION_DRONES: readonly DroneSite[] = [
  ...PREVIOUS_ORION_DRONES.map((site, index) => ({
    ...createWorldShip(site.id, FLEET_FACTIONS[index % 4], FLEET_ARCHETYPES[index % 4], {
      x: site.x * 10, y: site.y * 10, z: site.z * 10,
    }),
    health: site.health,
  })),
  ...Array.from({ length: 62 }, (_, index) => {
    const planet = ORION_PLANETS[index % PREVIOUS_ORION_PLANETS.length]
    const angle = index * 2.399963229728653
    const orbit = planet.radius + 280 + Math.floor(index / PREVIOUS_ORION_PLANETS.length) * 100
    return createWorldShip(
      `faction-patrol-${index + 1}`,
      FLEET_FACTIONS[index % FLEET_FACTIONS.length],
      FLEET_ARCHETYPES[(index + Math.floor(index / 4)) % FLEET_ARCHETYPES.length],
      { x: planet.x + Math.cos(angle) * orbit, y: planet.y + Math.sin(angle * 0.7) * 90, z: planet.z + Math.sin(angle) * orbit },
    )
  }),
  ...FRONTIER_PLANETS.flatMap((source, planetIndex) => Array.from({ length: 2 }, (_, side) => {
    const planet = ORION_PLANETS.find(site => site.id === source.id)!
    const index = planetIndex * 2 + side
    const angle = index * 2.399963229728653
    const orbit = planet.radius + 340
    return createWorldShip(
      `frontier-patrol-${index + 1}`,
      FLEET_FACTIONS[index % FLEET_FACTIONS.length],
      FLEET_ARCHETYPES[(index + Math.floor(index / 4)) % FLEET_ARCHETYPES.length],
      { x: planet.x + Math.cos(angle) * orbit, y: planet.y + Math.sin(angle * 0.7) * 150, z: planet.z + Math.sin(angle) * orbit },
    )
  })),
  ...Array.from({ length: 120 }, (_, index): DroneSite => {
    const groupIndex = Math.floor(index / 4)
    const slot = index % 4
    const planet = ORION_PLANETS[groupIndex * 2 + (slot === 3 ? 1 : 0)]
    const angle = groupIndex * 2.399963229728653 + 0.85
    if (slot === 3) {
      const orbit = planet.radius + 740
      return createWorldShip(`outer-patrol-${index + 1}`, FLEET_FACTIONS[index % 4], FLEET_ARCHETYPES[groupIndex % 4], {
        x: planet.x + Math.cos(angle) * orbit, y: planet.y + 120, z: planet.z + Math.sin(angle) * orbit,
      })
    }
    const formation: PatrolFormation = {
      id: `squadron-${groupIndex + 1}`, slot,
      anchor: groupIndex === 0 ? { x: -600, y: 120, z: 9200 } : { x: planet.x, y: planet.y, z: planet.z },
      radius: groupIndex === 0 ? 260 : planet.radius + 720,
      phase: angle, speed: 9,
    }
    const route = samplePatrolRoute(formation, 0)
    return {
      ...createWorldShip(`outer-patrol-${index + 1}`, FLEET_FACTIONS[groupIndex % 4], FLEET_ARCHETYPES[(groupIndex + slot) % 4], sampleFormationPosition(route.center, route.forward, slot)),
      formation,
    }
  }),
  ...buildDeepSpacePopulation(ORION_PLANETS, ORION_STATIONS, ORION_SUN),
]

export const VEIL_PATROL_DRONE: DroneSite = {
  id: 'veil-warden',
  x: 5880,
  y: -1920,
  z: 42000,
  health: 85,
  faction: 'null-cult', archetype: 'interceptor', damage: 14,
  attackInterval: 1.9, attackRange: 120, projectileSpeed: 95, speed: 24,
  missionId: 'patrol-hunt',
}

export function distanceBetween(left: SectorPosition, right: SectorPosition): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

export function findNearestStation(position: SectorPosition): StationSite {
  return ORION_STATIONS.reduce((nearest, station) => distanceBetween(position, station) < distanceBetween(position, nearest) ? station : nearest)
}

export function findNearbyPlanet(
  position: SectorPosition,
  planets: readonly PlanetSite[] = ORION_PLANETS,
  scanRange = 9,
): PlanetSite | null {
  const nearest = findNearestPlanet(position, planets)
  return nearest && distanceToPlanetSurface(position, nearest) <= scanRange ? nearest : null
}

export function distanceToPlanetSurface(position: SectorPosition, planet: PlanetSite): number {
  return Math.max(0, distanceBetween(position, planet) - planet.radius)
}

export function findPlanetCollision(
  position: SectorPosition,
  planets: readonly PlanetSite[] = ORION_PLANETS,
  shipRadius = 2.4,
): PlanetSite | null {
  return planets.find((planet) => distanceBetween(position, planet) < planet.radius + shipRadius) ?? null
}

/** Keep saves from before a planet expansion above the new surface, without collision damage. */
export function resolveSafeFlightPosition(position: SectorPosition, planets: readonly PlanetSite[] = ORION_PLANETS): SectorPosition {
  let safe = position
  for (const planet of planets) {
    const distance = distanceBetween(safe, planet)
    if (distance >= planet.radius + 2.4) continue
    const radius = planet.radius + 8
    const factor = radius / Math.max(distance, 0.001)
    safe = distance < 0.001 ? { x: planet.x, y: planet.y, z: planet.z - radius }
      : { x: planet.x + (safe.x - planet.x) * factor, y: planet.y + (safe.y - planet.y) * factor, z: planet.z + (safe.z - planet.z) * factor }
  }
  return safe
}

export function findNearestPlanet(
  position: SectorPosition,
  planets: readonly PlanetSite[] = ORION_PLANETS,
): PlanetSite | null {
  let nearest: PlanetSite | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const planet of planets) {
    const distance = distanceToPlanetSurface(position, planet)
    if (distance < nearestDistance) {
      nearest = planet
      nearestDistance = distance
    }
  }

  return nearest
}
export function calculateDroneDamage(bonuses: { damagePercent: number }): number {
  return resolveWeaponHit(bonuses, () => 1).damage
}
