export interface HangarDialogueLine {
  pl: string
  en: string
}

export interface HangarCrewMember {
  id: string
  name: { pl: string; en: string }
  role: { pl: string; en: string }
  species: 'human' | 'alien' | 'avian' | 'robot'
  position: { x: number; z: number }
  colors: { suit: string; trim: string; skin: string }
  dialogue: readonly HangarDialogueLine[]
}

export interface HangarConversationTurn {
  speaker: HangarCrewMember['name']
  role: HangarCrewMember['role']
  line: HangarDialogueLine
}

export const HANGAR_CREW: readonly HangarCrewMember[] = [
  {
    id: 'rhea-venn',
    name: { pl: 'Rhea Venn', en: 'Rhea Venn' },
    role: { pl: 'mechaniczka', en: 'ship mechanic' },
    species: 'human',
    position: { x: -6, z: 3.5 },
    colors: { suit: '#304c5d', trim: '#f0ae59', skin: '#bd8b69' },
    dialogue: [
      {
        pl: 'Jeśli silnik znów zapiszczy, to nie on. To stary hangar odpowiada.',
        en: 'If the engine squeals again, it is not the engine. The old hangar is answering.',
      },
      {
        pl: 'Nie naprawię osłon samym optymizmem. Przywieź stop z następnej wyprawy.',
        en: 'I cannot patch shields with optimism. Bring alloy back from the next run.',
      },
    ],
  },
  {
    id: 'ssil-of-nacre',
    name: { pl: 'Ssil z Nacre', en: 'Ssil of Nacre' },
    role: { pl: 'kurier międzygwiezdny', en: 'interstellar courier' },
    species: 'alien',
    position: { x: 4.5, z: 7 },
    colors: { suit: '#3b354e', trim: '#65d8d0', skin: '#5aa79f' },
    dialogue: [
      {
        pl: 'W próżni nie ma ciszy. Są tylko sygnały, których jeszcze nie rozumiemy.',
        en: 'There is no silence in the void. Only signals we do not understand yet.',
      },
      {
        pl: 'Zostawiłem na stole współrzędne bez nazwy. Nie pytaj, kto je nadał.',
        en: 'I left unnamed coordinates on the table. Do not ask who sent them.',
      },
    ],
  },
  {
    id: 'ivo-saar',
    name: { pl: 'Ivo Saar', en: 'Ivo Saar' },
    role: { pl: 'pilot szlaku', en: 'route pilot' },
    species: 'human',
    position: { x: -2.5, z: 12 },
    colors: { suit: '#45443b', trim: '#74c9e8', skin: '#c59273' },
    dialogue: [
      {
        pl: 'Ktoś nadal używa starych znaków nawigacyjnych. To może być trop albo przynęta.',
        en: 'Someone is still using the old navigation marks. It could be a trail or bait.',
      },
      {
        pl: 'Wróć z całym kadłubem. Resztę da się wymienić.',
        en: 'Bring the hull back in one piece. Everything else can be replaced.',
      },
    ],
  },
  {
    id: 'sera-tal',
    name: { pl: 'Sera Tal', en: 'Sera Tal' },
    role: { pl: 'kartografka', en: 'cartographer' },
    species: 'avian',
    position: { x: 4.7, z: 0.6 },
    colors: { suit: '#6b4853', trim: '#fdab83', skin: '#ae7392' },
    dialogue: [
      { pl: 'Na radarze góra jest przed dziobem. Skaner dalekiego zasięgu da ci czas, żeby zmienić kurs.', en: 'The top of the radar is ahead of your nose. A long-range scanner gives you time to change course.' },
      { pl: 'Za skrajem Oriona gwiazdy układają się inaczej. Obierz cel, zanim wejdziesz w nadprzestrzeń.', en: 'Beyond Orion the stars fall into different patterns. Pick a destination before entering hyperspace.' },
    ],
  },
  {
    id: 'k-7',
    name: { pl: 'K-7', en: 'K-7' },
    role: { pl: 'robot techniczny', en: 'service drone' },
    species: 'robot',
    position: { x: -4.4, z: -2.3 },
    colors: { suit: '#64877b', trim: '#bcffab', skin: '#2e423d' },
    dialogue: [
      { pl: 'Sprawdziłem reflektory. Zwykle włączasz je klawiszem H. Przydają się w cieniu stacji.', en: 'Headlights checked. They default to H and come in handy in the station’s shadow.' },
      { pl: 'Pęknięcia poszycia załatam za darmo. Na ładowanie osłony wystawiam rachunek.', en: 'Hull cracks are on the house. Shield charging goes on the invoice.' },
    ],
  },
]

function conversationTurn(memberId: string, line: HangarDialogueLine): HangarConversationTurn {
  const member = HANGAR_CREW.find((crewMember) => crewMember.id === memberId)
  if (!member) throw new Error(`Unknown hangar crew member: ${memberId}`)
  return { speaker: member.name, role: member.role, line }
}

export const HANGAR_CONVERSATIONS: readonly (readonly HangarConversationTurn[])[] = [
  [
    conversationTurn('rhea-venn', {
      pl: 'Ten silnik znów odpowiada na sygnał z boi. Nie powinien go nawet słyszeć.',
      en: 'That engine is answering the buoy signal again. It should not even be able to hear it.',
    }),
    conversationTurn('ivo-saar', {
      pl: 'Może ktoś dostroił go do tej częstotliwości, zanim tu trafiliśmy.',
      en: 'Maybe someone tuned it to that frequency before we got here.',
    }),
  ],
  [
    conversationTurn('ssil-of-nacre', {
      pl: 'Na Nacre mówi się, że sygnały Meridianu pamiętają statki, które je odebrały.',
      en: 'On Nacre, they say Meridian signals remember the ships that hear them.',
    }),
    conversationTurn('rhea-venn', {
      pl: 'Świetnie. W takim razie niech zapamięta, że statek jest po moim przeglądzie.',
      en: 'Good. Then let it remember this ship passed my inspection.',
    }),
  ],
  [
    conversationTurn('ivo-saar', {
      pl: 'Ssil, te współrzędne na stole prowadzą poza znane szlaki?',
      en: 'Ssil, do those coordinates on the table lead beyond the known routes?',
    }),
    conversationTurn('ssil-of-nacre', {
      pl: 'Prowadzą do miejsca, którego mapy nie chcą nazwać. Na razie wystarczy.',
      en: 'They lead somewhere the charts refuse to name. That is enough for now.',
    }),
  ],
  [
    conversationTurn('sera-tal', { pl: 'Na skraju układu zniknął sygnał boi. Sama tam polecę po zmianie.', en: 'A beacon went quiet at the edge of the system. I will fly out after my shift.' }),
    conversationTurn('k-7', { pl: 'Sprawdź przed odlotem, czy masz skaner dalekiego zasięgu.', en: 'Check that you have a long-range scanner before you leave.' }),
  ],
]
