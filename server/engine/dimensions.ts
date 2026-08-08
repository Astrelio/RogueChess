import type { Move } from 'chess.js'
import { chebyshev, fileOf, pathBetween, rankOf, squareAt } from './board.js'
import type { BoardCell, EngineContext } from './types.js'

const SLIDERS = new Set(['q', 'r', 'b'])

export function activeCellMap(ctx: EngineContext): Map<string, BoardCell> {
  const map = new Map<string, BoardCell>()
  for (const c of ctx.cells) {
    if (c.is_active) map.set(c.square, c)
  }
  return map
}

/** Casillas intransitables (ruina + quemadas por bombarda). */
export function blockedSquares(ctx: EngineContext): Set<string> {
  const out = new Set<string>()
  for (const c of ctx.cells) {
    if (c.is_active && (c.effect === 'ruined' || c.effect === 'burned')) out.add(c.square)
  }
  return out
}

export type DimCheck = { ok: true } | { ok: false; reason: string }

/**
 * Valida una jugada contra dimensión activa + celdas bloqueadas.
 */
export function checkMoveAgainstBoard(ctx: EngineContext, move: Move): DimCheck {
  const blocked = blockedSquares(ctx)

  if (blocked.has(move.to)) {
    return { ok: false, reason: 'La casilla destino está quemada o en ruina' }
  }

  if (move.piece !== 'n' && chebyshev(move.from, move.to) > 1) {
    for (const sq of pathBetween(move.from, move.to)) {
      if (blocked.has(sq)) {
        return { ok: false, reason: 'La trayectoria cruza una zona quemada o en ruina' }
      }
    }
  }

  if (ctx.dimension === 'gravitacional' && SLIDERS.has(move.piece)) {
    if (chebyshev(move.from, move.to) > 3) {
      return {
        ok: false,
        reason: 'Dimensión gravitacional: piezas de largo alcance máximo 3 casillas',
      }
    }
  }

  return { ok: true }
}

/**
 * Cadena de sangre: si existe al menos una captura legal (tras filtros de
 * tablero), las jugadas sin captura quedan prohibidas.
 */
export function bloodChainViolation(
  ctx: EngineContext,
  chosen: Move,
  allLegal: Move[],
): DimCheck {
  if (ctx.dimension !== 'cadena_sangre') return { ok: true }
  if (chosen.captured) return { ok: true }
  return bloodChainRequiresCapture(ctx, allLegal)
}

/** Misma regla para rutas espejo/fantasma (sin Move de chess.js). */
export function bloodChainRequiresCapture(ctx: EngineContext, allLegal: Move[]): DimCheck {
  if (ctx.dimension !== 'cadena_sangre') return { ok: true }
  const captureExists = allLegal.some(
    (m) => m.captured && checkMoveAgainstBoard(ctx, m).ok,
  )
  if (captureExists) {
    return {
      ok: false,
      reason: 'Cadena de sangre: hay una captura disponible y es obligatoria',
    }
  }
  return { ok: true }
}

/**
 * Dimensión Espejo — inversión TOTAL del comando (GDD).
 * El destino clickeado/arrastrado es la INTENCIÓN; la pieza va al opuesto.
 * Peones incluidos (avanzan hacia tu propio bando) y enroque (O-O ↔ O-O-O).
 */
export function mirrorCommand(from: string, clickTo: string): string | null {
  const df = fileOf(clickTo) - fileOf(from)
  const dr = rankOf(clickTo) - rankOf(from)
  return squareAt(fileOf(from) - df, rankOf(from) - dr)
}

/** Alias histórico. */
export function mirrorTarget(from: string, to: string, _pieceKind?: string): string | null {
  return mirrorCommand(from, to)
}
