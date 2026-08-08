import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useMatchRealtime } from '@/hooks/useMatchRealtime'
import { useAuth } from '@/auth/AuthContext'
import type {
  MatchBoardSnapshot,
  MatchEmotePayload,
  PieceDragPayload,
  ShopReadyPayload,
} from '@/lib/portal'
import type { MatchState } from '@/types/match'

type PublishFn = (state: MatchState, reason?: string) => Promise<void>
type PublishDragFn = (
  drag: Omit<PieceDragPayload, 'type' | 'at'> & { force?: boolean },
) => void
type PublishBoardFn = (
  state: MatchState,
  opts?: { preview?: boolean },
) => Promise<void>
type PublishShopReadyFn = (payload: {
  matchId: string
  uid: string
  color: 'white' | 'black'
  cycle_index: number
}) => Promise<void>
type PublishEmoteFn = (payload: { matchId: string; uid: string; emote: string }) => Promise<void>

export type MatchPortalPeerInfo = {
  status: string
  peerCount: number
  rivalOnline: boolean
  shoppingActivity: boolean
}

export function MatchPortalBridge({
  matchId,
  color,
  onDirty,
  onBoardPulse,
  onPieceDrag,
  onShopReady,
  onEmote,
  onChannelReady,
  onPeerInfo,
  publishRef,
  publishDragRef,
  publishBoardRef,
  publishShopReadyRef,
  publishEmoteRef,
  sendActivityRef,
}: {
  matchId: string
  color?: string
  onDirty: (reason: string) => void
  onBoardPulse: (board: MatchBoardSnapshot) => void
  onPieceDrag: (drag: PieceDragPayload) => void
  onShopReady?: (p: ShopReadyPayload) => void
  onEmote?: (p: MatchEmotePayload) => void
  onChannelReady?: () => void
  onPeerInfo?: (info: MatchPortalPeerInfo) => void
  publishRef: MutableRefObject<PublishFn | null>
  publishDragRef: MutableRefObject<PublishDragFn | null>
  publishBoardRef?: MutableRefObject<PublishBoardFn | null>
  publishShopReadyRef?: MutableRefObject<PublishShopReadyFn | null>
  publishEmoteRef?: MutableRefObject<PublishEmoteFn | null>
  sendActivityRef?: MutableRefObject<((kind: string) => void) | null>
}) {
  const { profile, user } = useAuth()
  const joinedAtRef = useRef(Date.now())

  const metadata = useMemo(
    () => ({
      role: 'player',
      color: color ?? null,
      username: profile?.username,
      uid: user?.uid,
      joinedAt: joinedAtRef.current,
    }),
    [color, profile?.username, user?.uid],
  )

  const {
    publishState,
    publishPieceDrag,
    publishBoardPulse,
    publishShopReady,
    publishEmote,
    sendActivity,
    presence,
    status,
    activity,
  } = useMatchRealtime({
    matchId,
    metadata,
    onDirty,
    onBoardPulse,
    onPieceDrag,
    onShopReady,
    onEmote,
    onChannelReady,
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
    if (!publishShopReadyRef) return
    publishShopReadyRef.current = publishShopReady
    return () => {
      publishShopReadyRef.current = null
    }
  }, [publishShopReady, publishShopReadyRef])

  useEffect(() => {
    if (!publishEmoteRef) return
    publishEmoteRef.current = publishEmote
    return () => {
      publishEmoteRef.current = null
    }
  }, [publishEmote, publishEmoteRef])

  useEffect(() => {
    if (!sendActivityRef) return
    sendActivityRef.current = sendActivity
    return () => {
      sendActivityRef.current = null
    }
  }, [sendActivity, sendActivityRef])

  useEffect(() => {
    const n =
      presence?.kind === 'detailed' || presence?.kind === 'aggregate' ? presence.count : 0
    document.documentElement.dataset.portalMatchPeers = String(n)
    const shoppingActivity = activity.some((a) => a.kind === 'shopping')
    onPeerInfo?.({
      status,
      peerCount: n,
      rivalOnline: n >= 2,
      shoppingActivity,
    })
  }, [presence, status, activity, onPeerInfo])

  return null
}
