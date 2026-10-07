import { expect, test } from 'claude-code/testing'

import {
  addTokens,
  cacheHitPercent,
  dayKey,
  formatTokens,
  lastDays,
  newAlerts,
  paceNote,
  recordDay,
  resetsIn,
  resolveOptions,
  sparkline,
  tint,
  topCategories
} from './usage'

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

test('newAlerts honors custom thresholds and warns once when a window is on pace to run dry', async () => {
  const resetsAt = new Date(NOW + 3 * H).toISOString()
  const limits = [{ kind: 'five_hour', percentUsed: 60, resetsAt }]
  const r = newAlerts(limits, new Set(), { alertLow: 50, alertHigh: 90 }, NOW)
  expect(r.messages).toEqual(['5h limit 60% used', '5h window out in 1h, before it resets'])
  expect(newAlerts(limits, r.seen, { alertLow: 50, alertHigh: 90 }, NOW).messages).toEqual([])
})

test('resolveOptions defaults, clamps and orders thresholds', async () => {
  expect(resolveOptions(undefined)).toMatchObject({ alertLow: 80, alertHigh: 95, compact: 'auto', palette: 'default' })
  expect(resolveOptions({ alertLow: '70', alertHigh: 10, compact: 'nope', showHistory: false })).toMatchObject({
    alertLow: 70,
    alertHigh: 70,
    compact: 'auto',
    showHistory: false
  })
})

test('history records spend per day, keeps the peak, prunes and zero-fills', async () => {
  let h = recordDay({}, NOW, 1.5, 40)
  h = recordDay(h, NOW, 0.5, 30)
  expect(h[dayKey(NOW)]).toEqual({ usd: 2, peak: 40 })
  const days = lastDays(h, NOW, 3)
  expect(days.map(d => d.usd)).toEqual([0, 0, 2])
  expect(sparkline([0, 1, 2, 4])).toBe('▁▃▅█')
  expect(sparkline([0, 0])).toBe('▁▁')

  let long = {}
  for (let i = 0; i < 20; i++) long = recordDay(long, NOW + i * 24 * H, 1, 1)
  expect(Object.keys(long).length).toBe(14)
})

test('categories, tokens, cache hit and palette', async () => {
  const top = topCategories([
    { name: 'Messages', tokens: 90000, kind: 'used' },
    { name: 'Free space', tokens: 800000, kind: 'free' },
    { name: 'Skills', tokens: 10000, kind: 'used' }
  ])
  expect(top).toEqual([
    { name: 'Messages', tokens: 90000 },
    { name: 'Skills', tokens: 10000 }
  ])
  expect(formatTokens(156662)).toBe('157k')
  expect(formatTokens(1500000)).toBe('1.5M')

  const t = addTokens(
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 800, cache_creation_input_tokens: 100 }
  )
  expect(cacheHitPercent(t)).toBe(80)
  expect(cacheHitPercent({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeNull()

  expect(tint('bad', 'default')).toBe('red')
  expect(tint('bad', 'colorblind')).toBe('magenta')
  expect(tint('bad', 'mono')).toBeUndefined()
  expect(resetsIn(new Date(NOW + 48 * 60000).toISOString(), NOW)).toBe('resets in 48m')
  expect(resetsIn(new Date(NOW - 1000).toISOString(), NOW)).toBe('resetting')
})
