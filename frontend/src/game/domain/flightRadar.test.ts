import { expect, it } from 'vitest'
import { projectRadarContacts, type RadarTarget } from './flightRadar'

it('shows contacts ahead of the nose when climbing, diving, or turning', () => {
  const ship = { x: 10, y: 20, z: 30 }
  const contacts: RadarTarget[] = [
    { id: 'above', kind: 'hostile', ...ship, y: 520 },
    { id: 'below', kind: 'hostile', ...ship, y: -480 },
    { id: 'east', kind: 'station', ...ship, x: 310 },
    { id: 'distant', kind: 'boss', ...ship, y: 2020 },
  ]
  const climbing = projectRadarContacts(ship, 0, -Math.PI / 3, 1600, contacts)
  const diving = projectRadarContacts(ship, 0, Math.PI / 3, 1600, contacts)
  expect(climbing.filter(contact => contact.ahead).map(contact => contact.id)).toEqual(['above'])
  expect(diving.filter(contact => contact.ahead).map(contact => contact.id)).toEqual(['below'])
  expect(climbing.find(contact => contact.id === 'above')!.y).toBeLessThan(50)
  expect(climbing.find(contact => contact.id === 'below')!.y).toBeGreaterThan(50)
  expect(climbing.find(contact => contact.id === 'above')!.elev).toBeGreaterThan(0)
  expect(climbing.find(contact => contact.id === 'below')!.elev).toBeLessThan(0)
  expect(climbing.some(contact => contact.id === 'distant')).toBe(false)
  expect(projectRadarContacts(ship, Math.PI / 2, 0, 1600, contacts).find(contact => contact.id === 'east')).toMatchObject({ ahead: true, x: 50 })
})
