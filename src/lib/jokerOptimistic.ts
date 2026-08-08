import { Chess, type Square } from 'chess.js'

/** FEN tras editar piezas, conservando turno y limpiando en passant. */
function editedFen(chess: Chess): string {
  const parts = chess.fen().split(' ')
  parts[3] = '-'
  return parts.join(' ')
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
  const backRank = (sq: string) => sq[1] === '1' || sq[1] === '8'
  if ((pa.type === 'p' && backRank(b)) || (pb.type === 'p' && backRank(a))) return null
  chess.remove(a as Square)
  chess.remove(b as Square)
  chess.put({ type: pb.type, color: pb.color }, a as Square)
  chess.put({ type: pa.type, color: pa.color }, b as Square)
  return editedFen(chess)
}

/** Preview: quitar pieza en casilla (Avada / Morsmordre). */
export function previewRemovePieceFen(fen: string, square: string): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  if (!chess.get(square as Square)) return null
  chess.remove(square as Square)
  return editedFen(chess)
}
