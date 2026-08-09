import { Chess, type Square } from 'chess.js'

/**
 * Dimensión Espejo — inversión total del comando (alineado con server/engine).
 * El destino arrastrado es la intención; la pieza va al opuesto.
 */

function fileOf(sq: string) {
  return sq.charCodeAt(0) - 97
}
function rankOf(sq: string) {
  return Number(sq[1]) - 1
}
function squareAt(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return String.fromCharCode(97 + file) + String(rank + 1)
}

export function mirrorCommand(from: string, clickTo: string): string | null {
  const df = fileOf(clickTo) - fileOf(from)
  const dr = rankOf(clickTo) - rankOf(from)
  return squareAt(fileOf(from) - df, rankOf(from) - dr)
}

/** @deprecated usar mirrorCommand */
export function mirrorTarget(from: string, to: string, _pieceKind?: string): string | null {
  return mirrorCommand(from, to)
}

/**
 * Aplica en el cliente un peón bajo Espejo (hacia el propio bando) cuando
 * chess.js rechaza el destino invertido. Sin coronación en fila propia.
 */
export function applyMirrorPawnFen(
  fen: string,
  from: string,
  to: string,
  color: 'white' | 'black',
  blocked?: Set<string>,
  pathBlocked?: Set<string>,
): string | null {
  try {
    const chess = new Chess(fen)
    const piece = chess.get(from as Square)
    if (!piece || piece.type !== 'p') return null

    const df = fileOf(to) - fileOf(from)
    const dr = rankOf(to) - rankOf(from)
    const homeDir = color === 'white' ? -1 : 1
    const doubleRank = color === 'white' ? 7 : 2
    const homeEdge = color === 'white' ? 1 : 8
    const target = chess.get(to as Square)

    if (blocked?.has(to)) return null
    if (Number(to[1]) === homeEdge) return null

    const isPush =
      df === 0 && !target && (dr === homeDir || (dr === 2 * homeDir && Number(from[1]) === doubleRank))
    const isCapture =
      Math.abs(df) === 1 &&
      dr === homeDir &&
      !!target &&
      target.color !== piece.color &&
      target.type !== 'k'
    if (!isPush && !isCapture) return null

    if (isPush && Math.abs(dr) === 2) {
      const mid = squareAt(fileOf(from), rankOf(from) + homeDir)
      if (!mid || chess.get(mid as Square)) return null
      if (pathBlocked?.has(mid)) return null
    }

    chess.remove(from as Square)
    chess.remove(to as Square)
    chess.put({ type: 'p', color: piece.color }, to as Square)

    const parts = chess.fen().split(' ')
    parts[1] = color === 'white' ? 'b' : 'w'
    parts[3] = '-'
    parts[4] = '0'
    if (color === 'black') parts[5] = String(Number(parts[5]) + 1)
    return parts.join(' ')
  } catch {
    return null
  }
}
