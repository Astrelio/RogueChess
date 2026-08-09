import { Portal } from '@portalsdk/core'

const apiKey = import.meta.env.VITE_PORTAL_PUBLIC_KEY as string | undefined

export const portalReady = Boolean(apiKey)

/** Cliente único. Pasivo hasta que un canal se monte. */
export const portal = portalReady ? new Portal({ apiKey: apiKey! }) : null

export function matchChannelId(matchId: string) {
  return `match:${matchId}`
}

export function lobbyChannelId() {
  return 'lobby:presence'
}

/** Snapshot liviano (límite Portal content ≤2KB). */
export type MatchBoardSnapshot = {
  matchId: string
  fen: string
  white_time_ms: number
  black_time_ms: number
  turn_color: string
  /** Quién gasta reloj; null = pausado (1ª jugada / tienda / petrificus). */
  clock_running_for: 'white' | 'black' | null
  status: string
  phase: string
  cycle_index: number
  moves_in_phase: number
  /** Dimensión actual (crítica tras tienda → grieta). */
  current_dimension?: string
  at: number
  /** Preview optimista: solo FEN; no tocar relojes/turno. */
  preview?: boolean
  /** Fin de partida (para late-join / reconexión). */
  result?: string | null
  winner_id?: string | null
}

/** Evento persistente: fuerza refetch REST (Neon = autoridad). */
export type MatchDirtyPayload = {
  type: 'match_dirty'
  matchId: string
  reason: string
  at: number
}

/** Fin de partida persistente — late-joiners / pestaña que vuelve. */
export type MatchOverPayload = {
  type: 'match_over'
  matchId: string
  status: 'finished'
  result: string | null
  winner_id: string | null
  fen: string
  at: number
}

export type MatchBoardPayload = MatchBoardSnapshot & {
  type: 'match_board'
}

export type MatchClockPayload = {
  type: 'match_clocks'
  matchId: string
  white_time_ms: number
  black_time_ms: number
  turn_color: string
  clock_running_for: 'white' | 'black' | null
  at: number
}

export type ChallengePayload = {
  type: 'challenge'
  title: string
  fromUsername: string
  fromUid: string
  /** Firebase uid del invitado. */
  toUid?: string
  /** Username del invitado (filtro de respaldo). */
  toUsername?: string
  message?: string
  /** Partida waiting creada por el retador. */
  matchId?: string
  at?: number
}

/** Señales de matchmaking en lobby:presence */
export type LookingPayload = {
  type: 'looking'
  uid: string
  username: string
  at: number
}

export type MatchReadyPayload = {
  type: 'match_ready'
  matchId: string
  uids: string[]
  at: number
}

/** Pulso de ranking en lobby: alguien entró/salió de partida o cola. */
export type RankingPulsePayload = {
  type: 'ranking_pulse'
  at: number
  reason?: string
}

export type LobbyPayload = ChallengePayload | LookingPayload | MatchReadyPayload | RankingPulsePayload

/** Arrastre en vivo (ephemeral, alta frecuencia). */
export type PieceDragPayload = {
  type: 'piece_drag'
  matchId: string
  from: string
  hover: string | null
  piece: string
  active: boolean
  uid?: string
  at: number
}

/** Listo en tienda (ephemeral) — rival actualiza wait UI sin esperar dirty. */
export type ShopReadyPayload = {
  type: 'shop_ready'
  matchId: string
  uid: string
  color: 'white' | 'black'
  cycle_index: number
  at: number
}

/** Reacción rápida en partida (ephemeral). */
export type MatchEmotePayload = {
  type: 'match_emote'
  matchId: string
  uid: string
  emote: string
  at: number
}

/** FX de comodín (ephemeral) — peers reproducen overlay/ritual/reloj. */
export type MatchJokerFxPayload = {
  type: 'match_joker_fx'
  matchId: string
  uid: string
  code: string
  squares: string[]
  /** FEN post-cast (preview) para pintar tablero sin esperar dirty/REST. */
  fen?: string
  at: number
}

/** Aim de comodín (ephemeral) — espectadores/rival ven partículas y casillas. */
export type MatchJokerAimPayload = {
  type: 'match_joker_aim'
  matchId: string
  uid: string
  active: boolean
  code?: string
  /** Casillas con aura/partículas (hints). */
  squares?: string[]
  /** Casillas ya elegidas en multi-target. */
  selected?: string[]
  at: number
}

/** Flechas de análisis (ephemeral) — para espectadores. */
export type MatchArrowsPayload = {
  type: 'match_arrows'
  matchId: string
  uid: string
  arrows: Array<{ startSquare: string; endSquare: string; color: string }>
  at: number
}

/** Emoji de espectador. Neon valida cooldown vía REST antes de publicar. */
export type SpectatorEmojiPayload = {
  type: 'spectator_emoji'
  matchId: string
  uid: string
  username?: string
  emoji: string
  /** Color del jugador al que va la reacción (lado del tablero). */
  targetColor: 'white' | 'black'
  /** id de la fila en Neon: dedupe exacto con la entrega por polling. */
  emojiId?: string
  at: number
}

export type MatchChannelPayload =
  | MatchDirtyPayload
  | MatchOverPayload
  | MatchBoardPayload
  | MatchClockPayload
  | PieceDragPayload
  | ShopReadyPayload
  | MatchEmotePayload
  | MatchJokerFxPayload
  | MatchJokerAimPayload
  | MatchArrowsPayload
  | SpectatorEmojiPayload
