import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'

const BAR_WIDTH = 20

const snapshot = atom({ plugin: 'credits-bar', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'credits-bar', key: 'isHidden' } as const, false)

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'Spend'
}

// A bar of BAR_WIDTH cells that drains as `percentLeft` goes down.
function drawBar(percentLeft: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, percentLeft)) / 100) * BAR_WIDTH)

  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

function colorFor(percentLeft: number): 'green' | 'yellow' | 'red' {
  if (percentLeft > 50) return 'green'
  if (percentLeft > 20) return 'yellow'

  return 'red'
}

function timeUntil(iso?: string): string {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000))
  if (minutes < 60) return ` resets in ${minutes}m`
  if (minutes < 24 * 60) return ` resets in ${Math.round(minutes / 60)}h`

  return ` resets in ${Math.round(minutes / (24 * 60))}d`
}

export const register: Register = on => {
  // The bar always starts visible; /credits-bar toggles it (so "Hide" is never permanent).
  on('session.start', async ($, e, next) => {
    await update($, isHidden, () => false)
    await $.command.register({
      name: 'credits-bar',
      description: 'Show or hide the usage bar above the prompt'
    })

    return next(e)
  })

  on('command.run', { command: 'credits-bar' }, async $ => {
    const nowHidden = !(await read($, isHidden))
    await update($, isHidden, () => nowHidden)

    return { text: nowHidden ? 'Credits bar hidden. Run /credits-bar to show it again.' : 'Credits bar shown.' }
  })

  // Refresh the numbers every time the engine measures usage (after each response).
  on('session.measure', async ($, e, next) => {
    const value: Snapshot = {
      limits: e.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
      usd: e.cost?.usd ?? null
    }
    await update($, snapshot, () => value)

    return next(e)
  })

  // Also read once when the prompt is sent, so the bar is there from the first turn.
  on('prompt.submit', async ($, e, next) => {
    const usage = await $.session.usage()
    const value: Snapshot = {
      limits: usage.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
      usd: usage.cost?.usd ?? null
    }
    await update($, snapshot, () => value)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)

    if (e.props.hasSurvey || snap === null || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box>
        {snap.limits.length === 0 ? (
          <Text dimColor>Credits: no usage limit reported yet </Text>
        ) : (
          snap.limits.map(l => {
            const left = Math.round((100 - l.percentUsed) * 10) / 10

            return (
              <Text key={l.kind} color={colorFor(left)}>
                {LABELS[l.kind] ?? l.kind} {drawBar(left)} {left}% left
                <Text dimColor>{timeUntil(l.resetsAt)}</Text>
                {'  '}
              </Text>
            )
          })
        )}
        {snap.usd !== null ? <Text dimColor>session ${snap.usd.toFixed(2)} </Text> : null}
        <Button key="hide" label="Hide (/credits-bar to restore)" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}
