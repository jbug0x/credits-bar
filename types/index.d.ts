export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = { limits: Limit[]; usd: number | null; contextPercent: number | null }

declare module 'claude-code' {
  interface PluginState {
    'credits-bar': { snapshot: Snapshot | null; isHidden: boolean }
  }
}
