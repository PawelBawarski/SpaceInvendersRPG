import { describe, expect, it } from 'vitest'
import { SIDE_MISSIONS, getSideMission, isSideMissionId } from '../domain/sideMissions'
import { MEGASTATION_NPC } from '../domain/megastation'
import {
  acceptSideMission,
  createEmptyMissionProgress,
  registerSideMissionKill,
} from './missionProgress'

describe('side missions', () => {
  it('exposes valid, unique contracts', () => {
    expect(SIDE_MISSIONS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(SIDE_MISSIONS.map(mission => mission.id)).size).toBe(SIDE_MISSIONS.length)
    expect(SIDE_MISSIONS.every(mission => mission.requiredKills > 0 && mission.reward.credits > 0)).toBe(true)
    // Every NPC contract points at a real mission.
    for (const npc of MEGASTATION_NPC) {
      if (npc.sideMissionId) expect(isSideMissionId(npc.sideMissionId)).toBe(true)
    }
    expect(isSideMissionId('bastion-sweep')).toBe(true)
    expect(isSideMissionId('nope')).toBe(false)
    expect(getSideMission('bastion-sweep').requiredKills).toBeGreaterThan(0)
  })

  it('accepts a contract once', () => {
    const empty = createEmptyMissionProgress()
    const accepted = acceptSideMission(empty, 'bastion-sweep')
    expect(accepted.sideMissions?.accepted).toContain('bastion-sweep')
    expect(acceptSideMission(accepted, 'bastion-sweep')).toBe(accepted)
  })

  it('counts kills and grants the reward exactly once on completion', () => {
    const mission = getSideMission('bastion-supply')
    let progress = acceptSideMission(createEmptyMissionProgress(), 'bastion-supply')
    const creditsBefore = progress.credits
    for (let i = 0; i < mission.requiredKills; i++) progress = registerSideMissionKill(progress)
    expect(progress.sideMissions?.completed).toContain('bastion-supply')
    expect(progress.sideMissions?.accepted).not.toContain('bastion-supply')
    expect(progress.credits).toBe(creditsBefore + mission.reward.credits)
    // Extra kills after completion must not pay out again.
    const after = registerSideMissionKill(progress)
    expect(after.credits).toBe(progress.credits)
    expect(after).toBe(progress)
  })

  it('ignores kills with no active contract', () => {
    const empty = createEmptyMissionProgress()
    expect(registerSideMissionKill(empty)).toBe(empty)
  })
})