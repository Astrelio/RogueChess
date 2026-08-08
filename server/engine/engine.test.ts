import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { applyPlayerMove } from './moves.js'
import { applyJoker } from './jokers.js'
import { mirrorTarget } from './dimensions.js'
import type { BoardCell, EngineContext, PieceFlag } from './types.js'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function makeCtx(overrides: Partial<EngineContext> & { fen: string }): EngineContext {
  return {
    matchId: 'm-test',
    dimension: 'primo',
    turnColor: 'white',
    ply: 10,
    cycleIndex: 1,
    cells: [],
    effects: [],
    flags: [],
    moverColor: 'white',
    moverPlayerId: 'p-me',
    opponentPlayerId: 'p-op',
    giratiempoActive: false,
    giratiempoMovesLeft: 0,
    giratiempoCaptures: 0,
    expectoPatronumActive: false,
    ...overrides,
  }
}

function cell(partial: Partial<BoardCell> & { square: string; effect: BoardCell['effect'] }): BoardCell {
  return {
    id: `cell-${partial.square}`,
    owner_player_id: null,
    time_bonus_min_s: null,
    time_bonus_max_s: null,
    payload: {},
    is_active: true,
    ...partial,
  }
}

function flag(partial: Partial<PieceFlag> & { piece_uid: string; square: string }): PieceFlag {
  return {
    color: 'white',
    kind: 'p',
    was_pawn: false,
    is_invisible: false,
    multijugos_queen: false,
    multijugos_dies_ply: null,
    payload: {},
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// Dimensiones
// ---------------------------------------------------------------------------

test('gravitacional: dama limitada a 3 casillas', () => {
  const fen = '8/7k/8/8/8/8/8/QK6 w - - 0 1'
  const far = applyPlayerMove(makeCtx({ fen, dimension: 'gravitacional' }), {
    from: 'a1',
    to: 'a8',
  })
  assert.equal(far.ok, false)
  assert.match((far as { error: string }).error, /gravitacional/i)

  const near = applyPlayerMove(makeCtx({ fen, dimension: 'gravitacional' }), {
    from: 'a1',
    to: 'a4',
  })
  assert.equal(near.ok, true)

  const vanilla = applyPlayerMove(makeCtx({ fen, dimension: 'primo' }), {
    from: 'a1',
    to: 'a8',
  })
  assert.equal(vanilla.ok, true)
})

test('cadena_sangre: captura disponible es obligatoria', () => {
  const fen = '8/8/8/3p4/4P3/8/8/K6k w - - 0 1'
  const quiet = applyPlayerMove(makeCtx({ fen, dimension: 'cadena_sangre' }), {
    from: 'e4',
    to: 'e5',
  })
  assert.equal(quiet.ok, false)
  assert.match((quiet as { error: string }).error, /obligatoria/i)

  const capture = applyPlayerMove(makeCtx({ fen, dimension: 'cadena_sangre' }), {
    from: 'e4',
    to: 'd5',
  })
  assert.equal(capture.ok, true)
  assert.equal(capture.ok && capture.isCapture, true)
})

test('ruina: no aterrizar ni atravesar zonas muertas', () => {
  const fen = '8/7k/8/8/8/8/8/RK6 w - - 0 1'
  const ruined = [cell({ square: 'a4', effect: 'ruined' })]

  const landing = applyPlayerMove(makeCtx({ fen, dimension: 'ruina', cells: ruined }), {
    from: 'a1',
    to: 'a4',
  })
  assert.equal(landing.ok, false)

  const crossing = applyPlayerMove(makeCtx({ fen, dimension: 'ruina', cells: ruined }), {
    from: 'a1',
    to: 'a8',
  })
  assert.equal(crossing.ok, false)
  assert.match((crossing as { error: string }).error, /zona quemada|ruina|muerta/i)
})

test('mercado_negro: monolito absorbido al atravesarlo suma tiempo', () => {
  const fen = '8/7k/8/8/8/8/P7/K7 w - - 0 1'
  const ctx = makeCtx({
    fen,
    dimension: 'mercado_negro',
    cells: [cell({ square: 'a3', effect: 'monolith', time_bonus_min_s: 40, time_bonus_max_s: 60 })],
  })
  const res = applyPlayerMove(ctx, { from: 'a2', to: 'a4' })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.clockOps.length, 1)
    assert.ok(res.clockOps[0].deltaMs >= 40000 && res.clockOps[0].deltaMs <= 60000)
    assert.equal(res.cellOps[0].op, 'deactivate')
  }
})

