import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot } from '../types'
import { ciState, items, splitHint } from './format'

const snapshot = atom({ plugin: 'statusbar', key: 'snapshot' } as const, {})
// No API reports the TTL except model-switch hooks; until one fires, assume the
// subscription default (1h). API-key sessions default to 5m.
const cache = atom({ plugin: 'statusbar', key: 'cache' } as const, { ttlMs: 60 * 60_000 })
const CI_COLOR = { pass: 'success', pending: 'warning', fail: 'error', merged: 'merged' } as const

async function run($: EngineInterface, argv: string[]) {
  const out = await $.process.run(argv, { timeoutMs: 5000 })
  return out.exitCode === 0 ? out.stdout.trim() || undefined : undefined
}

async function patch($: EngineInterface, fields: Partial<Snapshot>) {
  await update($, snapshot, s => ({ ...s, ...fields }))
}

async function refreshSession($: EngineInterface) {
  const now = await $.clock.now()
  const [usage, git, clock] = await Promise.all([
    $.session.usage(),
    run($, ['git', 'rev-parse', '--show-toplevel', '--abbrev-ref', 'HEAD']),
    read($, cache),
  ])
  const fiveHour = usage.rateLimits.find(r => r.kind === 'five_hour')
  const [top, branch] = git?.split('\n') ?? []
  await patch($, {
    ctxPercent: usage.context.percent,
    ratePercent: fiveHour?.percentUsed,
    rateResetsInMs: fiveHour?.resetsAt ? Date.parse(fiveHour.resetsAt) - now : undefined,
    cacheLeftMs: clock.lastAt === undefined ? undefined : clock.lastAt + clock.ttlMs - now,
    repo: top?.split('/').pop(),
    branch,
  })
}

// Asks the CLI, which runs with this session's env, so an API-key or
// CLAUDE_CONFIG_DIR login reports itself rather than ~/.claude.json's.
async function refreshAccount($: EngineInterface) {
  const json = await run($, ['claude', 'auth', 'status'])
  const auth = json ? (JSON.parse(json) as { email?: string | null; authMethod?: string }) : undefined
  await patch($, { account: auth?.email ?? auth?.authMethod?.replace('_', ' ') })
}

async function refreshPr($: EngineInterface) {
  const json = await run($, ['gh', 'pr', 'view', '--json', 'number,state,statusCheckRollup'])
  const pr = json ? (JSON.parse(json) as { number: number; state: string; statusCheckRollup: [] }) : undefined
  await patch($, { pr: pr?.number, ci: pr ? ciState(pr.state, pr.statusCheckRollup) : undefined })
}

function safely(work: Promise<unknown>) {
  return work.catch(() => undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.ui.status(undefined)
    $.clock.every(15_000, () => void safely(refreshSession($)))
    $.clock.every(60_000, () => void safely(refreshPr($)))
    void safely(refreshSession($))
    void safely(refreshPr($))
    void safely(refreshAccount($))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    const touchedCache = usage !== null && usage.cache_read_input_tokens + usage.cache_creation_input_tokens > 0
    if (e.agentId === undefined && touchedCache) {
      const lastAt = await $.clock.now()
      await update($, cache, c => ({ ...c, lastAt }))
      void safely(refreshSession($))
    }
    return result
  })

  on('classic.PostModelSwitch', async ($, e, next) => {
    await update($, cache, () => ({ ttlMs: e.cache_ttl === '5m' ? 5 * 60_000 : 60 * 60_000 }))
    void safely(refreshSession($))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    void safely(refreshSession($))
    void safely(refreshPr($))
    // A /login mid-session shows up after the next turn.
    void safely(refreshAccount($))
    return result
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, snapshot)
    const hint = splitHint(e.props.hint)
    const parts = [hint.vim, hint.rest, ...items(s)].filter((p): p is string => Boolean(p))
    const hasPr = s.pr !== undefined
    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {parts.map((part, i) => {
          const isLast = i === parts.length - 1
          const isHead = i === 0 && hint.vim !== undefined
          return (
            <Text key={String(i)} dimColor>
              {isLast || isHead ? part : `${part} |`}
            </Text>
          )
        })}
        {hasPr ? <Text color={s.ci ? CI_COLOR[s.ci] : undefined}>#{s.pr}</Text> : null}
      </Box>
    )
  })
}
