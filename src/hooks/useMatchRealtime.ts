import { useCallback, useEffect, useRef } from 'react'
import { useChannel } from '@portalsdk/react'
import {
  matchChannelId,
  portalReady,
  type MatchBoardSnapshot,
  type MatchChannelPayload,
  type PieceDragPayload,
} from '@/lib/portal'
import type { MatchState } from '@/types/match'

type Args = {
  matchId: string | undefined
  enabled?: boolean
  metadata?: Record<string, unknown>
  onDirty?: (reason: string) => void
  onBoardPulse?: (board: MatchBoardSnapshot) => void
  onPieceDrag?: (drag: PieceDragPayload) => void
  onShopReady?: (p: import('@/lib/portal').ShopReadyPayload) => void
  onEmote?: (p: import('@/lib/portal').MatchEmotePayload) => void
  /** Canal listo / reconectado → refetch Neon (fin de partida, late-join). */
  onChannelReady?: () => void
}

function boardFromState(state: MatchState): MatchBoardSnapshot {
  const m = state.match
  return {
    matchId: m.id,
    fen: m.fen,
    white_time_ms: m.white_time_ms,
    black_time_ms: m.black_time_ms,
    turn_color: m.turn_color,
    clock_running_for: m.clock_running_for ?? null,
    status: m.status,
    phase: m.phase,
    cycle_index: m.cycle_index,
    moves_in_phase: m.moves_in_phase,
    result: m.result ?? null,
    winner_id: m.winner_id ?? null,
    at: Date.now(),
  }
}

/**
 * Canal Portal por partida.
 * Neon = autoridad; Portal = dirty + board + drag live + extensión + match_over.
 */