test('espejo: el comando se invierte (caballo)', () => {
  assert.equal(mirrorTarget('d4', 'e6'), 'c2')
  const fen = '7k/8/8/8/3N4/8/8/K7 w - - 0 1'
  const res = applyPlayerMove(makeCtx({ fen, dimension: 'espejo' }), { from: 'd4', to: 'e6' })
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.uci, 'd4c2')
})

test('espejo: enroque corto se invierte a enroque largo', () => {
  const fen = '7k/8/8/8/8/8/8/R3K2R w KQ - 0 1'
  const res = applyPlayerMove(makeCtx({ fen, dimension: 'espejo' }), { from: 'e1', to: 'g1' })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.uci, 'e1c1')
    assert.match(res.fenAfter, /2KR|K1R|2K1R|K2R/) // rey en flanco de dama
  }
})

test('espejo: peón hacia el propio bando (comando adelante → va atrás)', () => {
  // e2→e3 (comando "adelante") se invierte a e1 → corona
  const fen = '7k/8/8/8/8/8/4P3/K7 w - - 0 1'
  const res = applyPlayerMove(makeCtx({ fen, dimension: 'espejo' }), { from: 'e2', to: 'e3' })
  assert.equal(res.ok, true, res.ok ? '' : res.error)
  if (res.ok) {
    assert.ok(res.uci.startsWith('e2e1'))
    assert.ok(
      res.fenAfter.includes('Q') || res.events.some((e) => e.includes('corona')),
      'debe coronar en e1',
    )
  }
})

test('espejo: peón comando atrás → avanza normal', () => {
  // e2→e1 (comando "atrás") se invierte a e3
  const fen = '7k/8/8/8/8/8/4P3/K7 w - - 0 1'
  const res = applyPlayerMove(makeCtx({ fen, dimension: 'espejo' }), { from: 'e2', to: 'e1' })
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.uci, 'e2e3')
})

test('fragilidad: pieza amenazada por dos enemigos estalla al final del turno', () => {
  // Peón negro d5 quedará atacado por caballo b4 + alfil g2 tras Bg2
  const fen = '7k/8/8/3p4/1N6/8/6B1/K7 w - - 0 1'
  // Movemos el alfil g2-f3? ya ataca d5 desde g2... mejor: alfil en h1 y jugamos Bg2
  const fen2 = '7k/8/8/3p4/1N6/8/8/K6B w - - 0 1'
  const res = applyPlayerMove(makeCtx({ fen: fen2, dimension: 'fragilidad' }), {
    from: 'h1',
    to: 'g2',
  })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.ok(!res.fenAfter.split(' ')[0].includes('p'), 'el peón d5 debe cristalizar')
    assert.ok(res.events.some((e) => e.includes('Fragilidad')))
  }
  void fen
})

// ---------------------------------------------------------------------------
// Comodines
// ---------------------------------------------------------------------------

test('aparicion: intercambia dos piezas propias', () => {
  const res = applyJoker(makeCtx({ fen: START_FEN }), 'aparicion', { a: 'a1', b: 'b1' })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.ok(res.newFen)
    assert.ok(res.newFen!.split(' ')[0].endsWith('NRBQKBNR'))
  }
})

test('aparicion: rechaza piezas que no son tuyas', () => {
  const res = applyJoker(makeCtx({ fen: START_FEN }), 'aparicion', { a: 'a1', b: 'a8' })
  assert.equal(res.ok, false)
})

test('axio_tempus: pasivo del motor (el reloj lo aplica SQL)', () => {
  const res = applyJoker(makeCtx({ fen: START_FEN }), 'axio_tempus', {})
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.newFen, undefined)
    assert.equal(res.cellOps.length, 0)
    assert.equal(res.clockOps.length, 0)
  }
})

