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
  at: number
  /** Preview optimista: solo FEN; no tocar relojes/turno. */
  preview?: boolean
}

/** Evento persistente: fuerza refetch REST (Neon = autoridad). */
export type MatchDirtyPayload = {
  type: 'match_dirty'
  matchId: string
  reason: string
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
  message?: string
}

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

export type MatchChannelPayload =
  | MatchDirtyPayload
  | MatchBoardPayload
  | MatchClockPayload
  | PieceDragPayload
