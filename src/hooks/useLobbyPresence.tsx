import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useChannel } from '@portalsdk/react'
import {
  lobbyChannelId,
  portalReady,
  type ChallengePayload,
  type LobbyPayload,
  type LookingPayload,
  type MatchReadyPayload,
} from '@/lib/portal'
import { useAuth } from '@/auth/AuthContext'

export type LobbyPresenceApi = {
  ready: boolean
  status: string | undefined
  onlineCount: number | undefined
  participants: Array<{
    id: string
    anon: boolean
    meta: Record<string, unknown> | undefined
  }>
  searchingPeers: Array<{
    id: string
    anon: boolean
    meta: Record<string, unknown> | undefined
  }>
  me: { id: string } | null | undefined
  challenge: (toUid: string, opts?: { message?: string; matchId?: string }) => Promise<void>
  setMetadata: ((meta: Record<string, unknown>) => void) | undefined
  announceLooking: () => Promise<void>
  clearLooking: () => Promise<void>
  announceMatchReady: (matchId: string, uids: string[]) => Promise<void>
  onMatchReady: (handler: (p: MatchReadyPayload) => void) => () => void
}

const LobbyPresenceContext = createContext<LobbyPresenceApi | null>(null)

const stub: LobbyPresenceApi = {
  ready: false,
  status: undefined,
  onlineCount: undefined,
  participants: [],
  searchingPeers: [],
  me: null,
  challenge: async () => {
    throw new Error('Portal no configurado')
  },
  setMetadata: undefined,
  announceLooking: async () => undefined,
  clearLooking: async () => undefined,
  announceMatchReady: async () => undefined,
  onMatchReady: () => () => undefined,
}

/**
 * Una sola suscripción a `lobby:presence` (evitar N× useChannel en Shell/Landing/Chrome).
 */
export function LobbyPresenceProvider({ children }: { children: ReactNode }) {
  if (!portalReady) {
    return <LobbyPresenceContext.Provider value={stub}>{children}</LobbyPresenceContext.Provider>
  }
  return <LobbyPresenceLive>{children}</LobbyPresenceLive>
}

function LobbyPresenceLive({ children }: { children: ReactNode }) {
  const value = useLobbyPresenceState()
  return <LobbyPresenceContext.Provider value={value}>{children}</LobbyPresenceContext.Provider>
}

export function useLobbyPresence(): LobbyPresenceApi {
  const ctx = useContext(LobbyPresenceContext)
  if (!ctx) {
    throw new Error('useLobbyPresence debe usarse dentro de LobbyPresenceProvider')
  }
  return ctx
}

function useLobbyPresenceState(): LobbyPresenceApi {
  const { profile, user } = useAuth()
  const channelId = lobbyChannelId()
  const matchReadyHandlers = useRef(new Set<(p: MatchReadyPayload) => void>())

  const metadata = useMemo(
    () =>
      profile
        ? {
            username: profile.username,
            displayName: profile.display_name,
            mood: profile.mood_emoji,
            presence: profile.presence,
            uid: user?.uid,
            searching: false,
          }
        : { guest: true },
    [profile, user?.uid],
  )

  const { send, status, presence, setMetadata, me } = useChannel<LobbyPayload>({
    channelId,
    history: 4,
    metadata,
    onMessage: (msg) => {
      const c = msg.content as LobbyPayload | undefined
      if (!c || typeof c !== 'object' || !('type' in c)) return
      if (c.type === 'match_ready') {
        for (const h of matchReadyHandlers.current) h(c)
      }
    },
  })

  const onMatchReady = useCallback((handler: (p: MatchReadyPayload) => void) => {
    matchReadyHandlers.current.add(handler)
    return () => {
      matchReadyHandlers.current.delete(handler)
    }
  }, [])

  async function challenge(toUid: string, opts?: { message?: string; matchId?: string }) {
    if (!profile || !user) throw new Error('Inicia sesión para retar')
    const payload: ChallengePayload = {
      type: 'challenge',
      title: `@${profile.username} te reta`,
      fromUsername: profile.username,
      fromUid: user.uid,
      message: opts?.message,
      matchId: opts?.matchId,
    }
    await send({
      content: payload,
      to: toUid,
      mentions: [{ userId: toUid }],
    })
  }

  async function announceLooking() {
    if (!profile || !user || !channelId) return
    setMetadata?.({
      username: profile.username,
      displayName: profile.display_name,
      mood: profile.mood_emoji,
      presence: 'online',
      uid: user.uid,
      searching: true,
    })
    const payload: LookingPayload = {
      type: 'looking',
      uid: user.uid,
      username: profile.username,
      at: Date.now(),
    }
    await send({ ephemeral: true, content: payload })
  }

  async function clearLooking() {
    if (!profile || !user) return
    setMetadata?.({
      username: profile.username,
      displayName: profile.display_name,
      mood: profile.mood_emoji,
      presence: profile.presence,
      uid: user.uid,
      searching: false,
    })
  }

  async function announceMatchReady(matchId: string, uids: string[]) {
    if (!channelId) return
    const payload: MatchReadyPayload = {
      type: 'match_ready',
      matchId,
      uids,
      at: Date.now(),
    }
    await send({ ephemeral: true, content: payload })
  }

  const onlineCount =
    presence?.kind === 'detailed'
      ? presence.count
      : presence?.kind === 'aggregate'
        ? presence.count
        : undefined

  const participants =
    presence?.kind === 'detailed'
      ? presence.participants.map((p) => ({
          id: p.id,
          anon: p.anon,
          meta: p.metadata as Record<string, unknown> | undefined,
        }))
      : []

  const searchingPeers = participants.filter((p) => p.meta?.searching === true)

  return {
    ready: Boolean(channelId) && status === 'ready',
    status,
    onlineCount,
    participants,
    searchingPeers,
    me: me ? { id: me.id } : null,
    challenge,
    setMetadata: setMetadata as ((meta: Record<string, unknown>) => void) | undefined,
    announceLooking,
    clearLooking,
    announceMatchReady,
    onMatchReady,
  }
}
