// Pure helpers (no engine calls) so they can be unit-tested.
import type { Category, DayRecord, History, Limit, Snapshot, TokenTotals } from '../types'
import { STRINGS } from './strings'
import type { Lang } from './strings'

export const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * 60 * 60 * 1000,
  seven_day: 7 * 24 * 60 * 60 * 1000
}

export type Options = {
  alertLow: number
  alertHigh: number
  showHistory: boolean
  showBreakdown: boolean
  showTokens: boolean
  showTurns: boolean
  compact: 'auto' | 'always' | 'never'
  palette: 'default' | 'colorblind' | 'mono'
  language: Lang
  dailyGoal: number
  sessionSummary: boolean
  showProjects: boolean
  sound: boolean
  pet: boolean
  petName: string
}

export const DEFAULT_OPTIONS: Options = {
  alertLow: 80,
  alertHigh: 95,
  showHistory: true,
  showBreakdown: true,
  showTokens: true,
  showTurns: true,
  compact: 'auto',
  palette: 'default',
  language: 'en',
  dailyGoal: 0,
  sessionSummary: true,
  showProjects: true,
  sound: false,
  pet: true,
  petName: 'Pip'
}

// `userConfig` values arrive loosely typed (numbers may arrive as strings): clamp and default each.
export function resolveOptions(raw: Record<string, unknown> | undefined): Options {
  const o = raw ?? {}
  const num = (v: unknown, d: number) =>
    v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
    allowed.includes(v as T) ? (v as T) : d

  const low = Math.min(100, Math.max(1, num(o.alertLow, DEFAULT_OPTIONS.alertLow)))
  const high = Math.min(100, Math.max(low, num(o.alertHigh, DEFAULT_OPTIONS.alertHigh)))

  return {
    alertLow: low,
    alertHigh: high,
    showHistory: bool(o.showHistory, true),
    showBreakdown: bool(o.showBreakdown, true),
    showTokens: bool(o.showTokens, true),
    showTurns: bool(o.showTurns, true),
    compact: pick(o.compact, ['auto', 'always', 'never'] as const, 'auto'),
    palette: pick(o.palette, ['default', 'colorblind', 'mono'] as const, 'default'),
    language: pick(o.language, ['en', 'pt'] as const, 'en'),
    dailyGoal: Math.max(0, num(o.dailyGoal, 0)),
    sessionSummary: bool(o.sessionSummary, true),
    showProjects: bool(o.showProjects, true),
    sound: bool(o.sound, false),
    pet: bool(o.pet, true),
    petName:
      typeof o.petName === 'string' && o.petName.trim() !== '' ? o.petName.trim().slice(0, 16) : DEFAULT_OPTIONS.petName
  }
}

type RawLimit = { kind: string; percentUsed: number; resetsAt?: string }
type RawCategory = { name: string; tokens: number; kind: string }
type RawUsage = {
  rateLimits: RawLimit[]
  cost?: { usd: number }
  context: { percent?: number; breakdown?: { categories: RawCategory[] } }
}

export function toSnapshot(u: RawUsage): Snapshot {
  return {
    limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
    usd: u.cost?.usd ?? null,
    contextPercent: u.context.percent ?? null,
    categories: topCategories(u.context.breakdown?.categories ?? [])
  }
}

// What is filling the window: the biggest `used` rows, largest first.
export function topCategories(rows: RawCategory[], n = 4): Category[] {
  return rows
    .filter(r => r.kind === 'used' && r.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, n)
    .map(r => ({ name: r.name, tokens: r.tokens }))
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`

  return String(n)
}

// "Out in 40m": if the current burn rate holds, when does this window run dry?
// Returns null when there is not enough signal or the window will last until reset.
export function paceNote(limit: Limit, now: number, lang: Lang = 'en'): string | null {
  const windowMs = WINDOW_MS[limit.kind]
  if (!windowMs || !limit.resetsAt || limit.percentUsed < 10) return null

  const remainingMs = Date.parse(limit.resetsAt) - now
  const elapsedMs = windowMs - remainingMs
  if (!(remainingMs > 0) || elapsedMs < windowMs * 0.05) return null

  const msToEmpty = (elapsedMs * (100 - limit.percentUsed)) / limit.percentUsed
  if (msToEmpty >= remainingMs) return null

  return STRINGS[lang].outIn(formatDuration(msToEmpty))
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`

  return `${Math.round(minutes / (24 * 60))}d`
}