test('avada_kedavra: mata peón enemigo, rechaza pieza mayor sin marca', () => {
  const pawnFen = '7k/8/8/3p4/8/8/8/K7 w - - 0 1'
  const killed = applyJoker(makeCtx({ fen: pawnFen }), 'avada_kedavra', { square: 'd5' })
  assert.equal(killed.ok, true)
  if (killed.ok) assert.ok(!killed.newFen!.split(' ')[0].includes('p'))

  const rookFen = '7k/8/8/3r4/8/8/8/K7 w - - 0 1'
  const rook = applyJoker(makeCtx({ fen: rookFen }), 'avada_kedavra', { square: 'd5' })
  assert.equal(rook.ok, false)

  // Con marca was_pawn (coronada) sí muere
  const marked = applyJoker(
    makeCtx({
      fen: rookFen,
      flags: [flag({ piece_uid: 'wp:d5:1', square: 'd5', color: 'black', kind: 'r', was_pawn: true })],
    }),
    'avada_kedavra',
    { square: 'd5' },
  )
  assert.equal(marked.ok, true)
})

test('avada_kedavra: el rey es inmune', () => {
  const res = applyJoker(makeCtx({ fen: '7k/8/8/8/8/8/8/K7 w - - 0 1' }), 'avada_kedavra', {
    square: 'h8',
  })
  assert.equal(res.ok, false)
  assert.match((res as { error: string }).error, /rey/i)
})

test('morsmordre: empuja hacia atrás; aplasta pieza propia; falla en el borde', () => {
  // Empuje simple: peón negro d5 retrocede a d6
  const push = applyJoker(
    makeCtx({ fen: '7k/8/8/3p4/3P4/8/8/K7 w - - 0 1' }),
    'morsmordre',
    { square: 'd5' },
  )
  assert.equal(push.ok, true)
  if (push.ok) {
    assert.ok(!push.fizzled)
    assert.match(push.newFen!.split(' ')[0], /3p4.*8.*3P4/s)
  }

  // Aplasta: caballo blanco en d6 muere y el peón ocupa d6
  const crush = applyJoker(
    makeCtx({ fen: '7k/8/3N4/3p4/3P4/8/8/K7 w - - 0 1' }),
    'morsmordre',
    { square: 'd5' },
  )
  assert.equal(crush.ok, true)
  if (crush.ok) {
    assert.ok(!crush.newFen!.split(' ')[0].includes('N'))
    assert.ok(crush.events.some((e) => e.includes('aplastada')))
  }

  // Borde: caballo negro en d8 no puede retroceder → fizzle
  const border = applyJoker(
    makeCtx({ fen: '3n3k/4Q3/8/8/8/8/8/K7 w - - 0 1' }),
    'morsmordre',
    { square: 'd8' },
  )
  assert.equal(border.ok, true)
  if (border.ok) assert.equal(border.fizzled, true)
})

test('morsmordre: Expecto Patronum del rival lo anula', () => {
  const res = applyJoker(
    makeCtx({
      fen: '7k/8/8/3p4/3P4/8/8/K7 w - - 0 1',
      effects: [
        {
          id: 'ef-1',
          kind: 'expecto_patronum',
          applied_by: 'p-op',
          payload: {},
          is_active: true,
        },
      ],
    }),
    'morsmordre',
    { square: 'd5' },
  )
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.fizzled, true)
})

test('morsmordre: Expecto propio (global) también anula Morsmordre', () => {
  const byFlag = applyJoker(
    makeCtx({
      fen: '7k/8/8/3p4/3P4/8/8/K7 w - - 0 1',
      expectoPatronumActive: true,
    }),
    'morsmordre',
    { square: 'd5' },
  )
  assert.equal(byFlag.ok, true)
  if (byFlag.ok) assert.equal(byFlag.fizzled, true)

  const byOwnEffect = applyJoker(
    makeCtx({
      fen: '7k/8/8/3p4/3P4/8/8/K7 w - - 0 1',
      effects: [
        {
          id: 'ef-me',
          kind: 'expecto_patronum',
          applied_by: 'p-me',
          payload: {},
          is_active: true,
        },
      ],
    }),
    'morsmordre',
    { square: 'd5' },
  )
  assert.equal(byOwnEffect.ok, true)
  if (byOwnEffect.ok) assert.equal(byOwnEffect.fizzled, true)
})

