import { Chess, type Move, type Square } from 'chess.js'
import { applyJoker } from './jokers.js'
import {
  applyPlayerMove,
  botInputFor,
  colorInCheck,
  fenWithSideToMove,
  listLegalMoves,
} from './moves.js'
import type { Color, EngineContext, PieceFlag } from './types.js'

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20_000,
}

/** Prioridad de compra en tienda (mayor = antes). */
export const JOKER_BUY_PRIORITY: Record<string, number> = {
  giratiempo: 100,
  imperius: 96,
  pocion_multijugos: 94,
  avada_kedavra: 92,
  defodio: 88,
  bombarda: 84,
  morsmordre: 80,
  arresto_momentum: 76,
  petrificus_totalus: 72,
  capa_invisibilidad: 68,
  aparicion: 64,
  expecto_patronum: 60,
  paso_fantasma: 55,
  axio_tempus: 50,
}

const CENTER = new Set(['d4', 'e4', 'd5', 'e5', 'c3', 'f3', 'c6', 'f6', 'c4', 'f4', 'c5', 'f5'])

export type BotInvItem = {
  id: string
  code: string
  match_player_id: string
}

export type BotJokerPlan = {
  inventoryId: string
  code: string
  payload: Record<string, unknown>
  score: number
}

function other(c: Color): Color {
  return c === 'white' ? 'black' : 'white'
}

function cjs(c: Color): 'w' | 'b' {
  return c === 'white' ? 'w' : 'b'
}

function withFen(ctx: EngineContext, fen: string, turn: Color, mover: Color): EngineContext {
  return {
    ...ctx,
    fen,
    turnColor: turn,
    moverColor: mover,
    giratiempoActive: mover === ctx.moverColor ? ctx.giratiempoActive : false,
    giratiempoMovesLeft: mover === ctx.moverColor ? ctx.giratiempoMovesLeft : 0,
    giratiempoCaptures: mover === ctx.moverColor ? ctx.giratiempoCaptures : 0,
  }
}

/** Material + movilidad + centro + jaque, desde la perspectiva de `botColor`. */
export function evaluatePosition(ctx: EngineContext, botColor: Color): number {
  let chess: Chess
  try {
    chess = new Chess(fenWithSideToMove(ctx.fen, ctx.turnColor))
  } catch {
    return 0
  }

  let score = 0
  const me = cjs(botColor)
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f]
      if (!p) continue
      const sq = (String.fromCharCode(97 + f) + String(8 - r)) as string
      const v = PIECE_VALUE[p.type] ?? 0
      const sign = p.color === me ? 1 : -1
      score += sign * v
      if (CENTER.has(sq)) score += sign * (p.type === 'p' ? 8 : 12)
      // Peones avanzados
      if (p.type === 'p') {
        const rank = Number(sq[1])
        const adv = p.color === 'w' ? rank - 2 : 7 - rank
        score += sign * adv * 6
      }
    }
  }

  try {
    const myLegal = listLegalMoves({ ...ctx, turnColor: botColor, moverColor: botColor })
    const oppLegal = listLegalMoves({
      ...ctx,
      turnColor: other(botColor),
      moverColor: other(botColor),
    })
    score += (myLegal.length - oppLegal.length) * 4

    if (colorInCheck(ctx.fen, other(botColor), ctx)) score += 45
    if (colorInCheck(ctx.fen, botColor, ctx)) score -= 55

    if (ctx.dimension === 'cadena_sangre') {
      const myCaps = myLegal.filter((m) => m.captured).length
      const oppCaps = oppLegal.filter((m) => m.captured).length
      score += (myCaps - oppCaps) * 35
    }

    if (ctx.dimension === 'gravitacional') {
      score += myLegal.length * 2
    }
  } catch {
    /* FEN raro / EP: no tumbar al bot */
  }

  if (ctx.dimension === 'fragilidad') {
    try {
      score -= hangingDoubleThreats(chess, me) * 80
      score += hangingDoubleThreats(chess, me === 'w' ? 'b' : 'w') * 70
    } catch {
      /* ignore */
    }
  }

  return score
}

function hangingDoubleThreats(chess: Chess, color: 'w' | 'b'): number {
  let n = 0
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f]
      if (!p || p.color !== color || p.type === 'k') continue
      const sq = (String.fromCharCode(97 + f) + String(8 - r)) as Square
      const attackers = chess.attackers(sq, color === 'w' ? 'b' : 'w')
      if (attackers.length >= 2) n++
    }
  }
  return n
}