export function resetsIn(iso: string | undefined, now: number, lang: Lang = 'en'): string {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return STRINGS[lang].resetting

  return STRINGS[lang].resetsIn(formatDuration(ms))
}

export function labelFor(kind: string): string {
  return kind === 'five_hour' ? '5h' : kind === 'seven_day' ? '7d' : kind === 'spend_limit' ? 'Spend' : kind
}

// Toasts: a limit passing `alertLow` or `alertHigh`, and a window newly on pace to run dry.
// Each fires once per window (keys include the reset time).
export function newAlerts(
  limits: Limit[],
  seen: ReadonlySet<string>,
  opts: Pick<Options, 'alertLow' | 'alertHigh'> & { language?: Lang } = DEFAULT_OPTIONS,
  now = 0
): { messages: string[]; seen: Set<string> } {
  const str = STRINGS[opts.language ?? 'en']
  const next = new Set(seen)
  const messages: string[] = []

  for (const l of limits) {
    const label = labelFor(l.kind)

    for (const t of [opts.alertLow, opts.alertHigh]) {
      const key = `${l.kind}:${l.resetsAt ?? ''}:${t}`
      if (l.percentUsed >= t && !next.has(key)) {
        next.add(key)
        messages.push(str.limitUsed(label, Math.floor(l.percentUsed)))
      }
    }

    const pace = now ? paceNote(l, now, opts.language ?? 'en') : null
    const paceKey = `pace:${l.kind}:${l.resetsAt ?? ''}`
    if (pace && !next.has(paceKey)) {
      next.add(paceKey)
      messages.push(str.paceWarn(label, pace))
    }
  }

  // Crossing both thresholds in one jump yields the same text twice; show it once.
  return { messages: [...new Set(messages)], seen: next }
}

// --- history (kept across sessions in $.store) ---

export const HISTORY_DAYS = 14

export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// Adds `usd` spent and the highest limit percentage seen to today's record, pruning old days.
export function recordDay(history: History, ms: number, usd: number, peak: number, project?: string): History {
  const key = dayKey(ms)
  const prev: DayRecord = history[key] ?? { usd: 0, peak: 0 }
  const add = Math.max(0, usd)
  const projects = { ...(prev.projects ?? {}) }
  if (project && add > 0) projects[project] = (projects[project] ?? 0) + add
  const next: History = {
    ...history,
    [key]: {
      usd: prev.usd + add,
      peak: Math.max(prev.peak, peak),
      ...(Object.keys(projects).length > 0 ? { projects } : {})
    }
  }
  const keep = Object.keys(next).sort().slice(-HISTORY_DAYS)

  return Object.fromEntries(keep.map(k => [k, next[k] as DayRecord]))
}

// The last `days` days, oldest first, zero-filled.
export function lastDays(history: History, ms: number, days = 7): { key: string; usd: number; peak: number }[] {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(ms - i * 24 * 3600 * 1000)
    const r = history[key]
    out.push({ key, usd: r?.usd ?? 0, peak: r?.peak ?? 0 })
  }

  return out
}

const BLOCKS = '▁▂▃▄▅▆▇█'

export function sparkline(values: number[]): string {
  const max = Math.max(...values, 0)
  if (max <= 0) return BLOCKS.charAt(0).repeat(values.length)

  return values
    .map(v => (v <= 0 ? BLOCKS.charAt(0) : BLOCKS.charAt(Math.min(7, Math.ceil((v / max) * 7)))))
    .join('')
}

// --- tokens ---

