import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluatePosition, pickBotMove } from './bot.js'
import type { EngineContext } from './types.js'

function baseCtx(over: Partial<EngineContext> = {}): EngineContext {
  return {
    matchId: '00000000-0000-0000-0000-000000000001',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    dimension: 'primo',
    turnColor: 'white',
    ply: 0,
    cycleIndex: 0,
    cells: [],
    effects: [],
    flags: [],
    moverColor: 'white',
    moverPlayerId: 'bot',
    opponentPlayerId: 'human',
    giratiempoActive: false,
    giratiempoMovesLeft: 0,
    giratiempoCaptures: 0,
    expectoPatronumActive: false,
    ...over,
  }
}

test('pickBotMove: captura dama colgante', () => {
  // Torre blanca puede comer dama en a5
  const fen = '4k3/8/8/q7/8/8/8/R3K3 w - - 0 1'
  const move = pickBotMove(baseCtx({ fen, turnColor: 'white', moverColor: 'white' }), {
    depth: 2,
    timeMs: 400,
  })
  assert.ok(move)
  assert.equal(move.from, 'a1')
  assert.equal(move.to, 'a5')
})

test('evaluatePosition: material favorece al que tiene más', () => {
  const even = evaluatePosition(baseCtx(), 'white')
  const upQueen = evaluatePosition(
    baseCtx({ fen: '4k3/8/8/8/8/8/4P3/4K2Q w - - 0 1' }),
    'white',
  )
  assert.ok(upQueen > even)
})
