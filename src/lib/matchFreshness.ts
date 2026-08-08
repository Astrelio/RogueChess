import type { MatchState } from '@/types/match'
import type { MatchBoardSnapshot } from '@/lib/portal'

/** Progreso monotónico de la partida (mayor = más reciente). */
export function matchProgress(m: {
  cycle_index: number
  moves_in_phase: number
  status: string
  phase?: string
}): number {
  const finished = m.status === 'finished' ? 2_000_000 : 0
  const active = m.status === 'active' || m.phase === 'action' ? 100_000 : 0
  const shop = m.status === 'shop' || m.phase === 'shop' ? 50_000 : 0
  return finished + active + shop + m.cycle_index * 1_000 + m.moves_in_phase
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
  if (board.preview) {
    // Preview nunca puede ir “hacia atrás” respecto al progreso ya aplicado
    const pulseProgress =
      (board.status === 'finished' ? 2_000_000 : 0) +
      board.cycle_index * 1_000 +
      board.moves_in_phase
    return pulseProgress < matchProgress(current.match)
  }
  if (!board.fen && board.status !== 'finished') {
    // Solo relojes: no regresar progreso; el `at` ya se validó arriba
    return false
  }
  const pulse = {
    cycle_index: board.cycle_index || 0,
    moves_in_phase: board.moves_in_phase || 0,
    status: board.status || current.match.status,
    phase: board.phase || current.match.phase,
  }
  return matchProgress(pulse) < matchProgress(current.match)
}