export function addTokens(
  t: TokenTotals,
  u: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
    cache_creation_input_tokens: number
  }
): TokenTotals {
  return {
    input: t.input + u.input_tokens,
    output: t.output + u.output_tokens,
    cacheRead: t.cacheRead + u.cache_read_input_tokens,
    cacheWrite: t.cacheWrite + u.cache_creation_input_tokens
  }
}

// Share of input served from the prompt cache, 0 to 100; null with no input yet.
export function cacheHitPercent(t: TokenTotals): number | null {
  const total = t.input + t.cacheRead + t.cacheWrite
  if (total <= 0) return null

  return Math.round((t.cacheRead / total) * 100)
}

// --- palette ---

export type Level = 'good' | 'warn' | 'bad'
export type Tint = 'green' | 'yellow' | 'red' | 'blue' | 'magenta' | undefined

export function tint(level: Level, palette: Options['palette']): Tint {
  if (palette === 'mono') return undefined
  if (palette === 'colorblind') return level === 'good' ? 'blue' : level === 'warn' ? 'yellow' : 'magenta'

  return level === 'good' ? 'green' : level === 'warn' ? 'yellow' : 'red'
}

export const levelLeft = (percentLeft: number): Level => (percentLeft > 50 ? 'good' : percentLeft > 20 ? 'warn' : 'bad')
export const levelUsed = (percentUsed: number): Level => (percentUsed < 50 ? 'good' : percentUsed < 80 ? 'warn' : 'bad')

export function drawBar(percentLeft: number, width: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, percentLeft)) / 100) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// --- projects, models, goal, chart, csv ---

// The folder's own name: "C:\code\my-app" and "/home/me/my-app" both give "my-app".
export function projectName(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean)

  return parts[parts.length - 1] ?? cwd
}

// Spend per project over the last `days` days, biggest first.
export function projectTotals(history: History, ms: number, days = 7, n = 4): [string, number][] {
  const totals: Record<string, number> = {}
  for (const d of lastDays(history, ms, days)) {
    for (const [name, usd] of Object.entries(history[d.key]?.projects ?? {})) totals[name] = (totals[name] ?? 0) + usd
  }

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

// "claude-opus-4-5-20251001" -> "opus-4-5"
export function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

export function money(usd: number): string {
  return `$${usd.toFixed(2)}`
}

// How far along the daily goal is, 0 to 100+; null when no goal is set.
export function goalPercent(spent: number, goal: number): number | null {
  return goal > 0 ? Math.round((spent / goal) * 100) : null
}

// A vertical bar chart `height` rows tall, one column pair per value; rows run top to bottom.
export function barChart(values: number[], height: number): string[] {
  const max = Math.max(...values, 0)
  const rows: string[] = []

  for (let r = height - 1; r >= 0; r--) {
    let line = ''
    for (const v of values) {
      const units = max > 0 ? Math.round((v / max) * height * 8) : 0
      const fill = Math.max(0, Math.min(8, units - r * 8))
      const cell = fill === 0 ? ' ' : BLOCKS.charAt(fill - 1)
      line += cell + cell
    }
    rows.push(line.replace(/\s+$/, ''))
  }

  return rows
}

// The spend history as CSV: one row per day and project (a "-" project when none was recorded).
export function historyCsv(history: History): { text: string; rows: number } {
  const lines = ['date,project,usd,peak_percent']
  let rows = 0

  for (const date of Object.keys(history).sort()) {
    const rec = history[date] as DayRecord
    const entries = Object.entries(rec.projects ?? {})
    const named = entries.reduce((sum, [, v]) => sum + v, 0)
    const csvName = (n: string) => (/[",\n]/.test(n) ? `"${n.replace(/"/g, '""')}"` : n)

    for (const [name, usd] of entries) {
      lines.push(`${date},${csvName(name)},${usd.toFixed(4)},${Math.round(rec.peak)}`)
      rows++
    }
    const rest = rec.usd - named
    if (entries.length === 0 || rest > 0.00005) {
      lines.push(`${date},-,${Math.max(0, rest).toFixed(4)},${Math.round(rec.peak)}`)
      rows++
    }
  }

  return { text: lines.join('\n') + '\n', rows }
}
