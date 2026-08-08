import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStaleBoardPulse, isStaleMatchState, matchProgress } from './matchFreshness'
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

test('matchProgress finished beats active', () => {
  assert.ok(
    matchProgress({ cycle_index: 0, moves_in_phase: 0, status: 'finished' }) >
      matchProgress({ cycle_index: 9, moves_in_phase: 9, status: 'active' }),
  )
})

test('isStaleMatchState rejects older moves', () => {
  const current = fakeMatch({ moves_in_phase: 3 })
  const older = fakeMatch({ moves_in_phase: 1 })
  assert.equal(isStaleMatchState(older, current), true)
  assert.equal(isStaleMatchState(fakeMatch({ moves_in_phase: 4 }), current), false)
})

test('isStaleBoardPulse rejects old at and old preview', () => {
  const current = fakeMatch({ moves_in_phase: 2, cycle_index: 1 })
  assert.equal(
    isStaleBoardPulse(
      {
        matchId: 'm1',
        fen: 'old',
        white_time_ms: 1,
        black_time_ms: 1,
        turn_color: 'white',
        clock_running_for: null,
        status: 'active',
        phase: 'action',
        cycle_index: 1,
        moves_in_phase: 1,
        at: 50,
        preview: true,
      },
      current,
      100,
    ),
    true,
  )
  assert.equal(
    isStaleBoardPulse(
      {
        matchId: 'm1',
        fen: 'new',
        white_time_ms: 1,
        black_time_ms: 1,
        turn_color: 'black',
        clock_running_for: 'black',
        status: 'active',
        phase: 'action',
        cycle_index: 1,
        moves_in_phase: 3,
        at: 200,
      },
      current,
      100,
    ),
    false,
  )
})
