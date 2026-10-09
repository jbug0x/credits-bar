import { expect, test } from 'claude-code/testing'

import {
  PET_SLEEP_AFTER_MS,
  POKE_MS,
  REACTION_COUNT,
  petFloor,
  petMini,
  petStage,
  petState,
  wander
} from './pet'
import type { PetMemory, PetState } from './pet'

const NOW = 1_000_000
const calm: PetMemory = { working: false, lastActive: NOW, partyUntil: 0, pokes: 0, pokedUntil: 0 }
const STATES: PetState[] = ['idle', 'sleep', 'work', 'tired', 'scared', 'party', 'poked']

test('o bichinho escolhe o estado: cutucão, festa, medo, cansaço, trabalho, sono, de boa', async () => {
  expect(petState(calm, NOW, 10)).toBe('idle')
  expect(petState({ ...calm, working: true }, NOW, 10)).toBe('work')
  expect(petState(calm, NOW + PET_SLEEP_AFTER_MS + 1, 10)).toBe('sleep')
  expect(petState({ ...calm, working: true }, NOW, 85)).toBe('tired')
  expect(petState({ ...calm, working: true }, NOW, 97)).toBe('scared')
  expect(petState({ ...calm, partyUntil: NOW + 1000 }, NOW, 97)).toBe('party')
  expect(petState({ ...calm, partyUntil: NOW - 1 }, NOW, 10)).toBe('idle')
  expect(petState(calm, NOW, 55, { low: 50, high: 90 })).toBe('tired')
  // o cutucão vence tudo, até o medo e a festa, e passa depois de POKE_MS
  const poked = { ...calm, partyUntil: NOW + 1000, pokedUntil: NOW + POKE_MS }
  expect(petState(poked, NOW, 99)).toBe('poked')
  expect(petState(poked, NOW + POKE_MS, 10)).toBe('idle')
})

test('o passeio vai, descansa, volta e fica dentro do limite', async () => {
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
  expect(wander(10, 0)).toEqual({ x: 0, isMoving: false })
})

test('cada estado tem rosto entre parênteses, e os quadros mudam', async () => {
  for (const state of STATES) {
    for (let frame = 0; frame < 12; frame++) {
      const stage = petStage(state, frame, 6, 2)
      expect(stage.face).toContain('(')
      expect(stage.x).toBeGreaterThanOrEqual(0)
      expect(stage.x).toBeLessThanOrEqual(6 + 1)
    }
    const a = petStage(state, 0, 6, 2)
    const b = petStage(state, 1, 6, 2)
    expect(`${a.air}|${a.face}`).not.toBe(`${b.air}|${b.face}`)
  }
})

test('os humores têm marcas próprias: Zs, festa de braços para cima, medo', async () => {
  expect(petStage('sleep', 0).air).toMatch(/z/)
  expect(petStage('sleep', 1).air).toMatch(/Z/)
  expect(petStage('sleep', 0).face).toBe('(-ᴗ-)')
  expect(petStage('party', 0).face).toBe(String.fromCharCode(92) + '(^ᴗ^)/')
  expect(petStage('scared', 0).face).toBe('(°o°)')
  expect(petStage('scared', 1).air).toContain('!')
  expect(petStage('work', 0).face).toBe('(•_•)')
  // dormindo, o bichinho não sai do lugar
  expect(petStage('sleep', 0, 8).x).toBe(petStage('sleep', 3, 8).x)
})

test('cada clique tem sua reação, em rodízio', async () => {
  const faces = Array.from({ length: REACTION_COUNT }, (_, i) => petStage('poked', 0, 0, i).face)
  expect(new Set(faces).size).toBe(REACTION_COUNT)
  // depois da última volta para a primeira
  expect(petStage('poked', 0, 0, REACTION_COUNT).face).toBe(faces[0])
  expect(petStage('poked', 0, 0, 0).face).toBe('(>ᴗ<)')
  expect(petMini('poked', 0, 1)).toContain('^ᴗ^')
})

test('o chão tem largura certa, flor e bolinha', async () => {
  const floor = petFloor(20)
  expect(floor.length).toBe(20)
  expect(floor).toContain('✿')
  expect(floor).toContain('o')
  expect(petFloor(3).length).toBe(8)
})

test('o bichinho da faixa muda por estado e leva o enfeite', async () => {
  expect(petMini('idle', 0)).toBe('(•ᴗ•)')
  expect(petMini('idle', 5)).toBe('(-ᴗ-)')
  expect(petMini('sleep', 0)).toBe('(-ᴗ-) z')
  expect(petMini('sleep', 1)).toBe('(-ᴗ-) Z')
  expect(petMini('scared', 0)).toBe('(°o°) !')
  expect(petMini('party', 1)).toContain('^ᴗ^')
  const all = new Set((['idle', 'sleep', 'work', 'tired', 'scared', 'party'] as const).map(s => petMini(s, 0)))
  expect(all.size).toBe(6)
})
