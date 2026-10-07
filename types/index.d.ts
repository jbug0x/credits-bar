export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Category = { name: string; tokens: number }
export type Snapshot = {
  limits: Limit[]
  usd: number | null
  contextPercent: number | null
  categories: Category[]
}
export type TokenTotals = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type DayRecord = { usd: number; peak: number }
export type History = Record<string, DayRecord>

declare module 'claude-code' {
  interface PluginState {
    'credits-bar': {
      snapshot: Snapshot | null
      isHidden: boolean
      turns: number[]
      tokens: TokenTotals
      history: History
      tick: number
    }
  }
}
