// Pure helpers (no engine calls) so they can be unit-tested.
import type { Limit, Snapshot } from '../types'

export const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * 60 * 60 * 1000,
  seven_day: 7 * 24 * 60 * 60 * 1000
}

export const ALERT_THRESHOLDS = [80, 95]

type RawLimit = { kind: string; percentUsed: number; resetsAt?: string }
type RawUsage = {
  rateLimits: RawLimit[]
  cost?: { usd: number }
  context: { percent?: number }
}

export function toSnapshot(u: RawUsage): Snapshot {
  return {
    limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
    usd: u.cost?.usd ?? null,
    contextPercent: u.context.percent ?? null
  }
}

// "Out in 40m": if the current burn rate holds, when does this window run dry?
// Returns null when there is not enough signal or the window will last until reset.
export function paceNote(limit: Limit, now: number): string | null {
  const windowMs = WINDOW_MS[limit.kind]
  if (!windowMs || !limit.resetsAt || limit.percentUsed < 10) return null

  const remainingMs = Date.parse(limit.resetsAt) - now
  const elapsedMs = windowMs - remainingMs
  if (!(remainingMs > 0) || elapsedMs < windowMs * 0.05) return null

  const msToEmpty = (elapsedMs * (100 - limit.percentUsed)) / limit.percentUsed
  if (msToEmpty >= remainingMs) return null

  return `out in ${formatDuration(msToEmpty)}`
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`

  return `${Math.round(minutes / (24 * 60))}d`
}

// Thresholds newly crossed since `seen` (keys already alerted), plus the updated set.
// A key includes the reset time, so each new window can alert again.
export function newAlerts(limits: Limit[], seen: ReadonlySet<string>): { messages: string[]; seen: Set<string> } {
  const next = new Set(seen)
  const messages: string[] = []

  for (const l of limits) {
    for (const t of ALERT_THRESHOLDS) {
      const key = `${l.kind}:${l.resetsAt ?? ''}:${t}`
      if (l.percentUsed >= t && !next.has(key)) {
        next.add(key)
        messages.push(`${l.kind === 'five_hour' ? '5h' : l.kind === 'seven_day' ? '7d' : l.kind} limit ${Math.floor(l.percentUsed)}% used`)
      }
    }
  }

  // Crossing 80 and 95 in one jump yields the same text twice; show it once.
  return { messages: [...new Set(messages)], seen: next }
}
