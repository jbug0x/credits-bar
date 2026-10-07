import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { newAlerts, paceNote, toSnapshot } from './usage'

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

function contextColor(percent: number): 'green' | 'yellow' | 'red' {
  if (percent < 50) return 'green'
  if (percent < 80) return 'yellow'

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
  // Thresholds already toasted this process (keyed by limit, reset time and threshold).
  let seen: ReadonlySet<string> = new Set()

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

  // Refresh the numbers every time the engine measures usage (after each response),
  // and warn once when a limit crosses 80% / 95%.
  on('session.measure', async ($, e, next) => {
    const value = toSnapshot(e)
    await update($, snapshot, () => value)

    const alerts = newAlerts(value.limits, seen)
    seen = alerts.seen
    for (const message of alerts.messages) $.ui.toast(message)

    return next(e)
  })

  // Also read once when the prompt is sent, so the bar is there from the first turn.
  on('prompt.submit', async ($, e, next) => {
    const value = toSnapshot(await $.session.usage())
    await update($, snapshot, () => value)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)

    if (e.props.hasSurvey || snap === null || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    const now = Date.now()

    return (
      <Box>
        {snap.limits.length === 0 ? (
          <Text dimColor>Credits: no usage limit reported yet </Text>
        ) : (
          snap.limits.map(l => {
            const left = Math.round((100 - l.percentUsed) * 10) / 10
            const pace = paceNote(l, now)

            return (
              <Text key={l.kind} color={colorFor(left)}>
                {LABELS[l.kind] ?? l.kind} {drawBar(left)} {left}% left
                <Text dimColor>{timeUntil(l.resetsAt)}</Text>
                {pace ? <Text color="red"> ({pace})</Text> : null}
                {'  '}
              </Text>
            )
          })
        )}
        {snap.contextPercent !== null ? (
          <Text color={contextColor(snap.contextPercent)}>ctx {snap.contextPercent}% </Text>
        ) : null}
        {snap.usd !== null ? <Text dimColor>session ${snap.usd.toFixed(2)} </Text> : null}
        <Button key="hide" label="Hide (/credits-bar to restore)" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}
