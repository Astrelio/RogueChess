import { Chess, type Square } from 'chess.js'
import type { PieceFlag } from '@/types/match'

/**
 * Oculta del FEN las piezas invisibles del rival (Capa de invisibilidad).
 * El dueño sigue viéndolas.
 */
export function fenHideEnemyInvisible(
  fen: string,
  flags: PieceFlag[] | undefined,
  viewerColor: 'white' | 'black' | undefined,
): string {
  if (!fen || !flags?.length || !viewerColor) return fen
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return fen
  }
  let changed = false
  for (const f of flags) {
    if (!f.is_invisible || !f.square) continue
    if (f.color === viewerColor) continue
    if (!chess.get(f.square as Square)) continue
    chess.remove(f.square as Square)
    changed = true
  }
  if (!changed) return fen
  const parts = chess.fen().split(' ')
  // Conservar reloj de turno / en passant / halfmove del FEN original
  const orig = fen.split(' ')
  if (orig.length >= 6) {
    parts[1] = orig[1]!
    parts[2] = orig[2]!
    parts[3] = orig[3]!
    parts[4] = orig[4]!
    parts[5] = orig[5]!
  }
  return parts.join(' ')
}
