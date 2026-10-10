import { expect, test } from 'claude-code/testing'

import { ciState, duration, items, maskAccount, splitHint } from './format'

test('formats durations', async () => {
  expect(duration(30_000)).toBe('<1m')
  expect(duration(42 * 60_000)).toBe('42m')
  expect(duration(83 * 60_000)).toBe('1h23m')
})

test('masks the account to two letters each side', async () => {
  expect(maskAccount('alice@example.com')).toBe('al**@ex**')
  expect(maskAccount('api key')).toBe('api key')
})

test('reads CI state from the PR and its check rollup', async () => {
  expect(ciState('OPEN', [])).toBeUndefined()
  expect(ciState('MERGED', [{ conclusion: 'FAILURE' }])).toBe('merged')
  expect(ciState('OPEN', [{ conclusion: 'SUCCESS' }, { conclusion: 'SKIPPED' }])).toBe('pass')
  expect(ciState('OPEN', [{ conclusion: '', status: 'IN_PROGRESS' }])).toBe('pending')
  expect(ciState('OPEN', [{ conclusion: 'FAILURE' }, { status: 'QUEUED' }])).toBe('fail')
})

const FULL = {
  ctxPercent: 16.2, ratePercent: 42, rateResetsInMs: 80 * 60_000, cacheLeftMs: 58 * 60_000,
  account: 'alice@example.com', repo: 'my-repo', branch: 'fix/otp', pr: 1389,
}

test('lists every part in order', async () => {
  expect(items(FULL)).toEqual([
    'ctx 16%', 'rlh 42%, 1h20m', '⏳58m', 'al**@ex**', 'my-repo', 'fix/otp',
  ])
  expect(items({ ctxPercent: 3, cacheLeftMs: -1 })).toEqual(['ctx 3%', '⏳cold'])
})

test('compacts the prompt hint', async () => {
  expect(splitHint('-- INSERT -- (shift+tab to cycle) · ← 1 agent')).toEqual({ vim: 'IN', rest: '← 1 agent' })
  expect(splitHint('-- INSERT -- (shift+tab to cycle)')).toEqual({ vim: 'IN', rest: undefined })
  expect(splitHint('esc to interrupt')).toEqual({ vim: undefined, rest: 'esc to interrupt' })
})
