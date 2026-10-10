export type Ci = 'pass' | 'pending' | 'fail' | 'merged'

export type Snapshot = {
  ctxPercent?: number
  model?: string
  effort?: string
  ratePercent?: number
  rateResetsInMs?: number
  cacheLeftMs?: number
  account?: string
  repo?: string
  branch?: string
  pr?: number
  ci?: Ci
}

// Kept in state so a mod reload keeps the cache countdown.
export type CacheClock = { lastAt?: number; ttlMs: number }

export type Hint = { vim?: string; rest?: string }

declare module 'claude-code' {
  interface PluginState {
    statusbar: { snapshot: Snapshot; cache: CacheClock }
  }
}
