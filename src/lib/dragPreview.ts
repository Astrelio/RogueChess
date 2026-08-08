import { Chess, type Square } from 'chess.js'

/** Preview visual: quita la pieza de `from` y la pone en `hover` (si hay). */
export function fenWithDragPreview(
  fen: string,
  drag: { from: string; hover: string | null } | null | undefined,
): string {
  if (!drag?.from) return fen
  try {
    const chess = new Chess(fen)
    const piece = chess.get(drag.from as Square)
    if (!piece) return fen
    chess.remove(drag.from as Square)
    if (drag.hover) {
      if (drag.hover !== drag.from) {
        chess.remove(drag.hover as Square)
      }
      chess.put(piece, drag.hover as Square)
    }
    return chess.fen()
  } catch {
    return fen
  }
}