export function useMatchRealtime({
  matchId,
  enabled = true,
  metadata,
  onDirty,
  onBoardPulse,
  onPieceDrag,
  onShopReady,
  onEmote,
  onChannelReady,
}: Args) {
  const channelId = portalReady && enabled && matchId ? matchChannelId(matchId) : undefined
  const skipOwn = useRef<number | null>(null)
  const lastDragAt = useRef(0)
  const wasReady = useRef(false)
  const onDirtyRef = useRef(onDirty)
  const onBoardRef = useRef(onBoardPulse)
  const onDragRef = useRef(onPieceDrag)
  const onShopReadyRef = useRef(onShopReady)
  const onEmoteRef = useRef(onEmote)
  const onReadyRef = useRef(onChannelReady)
  onDirtyRef.current = onDirty
  onBoardRef.current = onBoardPulse
  onDragRef.current = onPieceDrag
  onShopReadyRef.current = onShopReady
  onEmoteRef.current = onEmote
  onReadyRef.current = onChannelReady

  const { send, status, presence, setMetadata, ext, me, activity, sendActivity } = useChannel<
    MatchChannelPayload | MatchBoardSnapshot
  >({
    channelId,
    history: 12,
    metadata: metadata ?? { role: 'player', joinedAt: Date.now() },
    onMessage: (msg) => {
      if (msg.type === 'match.state.updated') {
        const board = msg.content as MatchBoardSnapshot
        if (!board?.fen && board?.status !== 'finished') return
        if (skipOwn.current !== null && board.at === skipOwn.current) return
        onBoardRef.current?.(board)
        if (board.status === 'finished') {
          onDirtyRef.current?.('match_over_ext')
        }
        return
      }

      const content = msg.content as MatchChannelPayload
      if (!content || typeof content !== 'object' || !('type' in content)) return

      if (content.type === 'piece_drag') {
        onDragRef.current?.(content)
        return
      }

      if (content.type === 'shop_ready') {
        onShopReadyRef.current?.(content)
        return
      }

      if (content.type === 'match_emote') {
        onEmoteRef.current?.(content)
        return
      }

      if (content.type === 'match_dirty') {
        if (skipOwn.current !== null && content.at === skipOwn.current) return
        onDirtyRef.current?.(content.reason)
        return
      }

      if (content.type === 'match_over') {
        if (skipOwn.current !== null && content.at === skipOwn.current) return
        onBoardRef.current?.({
          matchId: content.matchId,
          fen: content.fen,
          white_time_ms: 0,
          black_time_ms: 0,
          turn_color: 'white',
          clock_running_for: null,
          status: 'finished',
          phase: '',
          cycle_index: 0,
          moves_in_phase: 0,
          result: content.result,
          winner_id: content.winner_id,
          at: content.at,
        })
        onDirtyRef.current?.('match_over')
        return
      }

      if (content.type === 'match_board') {
        if (skipOwn.current !== null && content.at === skipOwn.current) return
        onBoardRef.current?.(content)
        if (content.status === 'finished') {
          onDirtyRef.current?.('match_over_board')
        }
        return
      }

      if (content.type === 'match_clocks') {
        if (skipOwn.current !== null && content.at === skipOwn.current) return
        onBoardRef.current?.({
          matchId: content.matchId,
          fen: '',
          white_time_ms: content.white_time_ms,
          black_time_ms: content.black_time_ms,
          turn_color: content.turn_color,
          clock_running_for:
            content.clock_running_for !== undefined
              ? content.clock_running_for
              : (content.turn_color as 'white' | 'black'),
          status: '',
          phase: '',
          cycle_index: 0,
          moves_in_phase: 0,
          at: content.at,
        })
      }
    },
  })

  useEffect(() => {
    if (status !== 'ready') {
      wasReady.current = false
      return
    }
    const snap = ext?.matchState as MatchBoardSnapshot | undefined
    if (snap?.fen || snap?.status === 'finished') {
      if (skipOwn.current === null || snap.at !== skipOwn.current) {
        onBoardRef.current?.(snap)
        if (snap.status === 'finished') onDirtyRef.current?.('match_over_ext')
      }
    }
    // Primera vez ready o reconexión tras caída
    if (!wasReady.current) {
      wasReady.current = true
      onReadyRef.current?.()
    }
  }, [status, ext])

  useEffect(() => {
    if (!metadata || !setMetadata) return
    setMetadata(metadata)
  }, [metadata, setMetadata])

  const publishState = useCallback(
    async (state: MatchState, reason = 'update') => {
      if (!channelId) return
      const at = Date.now()
      skipOwn.current = at
      const board = { ...boardFromState(state), at }
      const finished = state.match.status === 'finished'

      // Tablero ephemeral PRIMERO / en paralelo: el rival ve FEN+turno sin
      // esperar el RTT del dirty persistente (antes dirty bloqueaba el board).
      const sends: Promise<unknown>[] = [
        send({
          ephemeral: true,
          content: { type: 'match_board', ...board },
        }),
        send({
          ephemeral: true,
          type: 'match.state.sync',
          content: board,
        }),
        send({
          content: {
            type: 'match_dirty',
            matchId: state.match.id,
            reason: finished ? reason || 'match_over' : reason,
            at,
          },
        }),
      ]

      if (finished) {
        sends.push(
          send({
            content: {
              type: 'match_over',
              matchId: state.match.id,
              status: 'finished',
              result: state.match.result ?? null,
              winner_id: state.match.winner_id ?? null,
              fen: state.match.fen,
              at,
            },
          }),
        )
      }

      await Promise.all(sends)
    },
    [channelId, send],
  )

  const publishClocks = useCallback(
    async (state: MatchState) => {
      if (!channelId) return
      const at = Date.now()
      skipOwn.current = at
      await send({
        ephemeral: true,
        content: {
          type: 'match_clocks',
          matchId: state.match.id,
          white_time_ms: state.match.white_time_ms,
          black_time_ms: state.match.black_time_ms,
          turn_color: state.match.turn_color,
          clock_running_for: state.match.clock_running_for ?? null,
          at,
        },
      })
    },
    [channelId, send],
  )

  /** Solo tablero ephemeral (p.ej. preview optimista) — sin dirty/refetch. */
  const publishBoardPulse = useCallback(
    async (state: MatchState, opts?: { preview?: boolean }) => {
      if (!channelId) return
      const at = Date.now()
      skipOwn.current = at
      const board = {
        ...boardFromState(state),
        at,
        ...(opts?.preview ? { preview: true as const } : {}),
      }
      await send({
        ephemeral: true,
        content: { type: 'match_board', ...board },
      })
      await send({
        ephemeral: true,
        type: 'match.state.sync',
        content: board,
      })
    },
    [channelId, send],
  )

  const publishPieceDrag = useCallback(
    (drag: Omit<PieceDragPayload, 'type' | 'at'> & { force?: boolean }) => {
      if (!channelId) return
      const now = Date.now()
      if (!drag.force && drag.active && now - lastDragAt.current < 40) return
      lastDragAt.current = now
      void send({
        ephemeral: true,
        content: {
          type: 'piece_drag',
          matchId: drag.matchId,
          from: drag.from,
          hover: drag.hover,
          piece: drag.piece,
          active: drag.active,
          uid: drag.uid,
          at: now,
        },
      })
    },
    [channelId, send],
  )

  const publishShopReady = useCallback(
    async (payload: { matchId: string; uid: string; color: 'white' | 'black'; cycle_index: number }) => {
      if (!channelId) return
      await send({
        ephemeral: true,
        content: {
          type: 'shop_ready',
          ...payload,
          at: Date.now(),
        },
      })
    },
    [channelId, send],
  )

  const publishEmote = useCallback(
    async (payload: { matchId: string; uid: string; emote: string }) => {
      if (!channelId) return
      await send({
        ephemeral: true,
        content: {
          type: 'match_emote',
          ...payload,
          at: Date.now(),
        },
      })
    },
    [channelId, send],
  )

  return {
    ready: portalReady && Boolean(channelId),
    status,
    presence,
    activity,
    me,
    sendActivity,
    publishState,
    publishClocks,
    publishBoardPulse,
    publishPieceDrag,
    publishShopReady,
    publishEmote,
  }
}
