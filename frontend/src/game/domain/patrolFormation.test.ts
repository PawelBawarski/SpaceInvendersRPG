import { describe, expect, it } from 'vitest'
import { distanceBetween, ORION_DRONES, ORION_PLANETS } from './exploration'
import { sampleFormationPosition, samplePatrolRoute } from './patrolFormation'

describe('patrol formations', () => {
  const grouped = ORION_DRONES.filter(site => site.formation)
  const ids = [...new Set(grouped.map(site => site.formation!.id))]

  it('mixes thirty same-faction trios with independent ships and preserves distinct identities', () => {
    expect(grouped).toHaveLength(1590)
    expect(ids).toHaveLength(530)
    expect(ORION_DRONES.filter(site => !site.formation)).toHaveLength(1410)
    expect(new Set(ORION_DRONES.map(site => site.id)).size).toBe(3000)
    for (const id of ids) {
      const members = grouped.filter(site => site.formation!.id === id)
      expect(members.map(site => site.formation!.slot)).toEqual([0, 1, 2])
      expect(new Set(members.map(site => site.faction)).size).toBe(1)
      for (const member of members) {
        const route = samplePatrolRoute(member.formation!, 0)
        expect(sampleFormationPosition(route.center, route.forward, member.formation!.slot)).toEqual({ x: member.x, y: member.y, z: member.z })
      }
    }
  })

  it('keeps formations separated and outside all enlarged planetary surfaces over an entire route', () => {
    for (const id of ids) {
      const members = grouped.filter(site => site.formation!.id === id)
      const formation = members[0].formation!
      const period = Math.PI * 2 * formation.radius / formation.speed
      let minimumClearance = Infinity
      let minimumSeparation = Infinity
      for (let sample = 0; sample < 24; sample++) {
        const route = samplePatrolRoute(formation, period * sample / 24)
        const positions = members.map(site => sampleFormationPosition(route.center, route.forward, site.formation!.slot))
        for (let index = 0; index < positions.length; index++) {
          for (const neighbor of positions.slice(index + 1)) minimumSeparation = Math.min(minimumSeparation, distanceBetween(positions[index], neighbor))
          for (const planet of ORION_PLANETS) minimumClearance = Math.min(minimumClearance, distanceBetween(positions[index], planet) - planet.radius)
        }
      }
      expect(minimumClearance, id).toBeGreaterThan(100)
      expect(minimumSeparation, id).toBeGreaterThan(60)
    }
  })
})
