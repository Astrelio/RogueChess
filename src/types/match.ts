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

export type MatchState = {
  match: MatchRow
  players: MatchPlayer[]
  cells: BoardCell[]
  effects: unknown[]
  inventory: MatchInventoryItem[]
  shop: ShopOffer[]
  spectators: unknown[]
  dimension_history: unknown[]
  you?: MatchPlayer | null
}