function moveOrderScore(m: Move): number {
  let s = 0
  if (m.captured) s += 1000 + (PIECE_VALUE[m.captured] ?? 0) - (PIECE_VALUE[m.piece] ?? 0) / 10
  if (m.promotion) s += 800
  if (CENTER.has(m.to)) s += 15
  return s
}

function orderedMoves(ctx: EngineContext): Move[] {
  return [...listLegalMoves(ctx)].sort((a, b) => moveOrderScore(b) - moveOrderScore(a))
}

function alphabeta(
  ctx: EngineContext,
  botColor: Color,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
): number {
  if (Date.now() > deadline) return evaluatePosition(ctx, botColor)

  const maximizing = ctx.moverColor === botColor
  const moves = orderedMoves(ctx)

  if (!moves.length) {
    if (colorInCheck(ctx.fen, ctx.moverColor, ctx)) {
      return maximizing ? -100_000 + (3 - depth) : 100_000 - (3 - depth)
    }
    return 0
  }

  if (depth <= 0) {
    // Quietud ligera: solo capturas 1 ply
    const caps = moves.filter((m) => m.captured).slice(0, 8)
    if (!caps.length) return evaluatePosition(ctx, botColor)
    if (maximizing) {
      let best = evaluatePosition(ctx, botColor)
      for (const m of caps) {
        const r = applyPlayerMove(ctx, botInputFor(ctx, m))
        if (!r.ok) continue
        const nextTurn = r.fenAfter.split(' ')[1] === 'b' ? 'black' : 'white'
        const child = withFen(ctx, r.fenAfter, nextTurn, nextTurn)
        const v = alphabeta(child, botColor, 0, alpha, beta, deadline)
        best = Math.max(best, v)
        alpha = Math.max(alpha, best)
        if (beta <= alpha) break
      }
      return best
    }
    let best = evaluatePosition(ctx, botColor)
    for (const m of caps) {
      const r = applyPlayerMove(ctx, botInputFor(ctx, m))
      if (!r.ok) continue
      const nextTurn = r.fenAfter.split(' ')[1] === 'b' ? 'black' : 'white'
      const child = withFen(ctx, r.fenAfter, nextTurn, nextTurn)
      const v = alphabeta(child, botColor, 0, alpha, beta, deadline)
      best = Math.min(best, v)
      beta = Math.min(beta, best)
      if (beta <= alpha) break
    }
    return best
  }

  const branch = moves.slice(0, depth >= 3 ? 14 : 22)

  if (maximizing) {
    let best = -Infinity
    for (const m of branch) {
      const r = applyPlayerMove(ctx, botInputFor(ctx, m))
      if (!r.ok) continue
      const nextTurn = r.fenAfter.split(' ')[1] === 'b' ? 'black' : 'white'
      // Giratiempo: si sigue el mismo color, profundidad no baja tanto
      const keep = nextTurn === ctx.moverColor
      const child = withFen(
        {
          ...ctx,
          giratiempoMovesLeft: keep ? Math.max(0, ctx.giratiempoMovesLeft - 1) : 0,
          giratiempoActive: keep,
          giratiempoCaptures: keep
            ? ctx.giratiempoCaptures + (r.isCapture ? 1 : 0)
            : 0,
          ply: ctx.ply + 1,
        },
        r.fenAfter,
        nextTurn,
        nextTurn,
      )
      if (r.isMate) return 95_000 + depth
      const v = alphabeta(child, botColor, keep ? depth : depth - 1, alpha, beta, deadline)
      best = Math.max(best, v)
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
      if (Date.now() > deadline) break
    }
    return best === -Infinity ? evaluatePosition(ctx, botColor) : best
  }

  let best = Infinity
  for (const m of branch) {
    const r = applyPlayerMove(ctx, botInputFor(ctx, m))
    if (!r.ok) continue
    const nextTurn = r.fenAfter.split(' ')[1] === 'b' ? 'black' : 'white'
    const child = withFen({ ...ctx, ply: ctx.ply + 1 }, r.fenAfter, nextTurn, nextTurn)
    if (r.isMate) return -95_000 - depth
    const v = alphabeta(child, botColor, depth - 1, alpha, beta, deadline)
    best = Math.min(best, v)
    beta = Math.min(beta, best)
    if (beta <= alpha) break
    if (Date.now() > deadline) break
  }
  return best === Infinity ? evaluatePosition(ctx, botColor) : best
}

