import type {
  ActiveEffect,
  BoardCell,
  Color,
  EngineContext,
  PieceFlag,
} from './types'

type Row = Record<string, unknown>

type StateLike = {
  match: Row
  players: Row[]
  cells?: Row[]
  effects?: Row[]
}

/**
 * Construye el contexto del motor desde el estado JSON de fn_get_match_state
 * + flags de piezas + MAX(ply) (consultados aparte en la ruta).
 */
export function buildContext(args: {
  state: StateLike
  flags: Row[]
  ply: number
  moverColor: Color
}): EngineContext {
  const { state, flags, ply, moverColor } = args
  const m = state.match
  const mover = state.players.find((p) => p.color === moverColor)
  const opponent = state.players.find((p) => p.color !== moverColor)

  return {
    matchId: String(m.id),
    fen: String(m.fen),
    dimension: String(m.current_dimension ?? 'primo'),
    turnColor: (m.turn_color as Color) ?? 'white',
    ply,
    cycleIndex: Number(m.cycle_index ?? 0),
    cells: (state.cells ?? []).map(
      (c): BoardCell => ({
        id: String(c.id),
        square: String(c.square).trim(),
        effect: c.effect as BoardCell['effect'],
        owner_player_id: (c.owner_player_id as string | null) ?? null,
        time_bonus_min_s: (c.time_bonus_min_s as number | null) ?? null,
        time_bonus_max_s: (c.time_bonus_max_s as number | null) ?? null,
        payload: (c.payload as Record<string, unknown>) ?? {},
        is_active: Boolean(c.is_active),
      }),
    ),
    effects: (state.effects ?? []).map(
      (e): ActiveEffect => ({
        id: String(e.id),
        kind: String(e.kind),
        applied_by: (e.applied_by as string | null) ?? null,
        target_player_id: (e.target_player_id as string | null) ?? null,
        payload: (e.payload as Record<string, unknown>) ?? {},
        is_active: Boolean(e.is_active),
      }),
    ),
    flags: flags.map(
      (f): PieceFlag => ({
        piece_uid: String(f.piece_uid),
        color: f.color as Color,
        kind: String(f.kind),
        square: f.square ? String(f.square).trim() : null,
        was_pawn: Boolean(f.was_pawn),
        is_invisible: Boolean(f.is_invisible),
        multijugos_queen: Boolean(f.multijugos_queen),
        multijugos_dies_ply: (f.multijugos_dies_ply as number | null) ?? null,
        payload: (f.payload as Record<string, unknown>) ?? {},
      }),
    ),
    moverColor,
    moverPlayerId: String(mover?.id ?? ''),
    opponentPlayerId: opponent ? String(opponent.id) : null,
    giratiempoActive: Boolean(mover?.giratiempo_active),
    giratiempoMovesLeft: Number(mover?.giratiempo_moves_left ?? 0),
    giratiempoCaptures: Number(mover?.giratiempo_captures ?? 0),
  }
}
