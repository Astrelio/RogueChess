export type JokerRarity = 'common' | 'epic' | 'legendary'
export type JokerFaction = 'spectral' | 'antimatter' | 'tempus'

export type Joker = {
  id: string
  code: string
  name: string
  faction: JokerFaction
  rarity: JokerRarity
  timing: string
  cost_seconds: number
  description: string
  rules_json?: Record<string, unknown>
  is_passive?: boolean
  is_active?: boolean
  shop_weight?: number
  design_hint?: string | null
}

export type MatchPlayer = {
  id: string
  match_id: string
  profile_id: string
  color: 'white' | 'black'
  deck: string | null
  time_ms: number
  inventory_slots: number
  is_bot: boolean
  has_resigned: boolean
  connected: boolean
  username?: string
  display_name?: string
  petrificus_ready?: boolean
  arresto_pending?: boolean
  giratiempo_active?: boolean
  giratiempo_moves_left?: number
  giratiempo_captures?: number
  /** True si ya cerró la tienda y espera al rival. */
  shop_ready?: boolean
}

export type ShopOffer = {
  id: string
  match_id: string
  match_player_id: string
  cycle_index: number
  slot_index: number
  joker_id: string
  cost_seconds: number
  purchased: boolean
  expired: boolean
  joker?: Joker
}

export type MatchInventoryItem = {
  id: string
  match_id: string
  match_player_id: string
  joker_id: string
  status: string
  purchased_cost_s: number
  slot_index: number | null
  joker?: Joker
}

export type MatchRow = {
  id: string
  mode: string
  status: string
  phase: string
  result: string | null
  white_id: string | null
  black_id: string | null
  winner_id: string | null
  time_control_s: number
  white_time_ms: number
  black_time_ms: number
  clock_running_for: 'white' | 'black' | null
  clock_updated_at?: string | null
  cycle_index: number
  moves_in_phase: number
  moves_per_phase: number
  current_dimension: string
  fen: string
  turn_color: 'white' | 'black'
  expecto_patronum_active: boolean
  started_at: string | null
  finished_at: string | null
  /** Inicio / fin del minuto de tienda (ISO). */
  shop_opened_at?: string | null
  shop_ends_at?: string | null
  /** Solo mode=custom (sala personalizada). */
  invite_code?: string | null
  allow_spectators?: boolean
  is_rated?: boolean
}

export type BoardCell = {
  id: string
  match_id?: string
  square: string
  effect: 'none' | 'ruined' | 'burned' | 'monolith' | 'trap_defodio'
  owner_player_id?: string | null
  time_bonus_min_s?: number | null
  time_bonus_max_s?: number | null
  payload?: Record<string, unknown>
  is_active?: boolean
}

export type PieceFlag = {
  piece_uid: string
  color: 'white' | 'black'
  kind: string
  square: string | null
  was_pawn?: boolean
  is_invisible?: boolean
  multijugos_queen?: boolean
  multijugos_dies_ply?: number | null
  payload?: Record<string, unknown>
}

export type MatchSpectator = {
  id: string
  match_id: string
  profile_id: string
  is_active: boolean
  joined_at: string
  left_at: string | null
  username?: string
  display_name?: string
}

export type RecentSpectatorEmoji = {
  id: string
  emoji: string
  created_at: string
  username?: string
  /** firebase_uid del emisor (para descartar los propios). */
  from_uid: string
  /** Lado del tablero (si la API lo envía; si no, Portal lo trae). */
  target_color?: 'white' | 'black' | string | null
}

export type MatchState = {
  match: MatchRow
  players: MatchPlayer[]
  cells: BoardCell[]
  effects: unknown[]
  inventory: MatchInventoryItem[]
  shop: ShopOffer[]
  spectators: MatchSpectator[]
  dimension_history: unknown[]
  /** Marcadores de piezas (capa, multijugos, ex-peón…). */
  flags?: PieceFlag[]
  you?: MatchPlayer | null
  /** Reacciones recientes (respaldo por polling si Portal no entrega). */
  recent_emojis?: RecentSpectatorEmoji[]
}