test('bombarda: sacrifica peón, quema 3x3 vacías, empuja reyes primero', () => {
  const fen = '7k/8/8/3n4/3P4/8/8/K7 w - - 0 1'
  const res = applyJoker(makeCtx({ fen }), 'bombarda', { square: 'd4' })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.ok(!res.newFen!.split(' ')[0].includes('P'), 'el peón se sacrifica')
    assert.ok(res.newFen!.split(' ')[0].includes('n'), 'el caballo empujado sobrevive')
    const burns = res.cellOps.filter((c) => c.op === 'insert')
    assert.ok(burns.length >= 1 && burns.length <= 9)
    // Ninguna casilla quemada debe seguir ocupada en el FEN final
    const chess = new Chess(res.newFen)
    for (const c of burns) {
      if (c.op === 'insert') {
        assert.equal(chess.get(c.square as 'a1'), undefined, `quemada ${c.square} debe estar vacía`)
      }
    }
  }
})

test('bombarda e2: deja jugadas seguras en el flanco', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const bomb = applyJoker(makeCtx({ fen: start }), 'bombarda', { square: 'e2' })
  assert.equal(bomb.ok, true)
  if (!bomb.ok) return
  const cells = bomb.cellOps
    .filter((c): c is Extract<typeof c, { op: 'insert' }> => c.op === 'insert')
    .map((c, i) =>
      cell({ id: `b${i}`, square: c.square, effect: 'burned' }),
    )
  const ctx = makeCtx({ fen: bomb.newFen!, cells })
  const a3 = applyPlayerMove(ctx, { from: 'a2', to: 'a3' })
  assert.equal(a3.ok, true, a3.ok ? '' : a3.error)
  const intoBurn = applyPlayerMove(ctx, { from: 'a2', to: 'e3' })
  // e3 quemada o ilegal por otras razones
  if (cells.some((c) => c.square === 'e3')) {
    assert.equal(intoBurn.ok, false)
  }
})

test('defodio: trampa en casilla vacía; la pieza que la pisa muere', () => {
  const trapRes = applyJoker(makeCtx({ fen: START_FEN }), 'defodio', { square: 'e4' })
  assert.equal(trapRes.ok, true)
  if (trapRes.ok) {
    assert.equal(trapRes.cellOps[0].op, 'insert')
  }

  // El rival pisa la trampa
  const ctx = makeCtx({
    fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1',
    ply: 10,
    cells: [
      cell({
        square: 'e4',
        effect: 'trap_defodio',
        owner_player_id: 'p-op',
        payload: { created_ply: 9 },
      }),
    ],
  })
  const step = applyPlayerMove(ctx, { from: 'e2', to: 'e4' })
  assert.equal(step.ok, true)
  if (step.ok) {
    assert.ok(!step.fenAfter.split(' ')[0].includes('P'), 'el peón muere en la trampa')
    assert.ok(step.events.some((e) => e.includes('Defodio')))
  }
})

test('defodio: trampa caducada no mata', () => {
  const ctx = makeCtx({
    fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1',
    ply: 10,
    cells: [
      cell({
        square: 'e4',
        effect: 'trap_defodio',
        owner_player_id: 'p-op',
        payload: { created_ply: 5 },
      }),
    ],
  })
  const step = applyPlayerMove(ctx, { from: 'e2', to: 'e4' })
  assert.equal(step.ok, true)
  if (step.ok) {
    assert.ok(step.fenAfter.split(' ')[0].includes('P'), 'el peón sobrevive')
    assert.equal(step.cellOps[0].op, 'deactivate')
  }
})

