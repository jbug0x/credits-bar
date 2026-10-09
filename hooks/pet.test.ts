import { expect, test } from 'claude-code/testing'

import { PET_SLEEP_AFTER_MS, PET_WIDTH, petMini, petSprite, petState, wander } from './pet'
import type { PetState } from './pet'

const NOW = 1_000_000
const calm = { working: false, lastActive: NOW, partyUntil: 0 }
const STATES: PetState[] = ['idle', 'sleep', 'work', 'tired', 'scared', 'party']

test('the pet picks its state: party, fear, tiredness, work, sleep, idle', async () => {
  expect(petState(calm, NOW, 10)).toBe('idle')
  expect(petState({ ...calm, working: true }, NOW, 10)).toBe('work')
  expect(petState(calm, NOW + PET_SLEEP_AFTER_MS + 1, 10)).toBe('sleep')
  expect(petState({ ...calm, working: true }, NOW, 85)).toBe('tired')
  expect(petState({ ...calm, working: true }, NOW, 97)).toBe('scared')
  expect(petState({ ...calm, partyUntil: NOW + 1000 }, NOW, 97)).toBe('party')
  expect(petState({ ...calm, partyUntil: NOW - 1 }, NOW, 10)).toBe('idle')
  expect(petState(calm, NOW, 55, { low: 50, high: 90 })).toBe('tired')
})

test('wandering goes out, rests, comes back and stays inside the range', async () => {
  const range = 6
  const xs = Array.from({ length: 80 }, (_, f) => wander(f, range))

  for (const p of xs) {
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(range)
  }
  expect(Math.max(...xs.map(p => p.x))).toBe(range)
  expect(Math.min(...xs.map(p => p.x))).toBe(0)
  expect(xs.some(p => p.isMoving)).toBe(true)
  expect(xs.some(p => !p.isMoving)).toBe(true)
  // no room, no wandering
  expect(wander(10, 0)).toEqual({ x: 0, isMoving: false })
})

test('every state draws five rows, a face and a moving frame', async () => {
  for (const state of STATES) {
    for (let frame = 0; frame < 12; frame++) {
      const rows = petSprite(state, frame, 6)
      expect(rows.length).toBe(5)
      expect(rows.join('\n')).toContain('(')
      for (const row of rows) expect(row.length).toBeLessThanOrEqual(6 + PET_WIDTH + 4)
    }
    expect(petSprite(state, 0, 6).join('\n')).not.toBe(petSprite(state, 1, 6).join('\n'))
  }
})

test('states look different: keyboard while working, sparkles at a party, Zs asleep', async () => {
  expect(petSprite('work', 0).join('\n')).toContain('[:.:.:]')
  expect(petSprite('work', 1).join('\n')).toContain('[.:.:.]')
  expect(petSprite('party', 0).join('\n')).toContain('✦')
  expect(petSprite('party', 0).join('\n')).toContain('\(')
  expect(petSprite('sleep', 0).join('\n')).toMatch(/[zZ]/)
  expect(petSprite('scared', 0).join('\n')).toContain('!')
  // asleep, the pet keeps still where it is
  const first = petSprite('sleep', 0, 8)[2]
  expect(petSprite('sleep', 3, 8)[2]).toBe(first)
})

test('the mini pet differs per state and carries the aside', async () => {
  expect(petMini('idle', 0)).toBe('(•ᴗ•)')
  expect(petMini('idle', 5)).toBe('(-ᴗ-)')
  expect(petMini('sleep', 0)).toBe('(-ᴗ-) z')
  expect(petMini('sleep', 1)).toBe('(-ᴗ-) Z')
  expect(petMini('scared', 0)).toBe('(°o°) !')
  expect(petMini('party', 1)).toContain('^ᴗ^')
  expect(new Set(STATES.map(s => petMini(s, 0))).size).toBe(6)
})
