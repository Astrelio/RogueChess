export type Color = 'white' | 'black'
export type CellEffect = 'none' | 'ruined' | 'burned' | 'monolith' | 'trap_defodio'

export type BoardCell = {
  id: string
  square: string
  effect: CellEffect
  owner_player_id: string | null
  time_bonus_min_s: number | null
  time_bonus_max_s: number | null
  payload: Record<string, unknown>
  is_active: boolean
}

export type ActiveEffect = {
  id: string
  kind: string
  applied_by: string | null
  target_player_id?: string | null
  payload: Record<string, unknown>
  is_active: boolean
}

export type PieceFlag = {
  piece_uid: string
  color: Color
  kind: string
  square: string | null
  was_pawn: boolean
  is_invisible: boolean
  multijugos_queen: boolean
  multijugos_dies_ply: number | null
  payload: Record<string, unknown>
}

export type EngineContext = {
  matchId: string
  fen: string
  dimension: string
  turnColor: Color
  /** MAX(ply) actual en match_moves (el próximo evento será ply+1) */
  ply: number
  cycleIndex: number
  cells: BoardCell[]
  effects: ActiveEffect[]
  flags: PieceFlag[]
  /** Jugador que ejecuta la acción */
  moverColor: Color
  moverPlayerId: string
  opponentPlayerId: string | null
  /** Flags Giratiempo del jugador que mueve */
  giratiempoActive: boolean
  giratiempoMovesLeft: number
  giratiempoCaptures: number
  /** Expecto Patronum activo en la partida (anula Morsmordre en todo el tablero). */
  expectoPatronumActive: boolean
}

export type CellOp =
  | { op: 'deactivate'; id: string }
  | {
      op: 'insert'
      square: string
      effect: CellEffect
      ownerPlayerId?: string | null
      payload?: Record<string, unknown>
      expiresCycle?: number | null
      timeBonusMinS?: number | null
      timeBonusMaxS?: number | null
    }

export type FlagOp =
  | {
      op: 'upsert'
      pieceUid: string
      color: Color
      kind: string
      square: string | null
      wasPawn?: boolean
      isInvisible?: boolean
      multijugosQueen?: boolean
      multijugosDiesPly?: number | null
      payload?: Record<string, unknown>
    }
  | { op: 'move'; pieceUid: string; square: string }
  | { op: 'remove'; pieceUid: string }

export type EffectOp = { op: 'deactivate'; id: string }

export type ClockOp = { color: Color; deltaMs: number; reason: string }

export type EngineOps = {
  newFen?: string
  cellOps: CellOp[]
  flagOps: FlagOp[]
  effectOps: EffectOp[]
  clockOps: ClockOp[]
  /** Eventos legibles (log / UI futura) */
  events: string[]
}

export type JokerResult =
  | ({ ok: true; fizzled?: boolean } & EngineOps)
  | { ok: false; error: string }

export type MoveResult =
  | ({
      ok: true
      fenAfter: string
      san: string
      uci: string
      isCapture: boolean
      isCheck: boolean
      isMate: boolean
      /** Ahogado: rival sin jugadas legales y no en jaque → tablas. */
      isStalemate: boolean
      ghostUsed: boolean
    } & EngineOps)
  | { ok: false; error: string }

export function emptyOps(): EngineOps {
  return { cellOps: [], flagOps: [], effectOps: [], clockOps: [], events: [] }
}
