import { Chess, type Square } from 'chess.js'

/** FEN tras editar piezas, conservando turno y limpiando en passant. */
function editedFen(chess: Chess): string {
  const parts = chess.fen().split(' ')
  parts[3] = '-'
  return parts.join(' ')
}

function backwardSquare(sq: string, color: 'white' | 'black'): string | null {
  const file = sq.charCodeAt(0) - 97
  const rank = Number(sq[1]) - 1 + (color === 'white' ? -1 : 1)
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return String.fromCharCode(97 + file) + String(rank + 1)
}

/**
 * Preview local del intercambio Aparición (misma regla que el motor).
 * Devuelve null si el swap no es válido en cliente.
 */
export function previewAparicionFen(
  fen: string,
  a: string,
  b: string,
  moverColor: 'white' | 'black',
): string | null {
  if (a === b) return null
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  const me = moverColor === 'white' ? 'w' : 'b'
  const pa = chess.get(a as Square)
  const pb = chess.get(b as Square)
  if (!pa || pa.color !== me || !pb || pb.color !== me) return null
  const backRank = (s: string) => s[1] === '1' || s[1] === '8'
  if ((pa.type === 'p' && backRank(b)) || (pb.type === 'p' && backRank(a))) return null
  chess.remove(a as Square)
  chess.remove(b as Square)
  chess.put({ type: pb.type, color: pb.color }, a as Square)
  chess.put({ type: pa.type, color: pa.color }, b as Square)
  return editedFen(chess)
}

/** Preview: quitar pieza en casilla (Avada). Nunca el rey; solo peón o was_pawn. */
export function previewRemovePieceFen(
  fen: string,
  square: string,
  opts?: { wasPawn?: boolean },
): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  const target = chess.get(square as Square)
  if (!target || target.type === 'k') return null
  if (target.type !== 'p' && !opts?.wasPawn) return null
  chess.remove(square as Square)
  return editedFen(chess)
}

/** Preview Multijugos: peón propio → dama en la misma casilla. */
export function previewMultijugosFen(
  fen: string,
  square: string,
  moverColor: 'white' | 'black',
): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  const me = moverColor === 'white' ? 'w' : 'b'
  const piece = chess.get(square as Square)
  if (!piece || piece.color !== me || piece.type !== 'p') return null
  chess.remove(square as Square)
  chess.put({ type: 'q', color: me }, square as Square)
  return editedFen(chess)
}

/**
 * Preview Morsmordre: la pieza enemiga retrocede (y puede aplastar una tuya).
 */
export function previewMorsmordreFen(
  fen: string,
  square: string,
  moverColor: 'white' | 'black',
  blocked: Set<string> = new Set(),
): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  const me = moverColor === 'white' ? 'w' : 'b'
  const target = chess.get(square as Square)
  if (!target || target.color === me || target.type === 'k') return null
  const targetColor: 'white' | 'black' = target.color === 'w' ? 'white' : 'black'
  const back = backwardSquare(square, targetColor)
  if (!back || (target.type === 'p' && (back[1] === '1' || back[1] === '8'))) return null
  if (blocked.has(back)) return null
  const occupant = chess.get(back as Square)
  if (occupant && occupant.color !== me) return null
  if (occupant?.type === 'k') return null
  if (occupant && occupant.color === me) chess.remove(back as Square)
  chess.remove(square as Square)
  chess.put({ type: target.type, color: target.color }, back as Square)
  return editedFen(chess)
}
