import { useEffect, useMemo } from 'react'
import type { MutableRefObject } from 'react'
import { useMatchRealtime } from '@/hooks/useMatchRealtime'
import { useAuth } from '@/auth/AuthContext'
import type { MatchBoardSnapshot, PieceDragPayload } from '@/lib/portal'
import type { MatchState } from '@/types/match'

type PublishFn = (state: MatchState, reason?: string) => Promise<void>
type PublishDragFn = (
  drag: Omit<PieceDragPayload, 'type' | 'at'> & { force?: boolean },
) => void
type PublishBoardFn = (
  state: MatchState,
  opts?: { preview?: boolean },
) => Promise<void>

export function MatchPortalBridge({
  matchId,
  color,
  onDirty,
  onBoardPulse,
  onPieceDrag,
  publishRef,
  publishDragRef,
  publishBoardRef,
}: {
  matchId: string
  color?: string
  onDirty: (reason: string) => void
  onBoardPulse: (board: MatchBoardSnapshot) => void
  onPieceDrag: (drag: PieceDragPayload) => void
  publishRef: MutableRefObject<PublishFn | null>
  publishDragRef: MutableRefObject<PublishDragFn | null>
  publishBoardRef?: MutableRefObject<PublishBoardFn | null>
}) {
  const { profile, user } = useAuth()

  const metadata = useMemo(
    () => ({
      role: 'player',
      color: color ?? null,
      username: profile?.username,
      uid: user?.uid,
      joinedAt: Date.now(),
    }),
    [color, profile?.username, user?.uid],
  )

  const { publishState, publishPieceDrag, publishBoardPulse, presence, status } = useMatchRealtime({
    matchId,
    metadata,
    onDirty,
    onBoardPulse,
    onPieceDrag,
  })

  useEffect(() => {
    publishRef.current = publishState
    return () => {
      publishRef.current = null
    }
  }, [publishState, publishRef])

  useEffect(() => {
    publishDragRef.current = publishPieceDrag
    return () => {
      publishDragRef.current = null
    }
  }, [publishPieceDrag, publishDragRef])

  useEffect(() => {
    if (!publishBoardRef) return
    publishBoardRef.current = publishBoardPulse
    return () => {
      publishBoardRef.current = null
    }
  }, [publishBoardPulse, publishBoardRef])

  useEffect(() => {
    if (status !== 'ready') return
    const n =
      presence?.kind === 'detailed' || presence?.kind === 'aggregate' ? presence.count : 0
    document.documentElement.dataset.portalMatchPeers = String(n)
  }, [presence, status])

  return null
}
