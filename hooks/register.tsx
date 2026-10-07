import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import {
  addTokens,
  cacheHitPercent,
  drawBar,
  formatTokens,
  labelFor,
  lastDays,
  levelLeft,
  levelUsed,
  newAlerts,
  paceNote,
  recordDay,
  resetsIn,
  resolveOptions,
  sparkline,
  tint,
  toSnapshot
} from './usage'

const PANE = 'credits'
const TICK_MS = 30_000
const MAX_TURNS = 8

const snapshot = atom({ plugin: 'credits-bar', key: 'snapshot' } as const, null)
// 'auto': the band shows only while the panel is not seated; 'on': always; 'off': never.
const bandMode = atom({ plugin: 'credits-bar', key: 'bandMode' } as const, 'auto')
const turns = atom({ plugin: 'credits-bar', key: 'turns' } as const, [])
const tokens = atom({ plugin: 'credits-bar', key: 'tokens' } as const, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
const history = atom({ plugin: 'credits-bar', key: 'history' } as const, {})
const tick = atom({ plugin: 'credits-bar', key: 'tick' } as const, 0)

async function isPaneUp($: EngineInterface): Promise<boolean> {
  try {
    return (await $.ui.panes()).some(p => p.id === PANE && p.isPlaced)
  } catch {
    return false
  }
}

export const register: Register = (on, options) => {
  const opts = resolveOptions(options as Record<string, unknown> | undefined)

  // Thresholds already toasted this process (keyed by limit, reset time and threshold).
  let seen: ReadonlySet<string> = new Set()
  let lastUsd: number | null = null
  let pending = 0

  on('session.start', async ($, e, next) => {
    await update($, bandMode, () => 'auto')
    await $.command.register({
      name: 'credits-panel',
      description: 'Open or close the usage side panel'
    })
    await $.command.register({
      name: 'credits-bar',
      description: 'Show or hide the one-line usage bar above the prompt'
    })

    const stored = await $.store.get('history')
    if (stored && typeof stored === 'object') await update($, history, () => stored as Record<string, { usd: number; peak: number }>)

    // Keeps "resets in 48m" moving between responses.
    $.clock.every(TICK_MS, () => void update($, tick, n => n + 1))

    // Unasked, the pane seats from 144 columns; below that the one-line band stands in.
    void $.ui.open({ id: PANE, title: 'Credits' })

    return next(e)
  })

  // /credits-panel: open the side panel (at any width when asked), or close it.
  on('command.run', { command: 'credits-panel' }, async $ => {
    if (await isPaneUp($)) {
      await $.ui.close({ id: PANE })

      return { text: 'Credits panel closed.' }
    }

    const opened = await $.ui.open({ id: PANE, title: 'Credits' })

    return { text: opened.isPlaced ? 'Credits panel opened.' : 'The panel could not be placed here.' }
  })

  // /credits-bar: show the one-line bar above the prompt, or hide it.
  on('command.run', { command: 'credits-bar' }, async $ => {
    const isShowing = (await read($, bandMode)) === 'on' || ((await read($, bandMode)) === 'auto' && !(await isPaneUp($)))
    await update($, bandMode, () => (isShowing ? 'off' : 'on'))

    return { text: isShowing ? 'Credits bar hidden. Run /credits-bar to show it again.' : 'Credits bar shown.' }
  })

  // After each response: refresh the numbers, record spend, and raise toasts.
  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    const value = toSnapshot(e)

    if (opts.showBreakdown) {
      const detailed = await $.session.usage({ breakdown: 'summary' })
      value.categories = toSnapshot(detailed).categories
    }
    await update($, snapshot, () => value)

    const spent = lastUsd !== null && value.usd !== null && value.usd > lastUsd ? value.usd - lastUsd : 0
    if (value.usd !== null) lastUsd = value.usd
    pending += spent

    const peak = Math.max(0, ...value.limits.map(l => l.percentUsed))
    const days = recordDay(await read($, history), now, spent, peak)
    await update($, history, () => days)
    await $.store.set('history', days)

    const alerts = newAlerts(value.limits, seen, opts, now)
    seen = alerts.seen
    for (const message of alerts.messages) $.ui.toast(message)

    return next(e)
  })

  // The first reading, so the numbers are there from the first turn.
  on('prompt.submit', async ($, e, next) => {
    // A failed reading must never get in the way of the prompt.
    try {
      const value = toSnapshot(await $.session.usage({ breakdown: opts.showBreakdown ? 'summary' : undefined }))
      await update($, snapshot, () => value)
      if (lastUsd === null && value.usd !== null) lastUsd = value.usd
    } catch {
      // keep the previous reading
    }

    return next(e)
  })

  // A turn ended: file what it cost and what tokens it used.
  on('turn.complete', async ($, e, next) => {
    const cost = pending
    pending = 0
    await update($, turns, list => [...list, cost].slice(-MAX_TURNS))
    if (e.usage) {
      const usage = e.usage
      await update($, tokens, t => addTokens(t, usage))
    }

    return next(e)
  })

  // The side panel.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)

    if (snap === null) {
      return <Text dimColor>No usage reading yet. Send a prompt.</Text>
    }

    await read($, tick)
    const now = Date.now()
    const rows = e.viewport?.rows ?? 40
    const isCompact = opts.compact === 'always' || (opts.compact === 'auto' && rows < 24)
    const width = Math.max(8, Math.min(30, (e.viewport?.columns ?? 40) - 4))
    const paint = (level: 'good' | 'warn' | 'bad') => tint(level, opts.palette)

    const turnCosts = await read($, turns)
    const lastCost = turnCosts.length > 0 ? turnCosts[turnCosts.length - 1] : undefined
    const tok = await read($, tokens)
    const hit = cacheHitPercent(tok)
    const days = lastDays(await read($, history), now, 7)
    const today = days[days.length - 1]

    return (
      <Box flexDirection="column">
        {snap.limits.length === 0 ? (
          <Text dimColor>No usage limit reported (not on a subscription?).</Text>
        ) : (
          snap.limits.map(l => {
            const left = Math.round((100 - l.percentUsed) * 10) / 10
            const color = paint(levelLeft(left))
            const pace = paceNote(l, now)

            return isCompact ? (
              <Text key={l.kind} color={color}>
                {labelFor(l.kind)} {drawBar(left, width - 10)} {left}%
                <Text dimColor> {resetsIn(l.resetsAt, now).replace('resets in ', '')}</Text>
                {pace ? <Text bold> !</Text> : null}
              </Text>
            ) : (
              <Box key={l.kind} flexDirection="column">
                <Text bold>
                  {labelFor(l.kind)} <Text color={color}>{left}% left</Text>
                </Text>
                <Text color={color}>{drawBar(left, width)}</Text>
                <Text dimColor>{resetsIn(l.resetsAt, now) || ' '}</Text>
                {pace ? <Text color={paint('bad')} bold>{`! ${pace}`}</Text> : null}
                <Text> </Text>
              </Box>
            )
          })
        )}

        {snap.contextPercent !== null ? (
          <Box flexDirection="column">
            <Text bold>
              Context <Text color={paint(levelUsed(snap.contextPercent))}>{snap.contextPercent}% used</Text>
            </Text>
            {isCompact ? null : (
              <Text color={paint(levelUsed(snap.contextPercent))}>{drawBar(100 - snap.contextPercent, width)}</Text>
            )}
            {!isCompact && opts.showBreakdown
              ? snap.categories.map(c => (
                  <Text key={c.name} dimColor>
                    {`  ${c.name} ${formatTokens(c.tokens)}`}
                  </Text>
                ))
              : null}
            {isCompact ? null : <Text> </Text>}
          </Box>
        ) : null}

        {opts.showTokens && !isCompact && tok.input + tok.output + tok.cacheRead > 0 ? (
          <Box flexDirection="column">
            <Text bold>Tokens</Text>
            <Text dimColor>
              {`  in ${formatTokens(tok.input + tok.cacheWrite)} · out ${formatTokens(tok.output)}`}
              {hit !== null ? ` · cache ${hit}%` : ''}
            </Text>
            <Text> </Text>
          </Box>
        ) : null}

        {snap.usd !== null ? (
          <Text dimColor>
            {`Session $${snap.usd.toFixed(2)}`}
            {opts.showTurns && lastCost !== undefined ? ` · last reply $${lastCost.toFixed(2)}` : ''}
          </Text>
        ) : null}
        {opts.showTurns && !isCompact && turnCosts.length > 1 ? (
          <Text dimColor>{`Replies ${sparkline(turnCosts)}`}</Text>
        ) : null}

        {opts.showHistory && !isCompact && today ? (
          <Box flexDirection="column">
            <Text> </Text>
            <Text bold>7 days</Text>
            <Text dimColor>{`  spend ${sparkline(days.map(d => d.usd))} · today $${today.usd.toFixed(2)}`}</Text>
            <Text dimColor>{`  peak  ${sparkline(days.map(d => d.peak))} · today ${Math.round(today.peak)}%`}</Text>
          </Box>
        ) : null}
      </Box>
    )
  })

  // The one-line bar: the fallback while the panel is not seated, or always with /credits-bar.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const snap = await read($, snapshot)
    const mode = await read($, bandMode)
    const isWanted = mode === 'on' || (mode === 'auto' && !(await isPaneUp($)))

    await read($, tick)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = Date.now()
    const paint = (level: 'good' | 'warn' | 'bad') => tint(level, opts.palette)

    // The icon button: always there, shows the tightest limit, click toggles the side panel.
    const tightest = snap && snap.limits.length > 0 ? Math.min(...snap.limits.map(l => 100 - l.percentUsed)) : null
    const chip = (
      <Button
        key="credits-chip"
        label={tightest === null ? '◔ credits' : `◔ ${Math.round(tightest)}% left`}
        onPress={async () => {
          if (await isPaneUp($)) await $.ui.close({ id: PANE })
          else await $.ui.open({ id: PANE, title: 'Credits' })
        }}
      />
    )

    if (snap === null || !isWanted) {
      return <Box justifyContent="flex-end">{chip}</Box>
    }

    // The bar's readings on the left, the icon button pushed to the right edge.
    return (
      <Box justifyContent="space-between">
        <Box>
        {snap.limits.length === 0 ? (
          <Text dimColor>Credits: no usage limit reported yet </Text>
        ) : (
          snap.limits.map(l => {
            const left = Math.round((100 - l.percentUsed) * 10) / 10
            const pace = paceNote(l, now)

            return (
              <Text key={l.kind} color={paint(levelLeft(left))}>
                {labelFor(l.kind)} {drawBar(left, 10)} {left}% left
                {pace ? <Text bold>{` (${pace})`}</Text> : null}
                {'  '}
              </Text>
            )
          })
        )}
        {snap.contextPercent !== null ? (
          <Text color={paint(levelUsed(snap.contextPercent))}>ctx {snap.contextPercent}% </Text>
        ) : null}
        {snap.usd !== null ? <Text dimColor>${snap.usd.toFixed(2)} </Text> : null}
        <Button key="hide" label="Hide (/credits-bar to restore)" onPress={() => update($, bandMode, () => 'off')} />
        </Box>
        {chip}
      </Box>
    )
  })
}
