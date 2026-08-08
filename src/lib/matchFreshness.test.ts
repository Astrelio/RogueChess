import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPhaseTransition,
  isStaleBoardPulse,
  isStaleMatchState,
  matchProgress,
} from './matchFreshness'
import type { MatchState } from '@/types/match'

function fakeMatch(partial: Partial<MatchState['match']>): MatchState {
  return {
    match: {
      id: 'm1',
      status: 'active',
      phase: 'action',
      cycle_index: 0,
      moves_in_phase: 0,
      fen: 'x',
      turn_color: 'white',
      white_time_ms: 1000,
      black_time_ms: 1000,
      clock_running_for: 'white',
      current_dimension: 'primo',
      ...partial,
    },
    players: [],
    you: null,
    shop: [],
    inventory: [],
    flags: [],
  } as MatchState
}

test('matchProgress finished beats everything', () => {
  assert.ok(
    matchProgress({ cycle_index: 0, moves_in_phase: 0, status: 'finished' }) >
      matchProgress({ cycle_index: 9, moves_in_phase: 9, status: 'active' }),
  )
})

test('action → shop is NOT stale', () => {
  const current = fakeMatch({ status: 'active', phase: 'action', moves_in_phase: 4, cycle_index: 0 })
  const shop = fakeMatch({ status: 'shop', phase: 'shop', moves_in_phase: 0, cycle_index: 0 })
  assert.equal(isStaleMatchState(shop, current), false)
  assert.ok(matchProgress(shop.match) > matchProgress(current.match))
})

test('shop → active next cycle is NOT stale', () => {
  const shop = fakeMatch({ status: 'shop', phase: 'shop', moves_in_phase: 0, cycle_index: 0 })
  const active = fakeMatch({ status: 'active', phase: 'grieta', moves_in_phase: 0, cycle_index: 1 })
  assert.equal(isStaleMatchState(active, shop), false)
  assert.ok(matchProgress(active.match) > matchProgress(shop.match))
})

test('isStaleMatchState rejects older moves in same phase', () => {
  const current = fakeMatch({ moves_in_phase: 3 })
  assert.equal(isStaleMatchState(fakeMatch({ moves_in_phase: 1 }), current), true)
  assert.equal(isStaleMatchState(fakeMatch({ moves_in_phase: 4 }), current), false)
})

test('board pulse opening shop is accepted', () => {
  const current = fakeMatch({ status: 'active', phase: 'action', moves_in_phase: 4, cycle_index: 0 })
  assert.equal(
    isStaleBoardPulse(
      {
        matchId: 'm1',
        fen: 'shopfen',
        white_time_ms: 1,
        black_time_ms: 1,
        turn_color: 'white',
        clock_running_for: null,
        status: 'shop',
        phase: 'shop',
        cycle_index: 0,
        moves_in_phase: 0,
        at: 200,
      },
      current,
      100,
    ),
    false,
  )
})

test('isPhaseTransition detects shop open', () => {
  assert.equal(
    isPhaseTransition(
      { status: 'active', phase: 'action', cycle_index: 0 },
      { status: 'shop', phase: 'shop', cycle_index: 0 },
    ),
    true,
  )
})
