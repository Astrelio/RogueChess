import { Chess, type Square } from 'chess.js'

/**
 * Preview local de Paso Fantasma (alineado con server/engine/moves tryGhostMove).
 * Atraviesa piezas; `pathBlocked` (ruina) corta el rayo; `blocked` solo el aterrizaje.
 */
export function applyGhostMoveFen(
  fen: string,
  from: string,
  to: string,
  moverColor: 'white' | 'black',
  blocked: Set<string> = new Set(),
  gravity = false,
  pathBlocked: Set<string> = new Set(),
): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  const piece = chess.get(from as Square)
  if (!piece) return null
  const me = moverColor === 'white' ? 'w' : 'b'
  if (piece.color !== me) return null

  const df = Math.abs(to.charCodeAt(0) - from.charCodeAt(0))
  const dr = Number(to[1]) - Number(from[1])
  const type = piece.type

  if (type === 'q' || type === 'r' || type === 'b') {
    const straight = df === 0 || dr === 0
    const diagonal = df === Math.abs(dr)
    if (type === 'r' && !straight) return null
    if (type === 'b' && !diagonal) return null
    if (type === 'q' && !straight && !diagonal) return null
    if (gravity) {
      const cheb = Math.max(df, Math.abs(dr))
      if (cheb > 3) return null
    }
  } else if (type === 'p') {
    const dir = moverColor === 'white' ? 1 : -1
    const startRank = moverColor === 'white' ? 2 : 7
    const okStep = df === 0 && (dr === dir || (dr === 2 * dir && Number(from[1]) === startRank))
    if (!okStep) return null
    if (chess.get(to as Square)) return null
  } else {
    return null
  }

  if (blocked.has(to)) return null
  const path = pathBetween(from, to)
  for (const sq of path) {
    if (pathBlocked.has(sq)) return null
    const inPath = chess.get(sq as Square)
    if (inPath?.type === 'k') return null
  }

  const target = chess.get(to as Square)
  if (target) {
    if (target.color === me) return null
    if (target.type === 'k') return null
  }
  if (!target && type === 'p' && (to[1] === '1' || to[1] === '8')) return null

  chess.remove(from as Square)
  chess.remove(to as Square)
  chess.put({ type: piece.type, color: piece.color }, to as Square)
  const parts = chess.fen().split(' ')
  parts[1] = moverColor === 'white' ? 'b' : 'w'
  parts[3] = '-'
  parts[4] = '0'
  if (moverColor === 'black') parts[5] = String(Number(parts[5]) + 1)
  return parts.join(' ')
}

function pathBetween(a: string, b: string): string[] {
  const df = b.charCodeAt(0) - a.charCodeAt(0)
  const dr = Number(b[1]) - Number(a[1])
  const straight = df === 0 || dr === 0
  const diagonal = Math.abs(df) === Math.abs(dr)
  if (!straight && !diagonal) return []
  const steps = Math.max(Math.abs(df), Math.abs(dr))
  if (steps <= 1) return []
  const sf = Math.sign(df)
  const sr = Math.sign(dr)
  const out: string[] = []
  for (let i = 1; i < steps; i++) {
    const file = String.fromCharCode(a.charCodeAt(0) + sf * i)
    const rank = String(Number(a[1]) + sr * i)
    out.push(file + rank)
  }
  return out
}
