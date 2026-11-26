import { localizedText, type LocalizedText } from '../i18n'
export type HangarDialogueLine = LocalizedText

export interface HangarCrewMember {
  id: string
  name: LocalizedText
  role: LocalizedText
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
    name: localizedText(text => text.crew.rheaVenn),
    role: localizedText(text => text.crew.rheaVennRole),
    species: 'human',
    position: { x: -6, z: 3.5 },
    colors: { suit: '#304c5d', trim: '#f0ae59', skin: '#bd8b69' },
    dialogue: [
      localizedText(text => text.crew.ifTheEngineSquealsAgainIt),
      localizedText(text => text.crew.iCannotPatchShieldsWithOptimism),
    ],
  },
  {
    id: 'ssil-of-nacre',
    name: localizedText(text => text.crew.ssilOfNacre),
    role: localizedText(text => text.crew.ssilOfNacreRole),
    species: 'alien',
    position: { x: 4.5, z: 7 },
    colors: { suit: '#3b354e', trim: '#65d8d0', skin: '#5aa79f' },
    dialogue: [
      localizedText(text => text.crew.thereIsNoSilenceInThe),
      localizedText(text => text.crew.iLeftUnnamedCoordinatesOnThe),
    ],
  },
  {
    id: 'ivo-saar',
    name: localizedText(text => text.crew.ivoSaar),
    role: localizedText(text => text.crew.ivoSaarRole),
    species: 'human',
    position: { x: -2.5, z: 12 },
    colors: { suit: '#45443b', trim: '#74c9e8', skin: '#c59273' },
    dialogue: [
      localizedText(text => text.crew.someoneIsStillUsingTheOld),
      localizedText(text => text.crew.bringTheHullBackInOne),
    ],
  },
  {
    id: 'sera-tal',
    name: localizedText(text => text.crew.seraTal),
    role: localizedText(text => text.crew.seraTalRole),
    species: 'avian',
    position: { x: 4.7, z: 0.6 },
    colors: { suit: '#6b4853', trim: '#fdab83', skin: '#ae7392' },
    dialogue: [
      localizedText(text => text.crew.theTopOfTheRadarIs),
      localizedText(text => text.crew.beyondOrionTheStarsFallInto),
    ],
  },
  {
    id: 'k-7',
    name: localizedText(text => text.crew.k7),
    role: localizedText(text => text.crew.k7Role),
    species: 'robot',
    position: { x: -4.4, z: -2.3 },
    colors: { suit: '#64877b', trim: '#bcffab', skin: '#2e423d' },
    dialogue: [
      localizedText(text => text.crew.headlightsCheckedTheyDefaultToH),
      localizedText(text => text.crew.hullCracksAreOnTheHouse),
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
    conversationTurn('rhea-venn', localizedText(text => text.crew.thatEngineIsAnsweringTheBuoy)),
    conversationTurn('ivo-saar', localizedText(text => text.crew.maybeSomeoneTunedItToThat)),
  ],
  [
    conversationTurn('ssil-of-nacre', localizedText(text => text.crew.onNacreTheySayMeridianSignals)),
    conversationTurn('rhea-venn', localizedText(text => text.crew.goodThenLetItRememberThis)),
  ],
  [
    conversationTurn('ivo-saar', localizedText(text => text.crew.ssilDoThoseCoordinatesOnThe)),
    conversationTurn('ssil-of-nacre', localizedText(text => text.crew.theyLeadSomewhereTheChartsRefuse)),
  ],
  [
    conversationTurn('sera-tal', localizedText(text => text.crew.aBeaconWentQuietAtThe)),
    conversationTurn('k-7', localizedText(text => text.crew.checkThatYouHaveALong)),
  ],
]
