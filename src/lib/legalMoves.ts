import { Chess, type Square } from 'chess.js'
import { mirrorCommand } from '@/lib/mirrorMove'

/** Casillas entre a y b (misma lógica que MatchPage / server). */
export function pathBetween(a: string, b: string): string[] {
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
    const file = a.charCodeAt(0) - 97 + sf * i
    const rank = Number(a[1]) - 1 + sr * i
    if (file < 0 || file > 7 || rank < 0 || rank > 7) break
    out.push(String.fromCharCode(97 + file) + String(rank + 1))
  }
  return out
}

export type MoveHint = {
  /** Casilla donde soltar / clic (en Espejo ≠ destino efectivo). */
  square: string
  /** Destino real de la pieza. */
  land: string
  capture: boolean
}

/**
 * Destinos legales vía chess.js (cada tipo de pieza ya viene en `moves`).
 * Respeta quemadas/ruina y mapea a casilla de clic en dimensión Espejo.
 */
export function getMoveHints(
  fen: string,
  from: string,
  blocked: Set<string>,
  dimension?: string | null,
): MoveHint[] {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return []
  }

  const piece = chess.get(from as Square)
  if (!piece) return []

  const moves = chess.moves({ square: from as Square, verbose: true })
  const hints: MoveHint[] = []
  const seen = new Set<string>()

  for (const m of moves) {
    const land = m.to
    if (blocked.has(land)) continue
    if (piece.type !== 'n' && pathBetween(from, land).some((sq) => blocked.has(sq))) continue

    let square = land
    if (dimension === 'espejo') {
      const click = mirrorCommand(from, land)
      if (!click) continue
      square = click
    }

    if (seen.has(square)) continue
    seen.add(square)
    hints.push({
      square,
      land,
      capture: typeof m.isCapture === 'function' ? m.isCapture() : Boolean(m.captured),
    })
  }

  return hints
}
