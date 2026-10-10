import type { Ci, Hint, Snapshot } from '../types'

export const duration = (ms: number): string => {
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h${mins % 60}m`
}

// "alice@example.com" -> "al**@ex**"
export const maskAccount = (email: string): string => {
  if (!email.includes('@')) return email
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 2)}**@${domain.slice(0, 2)}**`
}

type Check = { conclusion?: string; state?: string; status?: string }

const FAILED = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'])
const PASSED = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])

export const ciState = (prState: string, checks: readonly Check[]): Ci | undefined => {
  if (prState === 'MERGED') return 'merged'
  if (checks.length === 0) return undefined
  const results = checks.map(c => c.conclusion || c.state || c.status || '')
  if (results.some(r => FAILED.has(r))) return 'fail'
  if (results.every(r => PASSED.has(r))) return 'pass'
  return 'pending'
}

// "claude-opus-5-5[1m]" or "Opus 5.5 (1M context)" -> "Opus 5.5"
export const shortModel = (model: string): string => {
  const id = model.match(/^claude-([a-z]+)-(\d+)-(\d+)/i)
  if (!id) return model.replace(/\s*\(\w+ context\)/i, '')
  const [, family = '', major, minor] = id
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}.${minor}`
}

const EFFORT: Record<string, string> = { low: 'lo', medium: 'med', high: 'hi', xhigh: 'xhi', max: 'max' }

export const shortEffort = (effort: string | number): string =>
  typeof effort === 'number' ? String(effort) : (EFFORT[effort] ?? effort)

// Display order; the line wraps only between items.
export const items = (s: Snapshot): string[] => {
  const out: string[] = []
  if (s.model) out.push([shortModel(s.model), s.effort].filter(Boolean).join(' '))
  if (s.ctxPercent !== undefined) out.push(`ctx ${Math.round(s.ctxPercent)}%`)
  if (s.ratePercent !== undefined) {
    const reset = s.rateResetsInMs && s.rateResetsInMs > 0 ? `, ${duration(s.rateResetsInMs)}` : ''
    out.push(`rlh ${Math.round(s.ratePercent)}%${reset}`)
  }
  if (s.cacheLeftMs !== undefined) out.push(s.cacheLeftMs > 0 ? `⏳${duration(s.cacheLeftMs)}` : '⏳cold')
  if (s.account) out.push(maskAccount(s.account))
  if (s.repo) out.push(s.repo)
  if (s.branch) out.push(s.branch)
  return out
}

// The engine draws the permission-mode pill itself, before this line.
// "-- INSERT -- (shift+tab to cycle) · ← 1 agent" -> { vim: "IN", rest: "← 1 agent" }
export const splitHint = (hint: string): Hint => {
  let vim: string | undefined
  const rest = hint
    .replace(/\s*\(shift\+tab to cycle\)/i, '')
    .replace(/^\s*-- (\w+) --/, (_, name: string) => {
      vim = name.slice(0, 2)
      return ''
    })
    .replace(/^[\s·]+|[\s·]+$/g, '')
  return { vim, rest: rest || undefined }
}
