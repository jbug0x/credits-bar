import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { PET_WIDTH, petMini, petSprite, petState } from './pet'
import { buildReport } from './report'
import { STRINGS } from './strings'
import {
  addTokens,
  barChart,
  cacheHitPercent,
  drawBar,
  formatTokens,
  goalPercent,
  historyCsv,
  labelFor,
  lastDays,
  levelLeft,
  levelUsed,
  money,
  newAlerts,
  paceNote,
  projectName,
  projectTotals,
  recordDay,
  resetsIn,
  resolveOptions,
  shortModel,
  sparkline,
  tint,
  toSnapshot
} from './usage'

const PANE = 'credits'
const TICK_MS = 30_000
const MAX_TURNS = 8
const CHART_DAYS = 14
const PET_MS = 1500

const snapshot = atom({ plugin: 'credits-bar', key: 'snapshot' } as const, null)
// 'auto': the band shows only while the panel is not seated; 'on': always; 'off': never.
const bandMode = atom({ plugin: 'credits-bar', key: 'bandMode' } as const, 'auto')
const turns = atom({ plugin: 'credits-bar', key: 'turns' } as const, [])
const tokens = atom({ plugin: 'credits-bar', key: 'tokens' } as const, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
const history = atom({ plugin: 'credits-bar', key: 'history' } as const, {})
const tick = atom({ plugin: 'credits-bar', key: 'tick' } as const, 0)
const models = atom({ plugin: 'credits-bar', key: 'models' } as const, {})
const pet = atom({ plugin: 'credits-bar', key: 'pet' } as const, { working: false, lastActive: 0, partyUntil: 0 })
const petOn = atom({ plugin: 'credits-bar', key: 'petOn' } as const, true)
const frame = atom({ plugin: 'credits-bar', key: 'frame' } as const, 0)

async function isPaneUp($: EngineInterface): Promise<boolean> {
  try {
    return (await $.ui.panes()).some(p => p.id === PANE && p.isPlaced)
  } catch {
    return false
  }
}

// Plays only where the platform has a player (macOS); elsewhere the engine plays nothing.
async function playAlert($: EngineInterface): Promise<void> {
  try {
    await $.audio.play({ asset: 'sounds/alert.wav' })
  } catch {
    // no sound is never worth a failure
  }
}

export const register: Register = (on, options) => {
  const opts = resolveOptions(options as Record<string, unknown> | undefined)
  const str = STRINGS[opts.language]

  // Thresholds already toasted this process (keyed by limit, reset time and threshold).
  let seen: ReadonlySet<string> = new Set()
  let lastUsd: number | null = null
  let pending = 0
  let sessionSpent = 0
  let project = ''
  let goalDay = ''
  let petBeat = 0
  // How often each surface asked the hooks to draw (for /credits-debug).
  const draws: Record<string, number> = {}

  on('session.start', async ($, e, next) => {
    await update($, bandMode, () => 'auto')
    project = projectName(await $.session.cwd())

    await $.command.register({ name: 'credits-panel', description: str.cmdPanel })
    await $.command.register({ name: 'credits-bar', description: str.cmdBar })
    await $.command.register({ name: 'credits-export', description: str.cmdExport })
    await $.command.register({ name: 'credits-pet', description: str.cmdPet })
    await $.command.register({ name: 'credits', description: str.cmdReport })
    await $.command.register({ name: 'credits-debug', description: 'Report where the mod draws (for bug reports)' })

    await update($, petOn, () => opts.pet)
    const started = await $.clock.now()
    await update($, pet, () => ({ working: false, lastActive: started, partyUntil: 0 }))

    const stored = await $.store.get('history')
    if (stored && typeof stored === 'object') {
      await update($, history, () => stored as Record<string, { usd: number; peak: number }>)
    }

    // Between responses, refresh the limits and the context fill (a local read, free) and
    // keep "resets in 48m" moving.
    $.clock.every(TICK_MS, async () => {
      try {
        const value = toSnapshot(await $.session.usage({ breakdown: opts.showBreakdown ? 'summary' : undefined }))
        await update($, snapshot, () => value)
      } catch {
        // keep the previous reading
      }
      await update($, tick, n => n + 1)
    })

    // The pet's heartbeat: a frame every 1.5s, a third of that while it sleeps.
    $.clock.every(PET_MS, async () => {
      try {
        if (!(await read($, petOn))) return
        const mem = await read($, pet)
        const asleep = !mem.working && (await $.clock.now()) - mem.lastActive > 60_000
        petBeat += 1
        if (asleep && petBeat % 3 !== 0) return
        await update($, frame, n => n + 1)
      } catch {
        // the pet can skip a beat
      }
    })

    // Unasked, the pane seats from 144 columns; below that the one-line band stands in.
    void $.ui.open({ id: PANE, title: 'Credits' })

    return next(e)
  })

  // /credits-panel: open the side panel (at any width when asked), or close it.
  on('command.run', { command: 'credits-panel' }, async $ => {
    if (await isPaneUp($)) {
      await $.ui.close({ id: PANE })

      return { text: str.panelClosed }
    }

    const opened = await $.ui.open({ id: PANE, title: 'Credits' })

    return { text: opened.isPlaced ? str.panelOpened : str.panelCannot }
  })

  // /credits-bar: show the one-line bar above the prompt, or hide it.
  on('command.run', { command: 'credits-bar' }, async $ => {
    const isShowing = (await read($, bandMode)) === 'on' || ((await read($, bandMode)) === 'auto' && !(await isPaneUp($)))
    await update($, bandMode, () => (isShowing ? 'off' : 'on'))

    return { text: isShowing ? str.barHidden : str.barShown }
  })

  // /credits-pet: send the pet off for a nap, or call it back.
  on('command.run', { command: 'credits-pet' }, async $ => {
    const next = !(await read($, petOn))
    await update($, petOn, () => next)

    return { text: next ? str.petOn : str.petOff }
  })

  // /credits: the whole panel as plain text, for surfaces that do not draw it.
  on('command.run', { command: 'credits' }, async $ => {
    const now = await $.clock.now()
    const snap = await read($, snapshot)
    const hist = await read($, history)
    const mem = await read($, pet)
    const today = new Date(now).toISOString().slice(0, 10)

    return {
      text: buildReport({
        lang: opts.language,
        now,
        snap,
        tokens: await read($, tokens),
        todayUsd: hist[today]?.usd ?? 0,
        dailyGoal: opts.dailyGoal,
        projects: projectTotals(hist, now, 7, 3),
        petName: opts.petName,
        mood: petState(mem, now, Math.max(0, ...(snap?.limits ?? []).map(l => l.percentUsed)), {
          low: opts.alertLow,
          high: opts.alertHigh
        }),
        frame: await read($, frame),
        isPetOn: await read($, petOn)
      })
    }
  })

  // /credits-debug: where is the mod loaded and drawn? Paste the answer into a bug report.
  on('command.run', { command: 'credits-debug' }, async $ => {
    const surfaces = await $.session.surfaces()
    const panes = (await $.ui.panes()).map(p => `${p.id}(placed=${p.isPlaced}, shown=${p.isShown})`)
    const drawn = Object.entries(draws).map(([k, n]) => `${k}=${n}`)
    const hasReading = (await read($, snapshot)) !== null

    return {
      text: [
        `surfaces: ${surfaces.join(', ') || 'none'}`,
        `panes: ${panes.join(', ') || 'none'}`,
        `draw calls: ${drawn.join(', ') || 'none yet'}`,
        `reading: ${hasReading ? 'yes' : 'not yet (send a prompt)'}`
      ].join(' | ')
    }
  })

  // /credits-export: write the spend history to credits-history.csv in the current folder.
  on('command.run', { command: 'credits-export' }, async $ => {
    try {
      const csv = historyCsv(await read($, history))
      const path = `${await $.session.cwd()}/credits-history.csv`
      await $.fs.write(path, csv.text)

      return { text: str.exported(path, csv.rows) }
    } catch (error) {
      return { text: str.exportFailed(error instanceof Error ? error.message : 'unknown error') }
    }
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
    sessionSpent += spent

    const peak = Math.max(0, ...value.limits.map(l => l.percentUsed))
    const days = recordDay(await read($, history), now, spent, peak, project || undefined)
    await update($, history, () => days)
    await $.store.set('history', days)

    const alerts = newAlerts(value.limits, seen, opts, now)
    seen = alerts.seen
    for (const message of alerts.messages) $.ui.toast(message)
    let isAlert = alerts.messages.length > 0

    // The daily goal, once per day.
    const today = new Date(now).toISOString().slice(0, 10)
    const spentToday = days[today]?.usd ?? 0
    if (opts.dailyGoal > 0 && spentToday >= opts.dailyGoal && goalDay !== today) {
      goalDay = today
      $.ui.toast(str.goalHit(money(spentToday), money(opts.dailyGoal)))
      await update($, pet, p => ({ ...p, partyUntil: now + 12_000 }))
      isAlert = true
    }

    if (isAlert && opts.sound) await playAlert($)

    return next(e)
  })

  // The first reading, so the numbers are there from the first turn.
  on('prompt.submit', async ($, e, next) => {
    // Nothing here may get in the way of the prompt.
    try {
      const stamp = await $.clock.now()
      await update($, pet, p => ({ ...p, working: true, lastActive: stamp }))
      const value = toSnapshot(await $.session.usage({ breakdown: opts.showBreakdown ? 'summary' : undefined }))
      await update($, snapshot, () => value)
      if (lastUsd === null && value.usd !== null) lastUsd = value.usd
    } catch {
      // keep the previous reading
    }

    return next(e)
  })

  // A turn ended: file what it cost, which model ran it and what tokens it used.
  on('turn.complete', async ($, e, next) => {
    const stamp = await $.clock.now()
    await update($, pet, p => ({
      working: false,
      lastActive: stamp,
      partyUntil: e.reason === 'answer' ? stamp + 5000 : p.partyUntil
    }))

    const cost = pending
    pending = 0
    await update($, turns, list => [...list, cost].slice(-MAX_TURNS))
    if (e.usage) {
      const usage = e.usage
      await update($, tokens, t => addTokens(t, usage))
      const name = shortModel(usage.model)
      await update($, models, m => ({
        ...m,
        [name]: { usd: (m[name]?.usd ?? 0) + cost, output: (m[name]?.output ?? 0) + usage.output_tokens }
      }))
    }

    return next(e)
  })

  // The session is ending: one toast with the total spent and how far the limits got.
  on('session.end', async ($, e, next) => {
    if (opts.sessionSummary) {
      const snap = await read($, snapshot)
      const parts = (snap?.limits ?? []).map(l => str.usedShort(labelFor(l.kind), Math.round(l.percentUsed))).join(' · ')
      const spent = sessionSpent > 0 ? sessionSpent : (snap?.usd ?? 0)
      if (spent > 0 || parts) $.ui.toast(str.summary(money(spent), parts))
    }

    return next(e)
  })

  // The side panel.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    draws[`pane@${e.surface}`] = (draws[`pane@${e.surface}`] ?? 0) + 1
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    const isPetOn = await read($, petOn)
    const frameNo = isPetOn ? await read($, frame) : 0
    const mem = await read($, pet)

    await read($, tick)
    const now = Date.now()
    const rows = e.viewport?.rows ?? 40
    const isCompact = opts.compact === 'always' || (opts.compact === 'auto' && rows < 24)

    const mood = petState(
      mem,
      now,
      Math.max(0, ...(snap?.limits ?? []).map(l => l.percentUsed)),
      { low: opts.alertLow, high: opts.alertHigh }
    )
    const petBlock = isPetOn ? (
      <Box flexDirection="column">
        {isCompact ? (
          <Text>{`${petMini(mood, frameNo)}  ${opts.petName} · ${str.mood[mood]}`}</Text>
        ) : (
          <Box flexDirection="column">
            {petSprite(mood, frameNo, Math.max(0, Math.min(14, (e.viewport?.columns ?? 40) - 4 - PET_WIDTH))).map((line, i) => (
              <Text key={i} color={opts.palette === 'mono' ? undefined : 'yellow'}>
                {line}
              </Text>
            ))}
            <Text dimColor>{` ${opts.petName} · ${str.mood[mood]}`}</Text>
            <Text dimColor>{` » ${str.bubbles[mood][Math.floor(frameNo / 10) % str.bubbles[mood].length]}`}</Text>
          </Box>
        )}
        <Text> </Text>
      </Box>
    ) : null

    if (snap === null) {
      return (
        <Box flexDirection="column">
          {petBlock}
          <Text dimColor>{str.noReading}</Text>
        </Box>
      )
    }

    const width = Math.max(8, Math.min(30, (e.viewport?.columns ?? 40) - 4))
    const paint = (level: 'good' | 'warn' | 'bad') => tint(level, opts.palette)

    const turnCosts = await read($, turns)
    const lastCost = turnCosts.length > 0 ? turnCosts[turnCosts.length - 1] : undefined
    const tok = await read($, tokens)
    const hit = cacheHitPercent(tok)
    const byModel = Object.entries(await read($, models)).sort((a, b) => b[1].usd - a[1].usd)
    const hist = await read($, history)
    const days = lastDays(hist, now, 7)
    const today = days[days.length - 1]
    const goal = today ? goalPercent(today.usd, opts.dailyGoal) : null
    const dataDays = Object.keys(hist).length
    const isTall = rows >= 30 && dataDays >= 4 && !isCompact
    const longDays = lastDays(hist, now, CHART_DAYS)
    const topProjects = projectTotals(hist, now, 7, 3)

    return (
      <Box flexDirection="column">
        {petBlock}
        {snap.limits.length === 0 ? (
          <Text dimColor>{str.noLimit}</Text>
        ) : (
          snap.limits.map(l => {
            const left = Math.round((100 - l.percentUsed) * 10) / 10
            const color = paint(levelLeft(left))
            const pace = paceNote(l, now, opts.language)

            return isCompact ? (
              <Text key={l.kind} color={color}>
                {labelFor(l.kind)} {drawBar(left, width - 10)} {left}%
                <Text dimColor> {resetsIn(l.resetsAt, now, opts.language).replace(/^[^ ]+ [^ ]+ /, '')}</Text>
                {pace ? <Text bold> !</Text> : null}
              </Text>
            ) : (
              <Box key={l.kind} flexDirection="column">
                <Text bold>
                  {labelFor(l.kind)} <Text color={color}>{str.left(left)}</Text>
                </Text>
                <Text color={color}>{drawBar(left, width)}</Text>
                <Text dimColor>{resetsIn(l.resetsAt, now, opts.language) || ' '}</Text>
                {pace ? <Text color={paint('bad')} bold>{`! ${pace}`}</Text> : null}
                <Text> </Text>
              </Box>
            )
          })
        )}

        {goal !== null && today ? (
          <Box flexDirection="column">
            <Text bold>
              {str.goal} <Text color={paint(levelUsed(Math.min(100, goal)))}>{goal}%</Text>
            </Text>
            {isCompact ? null : (
              <Text color={paint(levelUsed(Math.min(100, goal)))}>{drawBar(100 - Math.min(100, goal), width)}</Text>
            )}
            <Text dimColor>{str.goalLine(money(today.usd), money(opts.dailyGoal))}</Text>
            {isCompact ? null : <Text> </Text>}
          </Box>
        ) : null}

        {snap.contextPercent !== null ? (
          <Box flexDirection="column">
            <Text bold>
              {str.context} <Text color={paint(levelUsed(snap.contextPercent))}>{str.usedPercent(snap.contextPercent)}</Text>
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
            <Text bold>{str.tokens}</Text>
            <Text dimColor>
              {`  ${str.tokensLine(formatTokens(tok.input + tok.cacheWrite), formatTokens(tok.output))}`}
              {hit !== null ? ` · ${str.cacheHit(hit)}` : ''}
            </Text>
            {byModel.length > 0 ? (
              <Box flexDirection="column">
                <Text bold>{str.models}</Text>
                {byModel.slice(0, 3).map(([name, m]) => (
                  <Text key={name} dimColor>{`  ${name} ${money(m.usd)} · ${formatTokens(m.output)} out`}</Text>
                ))}
              </Box>
            ) : null}
            <Text> </Text>
          </Box>
        ) : null}

        {snap.usd !== null ? (
          <Text dimColor>
            {`${str.session} ${money(snap.usd)}`}
            {opts.showTurns && lastCost !== undefined ? ` · ${str.lastReply} ${money(lastCost)}` : ''}
          </Text>
        ) : null}
        {opts.showTurns && !isCompact && turnCosts.length > 1 ? (
          <Text dimColor>{`${str.replies} ${sparkline(turnCosts)}`}</Text>
        ) : null}

        {opts.showProjects && !isCompact && topProjects.length > 0 ? (
          <Box flexDirection="column">
            <Text> </Text>
            <Text bold>{str.projects}</Text>
            {topProjects.map(([name, usd]) => (
              <Text key={name} dimColor>{`  ${name} ${money(usd)}`}</Text>
            ))}
          </Box>
        ) : null}

        {opts.showHistory && !isCompact && today ? (
          <Box flexDirection="column">
            <Text> </Text>
            <Text bold>{str.days(isTall ? CHART_DAYS : 7)}</Text>
            {isTall ? (
              <Box flexDirection="column">
                {barChart(longDays.map(d => d.usd), 4).map((line, i) => (
                  <Text key={i} dimColor>{`  ${line}`}</Text>
                ))}
                <Text dimColor>{`  ${str.spend} · ${str.today} ${money(today.usd)}`}</Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Text dimColor>{`  ${str.spend} ${sparkline(days.map(d => d.usd))} · ${str.today} ${money(today.usd)}`}</Text>
                <Text dimColor>{`  ${str.peak}  ${sparkline(days.map(d => d.peak))} · ${str.today} ${Math.round(today.peak)}%`}</Text>
              </Box>
            )}
          </Box>
        ) : null}
      </Box>
    )
  })

  // The one-line bar: the fallback while the panel is not seated, or always with /credits-bar.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    draws[`band@${e.surface}`] = (draws[`band@${e.surface}`] ?? 0) + 1
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
        label={tightest === null ? str.chipEmpty : str.chipLeft(Math.round(tightest))}
        onPress={async () => {
          if (await isPaneUp($)) await $.ui.close({ id: PANE })
          else await $.ui.open({ id: PANE, title: 'Credits' })
        }}
      />
    )

    // The pet rides along, just left of the icon button.
    const isPetOn = await read($, petOn)
    const bandFrame = isPetOn ? await read($, frame) : 0
    const bandMood = petState(
      await read($, pet),
      now,
      Math.max(0, ...(snap?.limits ?? []).map(l => l.percentUsed)),
      { low: opts.alertLow, high: opts.alertHigh }
    )
    const right = (
      <Box>
        {isPetOn ? <Text>{`${petMini(bandMood, bandFrame)}  `}</Text> : null}
        {chip}
      </Box>
    )

    if (snap === null || !isWanted) {
      return <Box justifyContent="flex-end">{right}</Box>
    }

    // The bar's readings on the left, the icon button pushed to the right edge.
    return (
      <Box justifyContent="space-between">
        <Box>
          {snap.limits.length === 0 ? (
            <Text dimColor>{str.noLimitBar}</Text>
          ) : (
            snap.limits.map(l => {
              const left = Math.round((100 - l.percentUsed) * 10) / 10
              const pace = paceNote(l, now, opts.language)

              return (
                <Text key={l.kind} color={paint(levelLeft(left))}>
                  {labelFor(l.kind)} {drawBar(left, 10)} {str.left(left)}
                  {pace ? <Text bold>{` (${pace})`}</Text> : null}
                  {'  '}
                </Text>
              )
            })
          )}
          {snap.contextPercent !== null ? (
            <Text color={paint(levelUsed(snap.contextPercent))}>ctx {snap.contextPercent}% </Text>
          ) : null}
          {snap.usd !== null ? <Text dimColor>{money(snap.usd)} </Text> : null}
          <Button key="hide" label={str.hide} onPress={() => update($, bandMode, () => 'off')} />
        </Box>
        {right}
      </Box>
    )
  })
}
