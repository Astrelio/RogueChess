import type { MatchState } from '@/types/match'
import type { MatchBoardSnapshot } from '@/lib/portal'

/**
 * Orden de fase dentro de un ciclo: waiting < action < shop.
 * Al cerrar tienda el server sube cycle_index al pasar a active (grieta).
 * NUNCA puntuar active > shop en el mismo ciclo (rompía el mercado).
 */
function phaseRank(status: string, phase?: string): number {
  if (status === 'finished') return 90
  if (status === 'dimension_reveal') return 30
  if (status === 'shop' || phase === 'shop') return 20
  if (status === 'active' || phase === 'action' || phase === 'grieta') return 10
  if (status === 'waiting') return 1
  return 0
}

/** Progreso monotónico de la partida (mayor = más reciente). */
export function matchProgress(m: {
  cycle_index: number
  moves_in_phase: number
  status: string
  phase?: string
}): number {
  if (m.status === 'finished') return 1_000_000_000_000 + m.cycle_index
  return m.cycle_index * 1_000_000 + phaseRank(m.status, m.phase) * 1_000 + m.moves_in_phase
}

/** ¿El estado REST entrante está detrás del que ya tenemos? */
export function isStaleMatchState(incoming: MatchState, current: MatchState | null): boolean {
  if (!current) return false
  if (current.match.status === 'finished' && incoming.match.status !== 'finished') return true
  return matchProgress(incoming.match) < matchProgress(current.match)
}

/** ¿Un pulso Portal de tablero está detrás del estado local? */
export function isStaleBoardPulse(
  board: MatchBoardSnapshot,
  current: MatchState | null,
  lastBoardAt: number,
): boolean {
  if (typeof board.at === 'number' && board.at > 0 && board.at < lastBoardAt) return true
  if (!current) return false
  if (current.match.status === 'finished' && board.status !== 'finished') return true

  const pulse = {
    cycle_index: board.cycle_index || 0,
    moves_in_phase: board.moves_in_phase || 0,
    status: board.status || current.match.status,
    phase: board.phase || current.match.phase,
  }

  if (board.preview) {
    return matchProgress(pulse) < matchProgress(current.match)
  }

  // Relojes sin FEN y sin cambio de fase
  if (
    !board.fen &&
    board.status !== 'finished' &&
    board.status !== 'shop' &&
    board.status !== 'active' &&
    board.status !== 'dimension_reveal'
  ) {
    return false
  }

  // Pulso solo-reloj (fen vacío, status vacío): no comparar progreso
  if (!board.fen && !board.status) return false

  return matchProgress(pulse) < matchProgress(current.match)
}

/** Detecta cambio de fase/status relevante para UI (tienda ↔ acción ↔ fin). */
export function isPhaseTransition(
  prev: { status: string; phase?: string; cycle_index: number } | null | undefined,
  next: { status: string; phase?: string; cycle_index: number },
): boolean {
  if (!prev) return Boolean(next.status)
  if (prev.status !== next.status) return true
  if ((prev.phase || '') !== (next.phase || '')) return true
  if (prev.cycle_index !== next.cycle_index) return true
  return false
}
