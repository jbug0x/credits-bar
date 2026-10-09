// A plain-text summary of everything the panel shows, for surfaces that do not draw it (and for
// the /credits command). Pure: give it the readings, get lines back.
import type { Snapshot, TokenTotals } from '../types'
import { petMini } from './pet'
import type { PetState } from './pet'
import { STRINGS } from './strings'
import type { Lang } from './strings'
import { cacheHitPercent, drawBar, formatTokens, labelFor, money, paceNote, resetsIn } from './usage'

export type ReportInput = {
  lang: Lang
  now: number
  snap: Snapshot | null
  tokens: TokenTotals
  todayUsd: number
  dailyGoal: number
  projects: [string, number][]
  petName: string
  mood: PetState
  frame: number
  isPetOn: boolean
}

export function buildReport(r: ReportInput): string {
  const str = STRINGS[r.lang]
  const lines: string[] = []

  if (r.isPetOn) lines.push(`${petMini(r.mood, r.frame)}  ${r.petName} · ${str.mood[r.mood]}`)

  if (r.snap === null) {
    lines.push(str.noReading)

    return lines.join('\n')
  }

  if (r.snap.limits.length === 0) lines.push(str.noLimit)
  for (const l of r.snap.limits) {
    const left = Math.round((100 - l.percentUsed) * 10) / 10
    const pace = paceNote(l, r.now, r.lang)
    const reset = resetsIn(l.resetsAt, r.now, r.lang)
    lines.push(`${labelFor(l.kind)}  ${drawBar(left, 14)}  ${str.left(left)}${reset ? ` · ${reset}` : ''}${pace ? ` · ! ${pace}` : ''}`)
  }

  if (r.dailyGoal > 0) {
    const pct = Math.round((r.todayUsd / r.dailyGoal) * 100)
    lines.push(`${str.goal}  ${drawBar(100 - Math.min(100, pct), 14)}  ${pct}% · ${str.goalLine(money(r.todayUsd), money(r.dailyGoal))}`)
  }

  if (r.snap.contextPercent !== null) {
    const top = r.snap.categories.map(c => `${c.name} ${formatTokens(c.tokens)}`).join(', ')
    lines.push(`${str.context}  ${drawBar(100 - r.snap.contextPercent, 14)}  ${str.usedPercent(r.snap.contextPercent)}${top ? ` (${top})` : ''}`)
  }

  const total = r.tokens.input + r.tokens.output + r.tokens.cacheRead
  if (total > 0) {
    const hit = cacheHitPercent(r.tokens)
    lines.push(
      `${str.tokens}  ${str.tokensLine(formatTokens(r.tokens.input + r.tokens.cacheWrite), formatTokens(r.tokens.output))}${hit !== null ? ` · ${str.cacheHit(hit)}` : ''}`
    )
  }

  if (r.snap.usd !== null) lines.push(`${str.session}  ${money(r.snap.usd)}`)
  if (r.projects.length > 0) lines.push(`${str.projects}  ${r.projects.map(([n, usd]) => `${n} ${money(usd)}`).join(' · ')}`)

  return lines.join('\n')
}
