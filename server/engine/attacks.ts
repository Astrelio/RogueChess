import { Chess, type PieceSymbol, type Square } from 'chess.js'
import { chebyshev, fileOf, pathBetween, rankOf, squareAt } from './board.js'
import { blockedSquares } from './dimensions.js'
import type { Color, EngineContext } from './types.js'

const KNIGHT_DELTAS: [number, number][] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
]
const KING_DELTAS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

function cjs(color: Color): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b'
}

/**
 * ¿La casilla está atacada por `byColor` respetando ruina/quemado y
 * gravitacional (deslizantes ≤3)? Caballos saltan zonas muertas.
 */
export function isSquareAttacked(
  fen: string,
  square: string,
  byColor: Color,
  ctx?: Pick<EngineContext, 'dimension' | 'cells'>,
): boolean {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return false
  }
  const enemy = cjs(byColor)
  const blocked = ctx ? blockedSquares(ctx as EngineContext) : new Set<string>()
  const gravity = ctx?.dimension === 'gravitacional'

  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== enemy) continue
      if (pieceAttacksSquare(chess, p.square, square, p.type, blocked, gravity)) return true
    }
  }
  return false
}

function pieceAttacksSquare(
  chess: Chess,
  from: string,
  to: string,
  type: PieceSymbol,
  blocked: Set<string>,
  gravity: boolean,
): boolean {
  if (from === to) return false
  const df = fileOf(to) - fileOf(from)
  const dr = rankOf(to) - rankOf(from)
  const adf = Math.abs(df)
  const adr = Math.abs(dr)

  switch (type) {
    case 'n':
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1)
    case 'k':
      return adf <= 1 && adr <= 1
    case 'p': {
      const dir = chess.get(from as Square)?.color === 'w' ? 1 : -1
      return adr === dir && adf === 1
    }
    case 'r':
      if (df !== 0 && dr !== 0) return false
      return sliderAttacks(chess, from, to, blocked, gravity)
    case 'b':
      if (adf !== adr) return false
      return sliderAttacks(chess, from, to, blocked, gravity)
    case 'q':
      if (df !== 0 && dr !== 0 && adf !== adr) return false
      return sliderAttacks(chess, from, to, blocked, gravity)
    default:
      return false
  }
}

function sliderAttacks(
  chess: Chess,
  from: string,
  to: string,
  blocked: Set<string>,
  gravity: boolean,
): boolean {
  if (gravity && chebyshev(from, to) > 3) return false
  if (blocked.has(to)) return false
  for (const sq of pathBetween(from, to)) {
    if (blocked.has(sq)) return false
    if (chess.get(sq as Square)) return false
  }
  return true
}

/** Rey de `color` amenazado bajo reglas de dimensión. */
export function kingInCheck(
  fen: string,
  color: Color,
  ctx?: Pick<EngineContext, 'dimension' | 'cells'>,
): boolean {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return false
  }
  const me = cjs(color)
  let kingSq: string | null = null
  for (const row of chess.board()) {
    for (const p of row) {
      if (p && p.type === 'k' && p.color === me) {
        kingSq = p.square
        break
      }
    }
    if (kingSq) break
  }
  if (!kingSq) return false
  const by: Color = color === 'white' ? 'black' : 'white'
  return isSquareAttacked(fen, kingSq, by, ctx)
}

/** Contador de atacantes (fragilidad); ignora rayos ilegales. */
export function countAttackers(
  fen: string,
  square: string,
  byColor: Color,
  ctx?: Pick<EngineContext, 'dimension' | 'cells'>,
): number {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return 0
  }
  const enemy = cjs(byColor)
  const blocked = ctx ? blockedSquares(ctx as EngineContext) : new Set<string>()
  const gravity = ctx?.dimension === 'gravitacional'
  let n = 0
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== enemy) continue
      if (pieceAttacksSquare(chess, p.square, square, p.type, blocked, gravity)) n++
    }
  }
  return n
}

export type PseudoMove = {
  from: string
  to: string
  promotion?: PieceSymbol
  piece: PieceSymbol
  captured?: PieceSymbol
}

/**
 * Movimientos geométricos con trayectoria libre (sin filtrar jaque).
 * Sirve para rescatar jugadas que chess.js descarta por jaques/pins falsos
 * (gravitacional / zonas muertas).
 */