test('paso_fantasma: la torre atraviesa una pieza propia', () => {
  const fen = '7k/8/8/8/8/8/P7/R6K w - - 0 1'
  const blockedCtx = makeCtx({ fen })
  const blocked = applyPlayerMove(blockedCtx, { from: 'a1', to: 'a4' })
  assert.equal(blocked.ok, false)

  const ghostCtx = makeCtx({
    fen,
    effects: [
      { id: 'ef-ghost', kind: 'ghost_step', applied_by: 'p-me', payload: {}, is_active: true },
    ],
  })
  const ghost = applyPlayerMove(ghostCtx, { from: 'a1', to: 'a4' })
  assert.equal(ghost.ok, true)
  if (ghost.ok) {
    assert.equal(ghost.ghostUsed, true)
    assert.equal(ghost.effectOps[0].op, 'deactivate')
  }
})

test('imperius: mueve pieza enemiga con fuego amigo, rey inmune', () => {
  // Torre negra a8 captura al caballo negro c8 (fuego amigo)
  const fen = 'r1n4k/8/8/8/8/8/8/K7 w - - 0 1'
  const res = applyJoker(makeCtx({ fen }), 'imperius', { from: 'a8', to: 'c8' })
  assert.equal(res.ok, true)
  if (res.ok) assert.ok(!res.newFen!.split(' ')[0].includes('n'))

  const king = applyJoker(makeCtx({ fen }), 'imperius', { from: 'h8', to: 'h7' })
  assert.equal(king.ok, false)
  assert.match((king as { error: string }).error, /inmune/i)
})

test('espejo + skipMirror: el bot aplica destino legal sin re-invertir', () => {
  // Caballo en b1 → c3 es legal; si se re-invertiera el comando saldría del tablero
  const fen = '7k/8/8/8/8/8/8/1N2K3 w - - 0 1'
  const ctx = makeCtx({ fen, dimension: 'espejo' })
  const bad = applyPlayerMove(ctx, { from: 'b1', to: 'c3' }) // humano: se invierte
  assert.equal(bad.ok, false)

  const bot = applyPlayerMove(ctx, { from: 'b1', to: 'c3', skipMirror: true })
  assert.equal(bot.ok, true)
  if (bot.ok) assert.equal(bot.uci, 'b1c3')
})

test('giratiempo: tras la 1ª jugada el FEN sigue en tu turno', () => {
  const fen = '7k/8/8/8/8/8/4P3/4K3 w - - 0 1'
  const ctx = makeCtx({
    fen,
    giratiempoActive: true,
    giratiempoMovesLeft: 2,
    giratiempoCaptures: 0,
  })
  const res = applyPlayerMove(ctx, { from: 'e2', to: 'e4' })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.fenAfter.split(' ')[1], 'w', 'debe seguir turno blancas')
    assert.ok(res.events.some((e) => e.includes('Giratiempo')))
  }
})

test('giratiempo: 2ª jugada ya pasa el turno', () => {
  const fen = '7k/8/8/8/4P3/8/8/4K3 w - - 0 1'
  const ctx = makeCtx({
    fen,
    giratiempoActive: true,
    giratiempoMovesLeft: 1,
    giratiempoCaptures: 0,
  })
  const res = applyPlayerMove(ctx, { from: 'e4', to: 'e5' })
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.fenAfter.split(' ')[1], 'b')
  }
})

test('pocion_multijugos: peón a reina y colapso al siguiente turno', () => {
  const cast = applyJoker(makeCtx({ fen: START_FEN }), 'pocion_multijugos', { square: 'e2' })
  assert.equal(cast.ok, true)
  if (cast.ok) {
    assert.ok(cast.newFen!.split(' ')[0].includes('PPPPQPPP'))
    const up = cast.flagOps.find((f) => f.op === 'upsert')
    assert.ok(up && up.op === 'upsert' && up.multijugosQueen)
  }

  // Al llegar el turno del dueño con fullmove posterior, la reina muere
  const ctx = makeCtx({
    fen: '7k/8/8/8/8/8/4Q3/K7 w - - 0 5',
    flags: [
      flag({
        piece_uid: 'mj:e2:1',
        square: 'e2',
        color: 'white',
        kind: 'q',
        multijugos_queen: true,
        payload: { created_fullmove: 3 },
      }),
    ],
  })
  const move = applyPlayerMove(ctx, { from: 'a1', to: 'a2' })
  assert.equal(move.ok, true)
  if (move.ok) {
    assert.ok(!move.fenAfter.split(' ')[0].includes('Q'), 'la reina multijugos colapsa')
    assert.ok(move.events.some((e) => e.includes('multijugos')))
  }
})

