import { expect, test } from 'claude-code/testing'

import { buildReport } from './report'

const NOW = Date.parse('2026-10-09T12:00:00Z')
const base = {
  lang: 'en' as const,
  now: NOW,
  snap: {
    limits: [{ kind: 'five_hour', percentUsed: 71, resetsAt: new Date(NOW + 48 * 60000).toISOString() }],
    usd: 1.42,
    contextPercent: 16,
    categories: [{ name: 'Messages', tokens: 90000 }]
  },
  tokens: { input: 1000, output: 500, cacheRead: 8000, cacheWrite: 1000 },
  todayUsd: 2.5,
  dailyGoal: 5,
  projects: [['api', 2.5]] as [string, number][],
  petName: 'Pip',
  mood: 'idle' as const,
  frame: 0,
  isPetOn: true
}

test('the text report carries the pet, limits, goal, context, tokens, cost and projects', async () => {
  const text = buildReport(base)
  expect(text).toContain('(•ᴗ•)  Pip · chilling')
  expect(text).toContain('5h')
  expect(text).toContain('29% left · resets in 48m')
  expect(text).toContain('Daily goal')
  expect(text).toContain('50% · $2.50 of $5.00')
  expect(text).toContain('16% used (Messages 90k)')
  expect(text).toContain('cache 80%')
  expect(text).toContain('Session  $1.42')
  expect(text).toContain('api $2.50')
})

test('the report works with no reading, no pet and in Portuguese', async () => {
  expect(buildReport({ ...base, snap: null, isPetOn: false })).toBe('No usage reading yet. Send a prompt.')
  const pt = buildReport({ ...base, lang: 'pt', dailyGoal: 0 })
  expect(pt).toContain('Pip · de boa')
  expect(pt).toContain('29% restante · reseta em 48m')
  expect(pt).not.toContain('Meta diária')
})
