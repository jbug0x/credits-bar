import { expect, test } from 'claude-code/testing'

import { PET_SLEEP_AFTER_MS, petMini, petSprite, petState } from './pet'
import type { PetState } from './pet'

const NOW = 1_000_000
const calm = { working: false, lastActive: NOW, partyUntil: 0 }

test('the pet picks its state: party, fear, tiredness, work, sleep, idle', async () => {
  expect(petState(calm, NOW, 10)).toBe('idle')
  expect(petState({ ...calm, working: true }, NOW, 10)).toBe('work')
  expect(petState(calm, NOW + PET_SLEEP_AFTER_MS + 1, 10)).toBe('sleep')
  expect(petState({ ...calm, working: true }, NOW, 85)).toBe('tired')
  expect(petState({ ...calm, working: true }, NOW, 97)).toBe('scared')
  expect(petState({ ...calm, partyUntil: NOW + 1000 }, NOW, 97)).toBe('party')
  // the party ends
  expect(petState({ ...calm, partyUntil: NOW - 1 }, NOW, 10)).toBe('idle')
  // custom thresholds
  expect(petState(calm, NOW, 55, { low: 50, high: 90 })).toBe('tired')
})

test('every state draws four rows of the same width, and the frames change', async () => {
  const states: PetState[] = ['idle', 'sleep', 'work', 'tired', 'scared', 'party']

  for (const state of states) {
    for (let frame = 0; frame < 8; frame++) {
      const rows = petSprite(state, frame)
      expect(rows.length).toBe(4)
      expect(rows[2]).toContain('█')
      // the sprite itself is 7 columns wide on every row (the aside rides after it)
      for (const row of rows) expect(row.slice(0, 7).length).toBe(7)
    }
    expect(petSprite(state, 0).join('\n')).not.toBe(petSprite(state, 1).join('\n'))
  }
})

test('the mini pet differs per state and carries the aside', async () => {
  expect(petMini('idle', 0)).toBe('(•ᴗ•)')
  expect(petMini('idle', 5)).toBe('(-ᴗ-)')
  expect(petMini('sleep', 0)).toBe('(-ᴗ-) z')
  expect(petMini('sleep', 1)).toBe('(-ᴗ-) Z')
  expect(petMini('scared', 0)).toBe('(°o°) !')
  expect(petMini('party', 1)).toContain('^ᴗ^')
  const all = new Set((['idle', 'sleep', 'work', 'tired', 'scared', 'party'] as const).map(s => petMini(s, 0)))
  expect(all.size).toBe(6)
})