export function generatePseudoLegalMoves(fen: string, color: Color): PseudoMove[] {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return []
  }
  const me = cjs(color)
  const out: PseudoMove[] = []

  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== me) continue
      const from = p.square
      const dests = destinationsFor(chess, from, p.type, me)
      for (const to of dests) {
        const target = chess.get(to as Square)
        if (target?.color === me) continue
        if (target?.type === 'k') continue
        if (p.type === 'p' && (to[1] === '1' || to[1] === '8')) {
          for (const promo of ['q', 'r', 'b', 'n'] as PieceSymbol[]) {
            out.push({
              from,
              to,
              promotion: promo,
              piece: p.type,
              captured: target?.type,
            })
          }
        } else {
          out.push({ from, to, piece: p.type, captured: target?.type })
        }
      }
    }
  }
  return out
}

function destinationsFor(
  chess: Chess,
  from: string,
  type: PieceSymbol,
  me: 'w' | 'b',
): string[] {
  const out: string[] = []
  const f0 = fileOf(from)
  const r0 = rankOf(from)

  const pushRay = (df: number, dr: number) => {
    for (let i = 1; i < 8; i++) {
      const sq = squareAt(f0 + df * i, r0 + dr * i)
      if (!sq) break
      const occ = chess.get(sq as Square)
      out.push(sq)
      if (occ) break
    }
  }

  switch (type) {
    case 'n':
      for (const [df, dr] of KNIGHT_DELTAS) {
        const sq = squareAt(f0 + df, r0 + dr)
        if (sq) out.push(sq)
      }
      break
    case 'k':
      for (const [df, dr] of KING_DELTAS) {
        const sq = squareAt(f0 + df, r0 + dr)
        if (sq) out.push(sq)
      }
      break
    case 'r':
      pushRay(1, 0)
      pushRay(-1, 0)
      pushRay(0, 1)
      pushRay(0, -1)
      break
    case 'b':
      pushRay(1, 1)
      pushRay(1, -1)
      pushRay(-1, 1)
      pushRay(-1, -1)
      break
    case 'q':
      pushRay(1, 0)
      pushRay(-1, 0)
      pushRay(0, 1)
      pushRay(0, -1)
      pushRay(1, 1)
      pushRay(1, -1)
      pushRay(-1, 1)
      pushRay(-1, -1)
      break
    case 'p': {
      const dir = me === 'w' ? 1 : -1
      const start = me === 'w' ? 1 : 6
      const one = squareAt(f0, r0 + dir)
      if (one && !chess.get(one as Square)) {
        out.push(one)
        if (r0 === start) {
          const two = squareAt(f0, r0 + 2 * dir)
          if (two && !chess.get(two as Square)) out.push(two)
        }
      }
      for (const df of [-1, 1]) {
        const cap = squareAt(f0 + df, r0 + dir)
        if (!cap) continue
        const t = chess.get(cap as Square)
        if (t && t.color !== me) out.push(cap)
      }
      break
    }
  }
  return out
}

/** Aplica un pseudo-movimiento y devuelve FEN (turno pasado al rival). */
export function fenAfterPseudoMove(
  fen: string,
  move: PseudoMove,
  mover: Color,
): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  const piece = chess.get(move.from as Square)
  if (!piece) return null
  chess.remove(move.from as Square)
  chess.remove(move.to as Square)
  chess.put(
    { type: move.promotion ?? piece.type, color: piece.color },
    move.to as Square,
  )
  const parts = chess.fen().split(' ')
  parts[1] = mover === 'white' ? 'b' : 'w'
  if (piece.type === 'k' || piece.type === 'r') {
    parts[2] = stripCastlingRights(parts[2], move.from)
  }
  if (move.captured === 'r') {
    parts[2] = stripCastlingRights(parts[2], move.to)
  }
  parts[3] = '-'
  parts[4] = '0'
  if (mover === 'black') parts[5] = String(Number(parts[5]) + 1)
  return parts.join(' ')
}

function stripCastlingRights(castling: string, sq: string): string {
  let out = castling
  if (sq === 'e1') out = out.replace(/[KQ]/g, '')
  if (sq === 'e8') out = out.replace(/[kq]/g, '')
  if (sq === 'h1') out = out.replace('K', '')
  if (sq === 'a1') out = out.replace('Q', '')
  if (sq === 'h8') out = out.replace('k', '')
  if (sq === 'a8') out = out.replace('q', '')
  return out === '' ? '-' : out
}
