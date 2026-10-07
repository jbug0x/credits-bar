import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { newAlerts, paceNote, toSnapshot } from './usage'

const PANE = 'credits'

const snapshot = atom({ plugin: 'credits-bar', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'credits-bar', key: 'isHidden' } as const, false)

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'Spend'
}

// A bar of `width` cells that drains as `percentLeft` goes down.
function drawBar(percentLeft: number, width: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, percentLeft)) / 100) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
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

async function isPaneUp($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(p => p.id === PANE && p.isPlaced)
}

export const register: Register = on => {
  // Thresholds already toasted this process (keyed by limit, reset time and threshold).
  let seen: ReadonlySet<string> = new Set()

  on('session.start', async ($, e, next) => {
    await update($, isHidden, () => false)
    await $.command.register({
      name: 'credits-bar',
      description: 'Show or hide the usage panel (and its one-line fallback)'
    })
    // Unasked, the pane seats from 144 columns; below that the one-line band stands in.
    void $.ui.open({ id: PANE, title: 'Credits' })

    return next(e)
  })

  // /credits-bar: if anything is showing, hide it all; otherwise bring it back.
  on('command.run', { command: 'credits-bar' }, async $ => {
    const isShowing = (await isPaneUp($)) || !(await read($, isHidden))

    if (isShowing) {
      await update($, isHidden, () => true)
      await $.ui.close({ id: PANE })

      return { text: 'Credits hidden. Run /credits-bar to show it again.' }
    }

    await update($, isHidden, () => false)
    const opened = await $.ui.open({ id: PANE, title: 'Credits' })

    return { text: opened.isPlaced ? 'Credits panel opened.' : 'Credits shown in the band above the prompt.' }
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

  // Also read once when the prompt is sent, so the numbers are there from the first turn.
  on('prompt.submit', async ($, e, next) => {
    const value = toSnapshot(await $.session.usage())
    await update($, snapshot, () => value)

    return next(e)
  })

  // The side panel: bars, reset times, pace, context and cost, stacked.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)

    if (snap === null) {
      return <Text dimColor>No usage reading yet. Send a prompt.</Text>
    }

    const width = Math.max(10, Math.min(30, (e.viewport?.columns ?? 40) - 4))
    const now = Date.now()

    return (
      <Box flexDirection="column">
        {snap.limits.length === 0 ? (
          <Text dimColor>No usage limit reported (not on a subscription?).</Text>
        ) : (
          snap.limits.map(l => {
            const left = Math.round((100 - l.percentUsed) * 10) / 10
            const pace = paceNote(l, now)

            return (
              <Box key={l.kind} flexDirection="column">
                <Text bold>
                  {LABELS[l.kind] ?? l.kind} <Text color={colorFor(left)}>{left}% left</Text>
                </Text>
                <Text color={colorFor(left)}>{drawBar(left, width)}</Text>
                <Text dimColor>{timeUntil(l.resetsAt).trim() || ' '}</Text>
                {pace ? <Text color="red">{pace}</Text> : null}
                <Text> </Text>
              </Box>
            )
          })
        )}
        {snap.contextPercent !== null ? (
          <Box flexDirection="column">
            <Text bold>
              Context <Text color={contextColor(snap.contextPercent)}>{snap.contextPercent}% used</Text>
            </Text>
            <Text color={contextColor(snap.contextPercent)}>{drawBar(100 - snap.contextPercent, width)}</Text>
            <Text> </Text>
          </Box>
        ) : null}
        {snap.usd !== null ? <Text dimColor>Session cost ${snap.usd.toFixed(2)}</Text> : null}
      </Box>
    )
  })

  // The one-line fallback: only while the panel is not seated (narrow window or closed).
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)

    if (e.props.hasSurvey || snap === null || (await read($, isHidden)) || (await isPaneUp($))) {
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
                {LABELS[l.kind] ?? l.kind} {drawBar(left, 10)} {left}% left
                {pace ? <Text color="red"> ({pace})</Text> : null}
                {'  '}
              </Text>
            )
          })
        )}
        {snap.contextPercent !== null ? (
          <Text color={contextColor(snap.contextPercent)}>ctx {snap.contextPercent}% </Text>
        ) : null}
        {snap.usd !== null ? <Text dimColor>${snap.usd.toFixed(2)} </Text> : null}
        <Button key="hide" label="Hide (/credits-bar to restore)" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}