/**
 * Elige la mejor jugada legal (alfa-beta ~profundidad 3, tope de tiempo).
 */
export function pickBotMove(
  ctx: EngineContext,
  opts?: { depth?: number; timeMs?: number },
): Move | null {
  const depth = opts?.depth ?? 3
  const deadline = Date.now() + (opts?.timeMs ?? 900)
  const botColor = ctx.moverColor
  const moves = orderedMoves(ctx)
  if (!moves.length) return null

  let bestMove = moves[0]!
  let bestScore = -Infinity

  for (const m of moves.slice(0, 28)) {
    const r = applyPlayerMove(ctx, botInputFor(ctx, m))
    if (!r.ok) continue
    if (r.isMate) return m
    const nextTurn = r.fenAfter.split(' ')[1] === 'b' ? 'black' : 'white'
    const keep = nextTurn === ctx.moverColor
    const child = withFen(
      {
        ...ctx,
        giratiempoMovesLeft: keep ? Math.max(0, ctx.giratiempoMovesLeft - 1) : 0,
        giratiempoActive: keep,
        giratiempoCaptures: keep ? ctx.giratiempoCaptures + (r.isCapture ? 1 : 0) : 0,
        ply: ctx.ply + 1,
      },
      r.fenAfter,
      nextTurn,
      nextTurn,
    )
    const score = alphabeta(
      child,
      botColor,
      keep ? depth : depth - 1,
      -Infinity,
      Infinity,
      deadline,
    )
    // Preferir capturas/jaques en empate
    const tie =
      (r.isCapture ? 3 : 0) + (r.isCheck ? 5 : 0) + (m.promotion ? 8 : 0) + Math.random() * 0.01
    if (score + tie > bestScore) {
      bestScore = score + tie
      bestMove = m
    }
    if (Date.now() > deadline) break
  }

  return bestMove
}

function enemySquares(chess: Chess, me: 'w' | 'b'): string[] {
  const out: string[] = []
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f]
      if (p && p.color !== me && p.type !== 'k') {
        out.push(String.fromCharCode(97 + f) + String(8 - r))
      }
    }
  }
  return out
}

function ownSquares(chess: Chess, me: 'w' | 'b', type?: string): string[] {
  const out: string[] = []
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r]?.[f]
      if (p && p.color === me && (!type || p.type === type)) {
        out.push(String.fromCharCode(97 + f) + String(8 - r))
      }
    }
  }
  return out
}

function vacantSquares(chess: Chess): string[] {
  const out: string[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (!chess.board()[r]?.[f]) out.push(String.fromCharCode(97 + f) + String(8 - r))
    }
  }
  return out
}

/**
 * Propone el mejor comodín a gastar ahora (heurística + delta de evaluación).
 */
