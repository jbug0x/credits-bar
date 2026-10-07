import { expect, test } from 'claude-code/testing'

import { newAlerts, paceNote } from './usage'

const NOW = Date.parse('2026-10-07T12:00:00Z')
const H = 3600 * 1000

test('paceNote warns when the burn rate would empty the window before reset', async () => {
  // 5h window, 2h elapsed (resets in 3h), 60% used -> empty in ~80m, before reset.
  const limit = { kind: 'five_hour', percentUsed: 60, resetsAt: new Date(NOW + 3 * H).toISOString() }
  expect(paceNote(limit, NOW)).toBe('out in 1h')
})

test('paceNote stays quiet when usage will last until reset', async () => {
  const limit = { kind: 'five_hour', percentUsed: 20, resetsAt: new Date(NOW + 3 * H).toISOString() }
  expect(paceNote(limit, NOW)).toBeNull()
})

test('paceNote ignores unknown windows and tiny usage', async () => {
  expect(paceNote({ kind: 'spend_limit', percentUsed: 90, resetsAt: new Date(NOW + H).toISOString() }, NOW)).toBeNull()
  expect(paceNote({ kind: 'five_hour', percentUsed: 5, resetsAt: new Date(NOW + 3 * H).toISOString() }, NOW)).toBeNull()
})

test('newAlerts fires once per threshold and window', async () => {
  const limits = [{ kind: 'five_hour', percentUsed: 82, resetsAt: 'A' }]
  const first = newAlerts(limits, new Set())
  expect(first.messages).toEqual(['5h limit 82% used'])
  expect(newAlerts(limits, first.seen).messages).toEqual([])

  const higher = newAlerts([{ kind: 'five_hour', percentUsed: 96, resetsAt: 'A' }], first.seen)
  expect(higher.messages).toEqual(['5h limit 96% used'])

  const newWindow = newAlerts([{ kind: 'five_hour', percentUsed: 85, resetsAt: 'B' }], higher.seen)
  expect(newWindow.messages).toEqual(['5h limit 85% used'])
})