test('gravitacional: jaque lejano no cuenta — se puede mover otra pieza', () => {
  // Dama negra en a8 "jaquea" al rey en a1 a distancia 7; bajo gravedad no es jaque
  const fen = 'q7/8/8/8/8/8/8/K6k w - - 0 1'
  const ctx = makeCtx({ fen, dimension: 'gravitacional' })
  const move = applyPlayerMove(ctx, { from: 'a1', to: 'b1' })
  assert.equal(move.ok, true, 'el rey puede salir aunque chess.js vea jaque falso')
})

test('ruina: rayo de jaque a través de casilla destruida no cuenta', () => {
  // Torre negra a8 → rey a1, pero a4 en ruina corta el rayo
  const fen = 'r7/8/8/8/8/8/8/K6k w - - 0 1'
  const ctx = makeCtx({
    fen,
    dimension: 'ruina',
    cells: [cell({ square: 'a4', effect: 'ruined' })],
  })
  const move = applyPlayerMove(ctx, { from: 'a1', to: 'b2' })
  assert.equal(move.ok, true)
})

test('morsmordre: no puede dejar al rey propio en jaque', () => {
  // Alfil enemigo a5 → rey e1; caballo en c3 tapa la diagonal; peón b2 adyacente.
  // Retroceso c3→c4 abre el jaque descubierto.
  const fen = '7k/8/8/b7/8/2n5/1P6/4K3 w - - 0 1'
  const r = applyJoker(makeCtx({ fen }), 'morsmordre', { square: 'c3' })
  assert.equal(r.ok, false)
  assert.match((r as { error: string }).error, /jaque/i)
})

test('morsmordre: fizzle si retroceso está quemado', () => {
  const fen = '7k/8/8/8/8/4n3/4P3/4K3 w - - 0 1'
  const r = applyJoker(
    makeCtx({
      fen,
      cells: [cell({ square: 'e4', effect: 'burned' })],
    }),
    'morsmordre',
    { square: 'e3' },
  )
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.fizzled, true)
    assert.ok(r.events.some((e) => /quemada|ruina/i.test(e)))
  }
})

test('ghost + cadena_sangre: no permite quieto si hay captura', () => {
  const fen = '8/8/8/3p4/4P3/8/8/K6k w - - 0 1'
  // Torre en a1 no hay — peón e4 puede capturar d5. Ghost en a-file no aplica.
  // Usar torre blanca a4, peón negro a6 en el camino, destino a7 quieto, y captura disponible e4xd5
  const fen2 = '8/8/p7/3p4/R3P3/8/8/K6k w - - 0 1'
  const ctx = makeCtx({
    fen: fen2,
    dimension: 'cadena_sangre',
    effects: [
      {
        id: 'g1',
        kind: 'ghost_step',
        is_active: true,
        applied_by: 'p-me',
        payload: {},
      },
    ],
  })
  const quietGhost = applyPlayerMove(ctx, { from: 'a4', to: 'a7' })
  assert.equal(quietGhost.ok, false)
  assert.match((quietGhost as { error: string }).error, /obligatoria|sangre/i)
})

test('listLegalMoves incluye escapes de jaque falso gravitacional', async () => {
  const { listLegalMoves } = await import('./moves.js')
  const fen = 'q7/8/8/8/8/8/8/K6k w - - 0 1'
  const moves = listLegalMoves(makeCtx({ fen, dimension: 'gravitacional' }))
  assert.ok(moves.length > 0, 'debe haber jugadas legales')
  assert.ok(
    moves.some((m) => m.from === 'a1'),
    'el rey debe poder moverse',
  )
})