export function planBotJoker(
  ctx: EngineContext,
  inventory: BotInvItem[],
  flags: PieceFlag[],
  clocks?: { botMs: number; humanMs: number },
): BotJokerPlan | null {
  if (!inventory.length) return null
  let chess: Chess
  try {
    chess = new Chess(fenWithSideToMove(ctx.fen, ctx.turnColor))
  } catch {
    return null
  }
  const me = cjs(ctx.moverColor)
  const base = evaluatePosition(ctx, ctx.moverColor)
  // Campos sueltos (no `BotJokerPlan | null` mutado en closure): evita never en tsc -b / Vercel.
  let bestScore = -Infinity
  let bestInventoryId = ''
  let bestCode = ''
  let bestPayload: Record<string, unknown> = {}

  const consider = (item: BotInvItem, payload: Record<string, unknown>, bonus = 0) => {
    const result = applyJoker(ctx, item.code, payload)
    if (result.ok === false) return
    let score = bonus
    if (result.newFen) {
      const next = withFen(ctx, result.newFen, ctx.turnColor, ctx.moverColor)
      score += evaluatePosition(next, ctx.moverColor) - base
    } else {
      score += 40 // pasivos / reloj
    }
    if (score > bestScore) {
      bestScore = score
      bestInventoryId = item.id
      bestCode = item.code
      bestPayload = payload
    }
  }

  for (const item of inventory) {
    switch (item.code) {
      case 'axio_tempus':
        consider(item, {}, clocks && clocks.botMs < clocks.humanMs ? 80 : 35)
        break
      case 'petrificus_totalus':
        if ((clocks?.botMs ?? 999999) < 45_000) consider(item, {}, 120)
        else consider(item, {}, 25)
        break
      case 'arresto_momentum':
        if ((clocks?.humanMs ?? 0) > (clocks?.botMs ?? 0)) consider(item, {}, 90)
        else consider(item, {}, 30)
        break
      case 'giratiempo':
        consider(item, {}, 110)
        break
      case 'expecto_patronum':
        if (!ctx.expectoPatronumActive) consider(item, {}, 55)
        break
      case 'paso_fantasma':
        consider(item, {}, 40)
        break
      case 'avada_kedavra': {
        for (const sq of enemySquares(chess, me)) {
          const p = chess.get(sq as Square)
          if (!p || p.type === 'k') continue
          const wasPawn =
            p.type === 'p' ||
            flags.some((f) => f.square === sq && f.was_pawn && f.color !== ctx.moverColor)
          if (!wasPawn) continue
          consider(item, { square: sq }, (PIECE_VALUE[p.type] ?? 100) + 50)
        }
        break
      }
      case 'pocion_multijugos': {
        for (const sq of ownSquares(chess, me, 'p')) {
          const rank = Number(sq[1])
          const adv = me === 'w' ? rank : 9 - rank
          consider(item, { square: sq }, 80 + adv * 15)
        }
        break
      }
      case 'morsmordre': {
        for (const sq of enemySquares(chess, me)) {
          const p = chess.get(sq as Square)
          if (!p) continue
          consider(item, { square: sq }, (PIECE_VALUE[p.type] ?? 0) * 0.35 + 20)
        }
        break
      }
      case 'bombarda': {
        for (const sq of ownSquares(chess, me, 'p')) {
          consider(item, { square: sq }, 70)
        }
        break
      }
      case 'defodio': {
        const vacants = vacantSquares(chess)
        for (const sq of vacants) {
          // Preferir centro / casillas avanzadas
          const file = sq.charCodeAt(0) - 97
          const rank = Number(sq[1])
          const center = 4 - Math.abs(file - 3.5) - Math.abs(rank - 4.5)
          consider(item, { square: sq }, 40 + center * 6)
        }
        break
      }
      case 'capa_invisibilidad': {
        for (const sq of ownSquares(chess, me)) {
          const p = chess.get(sq as Square)
          if (!p || p.type === 'k' || p.type === 'p') continue
          consider(item, { square: sq }, (PIECE_VALUE[p.type] ?? 0) * 0.28 + 20)
        }
        break
      }
      case 'aparicion': {
        const own = ownSquares(chess, me)
        const limit = Math.min(own.length, 10)
        for (let i = 0; i < limit; i++) {
          for (let j = i + 1; j < limit; j++) {
            consider(item, { a: own[i]!, b: own[j]! }, 35)
          }
        }
        break
      }
      case 'imperius': {
        const foes = enemySquares(chess, me)
        for (const from of foes) {
          const piece = chess.get(from as Square)
          if (!piece || piece.type === 'k') continue
          const probes = vacantSquares(chess)
          for (const to of probes) {
            const bonus =
              (PIECE_VALUE[piece.type] ?? 0) * 0.25 +
              (ctx.dimension === 'cadena_sangre' ? 40 : 20)
            consider(item, { from, to }, bonus)
          }
        }
        break
      }
      default:
        break
    }
  }

  // Tras el mejor joker, comprobar que aún hay una jugada decente.
  if (bestScore < 38 || !bestCode || !bestInventoryId) return null
  const plan: BotJokerPlan = {
    inventoryId: bestInventoryId,
    code: bestCode,
    payload: bestPayload,
    score: bestScore,
  }
  if (bestScore < 70) {
    const after = applyJoker(ctx, plan.code, plan.payload)
    if (after.ok && after.newFen) {
      const nextCtx = withFen(ctx, after.newFen, ctx.turnColor, ctx.moverColor)
      const reply = pickBotMove(nextCtx, { depth: 2, timeMs: 120 })
      if (!reply) return null
      const moveRes = applyPlayerMove(nextCtx, botInputFor(nextCtx, reply))
      if (!moveRes.ok) return null
      // Si el joker no mejora la eval ni da jaque, no gastar
      const gain = evaluatePosition(nextCtx, ctx.moverColor) - base
      if (gain < 15 && !moveRes.isCheck && !moveRes.isMate) return null
    }
  }
  return plan
}
