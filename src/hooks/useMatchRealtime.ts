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
    at: Date.now(),
  }
}

/**
 * Canal Portal por partida.
 * Neon = autoridad; Portal = dirty + board + drag live + extensión.
 */
export function useMatchRealtime({
  matchId,
  enabled = true,
  metadata,
  onDirty,
  onBoardPulse,
  onPieceDrag,
}: Args) {
  const channelId = portalReady && enabled && matchId ? matchChannelId(matchId) : undefined
  const skipOwn = useRef<number | null>(null)
  const lastDragAt = useRef(0)
  const onDirtyRef = useRef(onDirty)
  const onBoardRef = useRef(onBoardPulse)
  const onDragRef = useRef(onPieceDrag)
  onDirtyRef.current = onDirty
  onBoardRef.current = onBoardPulse
  onDragRef.current = onPieceDrag

  const { send, status, presence, setMetadata, ext, me } = useChannel<
    MatchChannelPayload | MatchBoardSnapshot
  >({
    channelId,
    history: 8,
    metadata: metadata ?? { role: 'player', joinedAt: Date.now() },
    onMessage: (msg) => {
      if (msg.type === 'match.state.updated') {
        const board = msg.content as MatchBoardSnapshot
        if (!board?.fen) return
        // Mismo at que nuestro publish → eco de extensión; no reaplicar
        if (skipOwn.current !== null && board.at === skipOwn.current) return
        onBoardRef.current?.(board)
        return
      }

      const content = msg.content as MatchChannelPayload
      if (!content || typeof content !== 'object' || !('type' in content)) return

      if (content.type === 'piece_drag') {
        onDragRef.current?.(content)
        return
      }

      if (content.type === 'match_dirty') {
        if (skipOwn.current !== null && content.at === skipOwn.current) return
        onDirtyRef.current?.(content.reason)
        return
      }

      if (content.type === 'match_board') {
        if (skipOwn.current !== null && content.at === skipOwn.current) return
        onBoardRef.current?.(content)
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
    if (status !== 'ready') return
    const snap = ext?.matchState as MatchBoardSnapshot | undefined
    if (!snap?.fen) return
    if (skipOwn.current !== null && snap.at === skipOwn.current) return
    onBoardRef.current?.(snap)
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

      await send({
        content: { type: 'match_dirty', matchId: state.match.id, reason, at },
      })

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
      // Evitar eco propio que reescribe reloj/turno con un preview stale
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
      // Throttle moves; always send start/end (active flip / force)
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

  return {
    ready: portalReady && Boolean(channelId),
    status,
    presence,
    me,
    publishState,
    publishClocks,
    publishBoardPulse,
    publishPieceDrag,
  }
}
