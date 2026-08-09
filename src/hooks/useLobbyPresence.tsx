import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useChannel } from '@portalsdk/react'
import {
  lobbyChannelId,
  portalReady,
  type ChallengePayload,
  type LobbyPayload,
  type LookingPayload,
  type MatchReadyPayload,
  type RankingPulsePayload,
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
  challenge: (
    toUid: string,
    opts?: { message?: string; matchId?: string; toUsername?: string },
  ) => Promise<void>
  setMetadata: ((meta: Record<string, unknown>) => void) | undefined
  announceLooking: () => Promise<void>
  clearLooking: () => Promise<void>
  announceMatchReady: (matchId: string, uids: string[]) => Promise<void>
  setPlaying: (playing: boolean) => void
  announceRankingPulse: (reason?: string) => Promise<void>
  onMatchReady: (handler: (p: MatchReadyPayload) => void) => () => void
  onRankingPulse: (handler: (p: RankingPulsePayload) => void) => () => void
  onLooking: (handler: (p: LookingPayload) => void) => () => void
  incomingChallenges: Array<ChallengePayload & { messageId: string }>
  dismissChallenge: (messageId: string) => void
  isPeerOnline: (uidOrUsername: string) => boolean
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
  setPlaying: () => undefined,
  announceRankingPulse: async () => undefined,
  onMatchReady: () => () => undefined,
  onRankingPulse: () => () => undefined,
  onLooking: () => () => undefined,
  incomingChallenges: [],
  dismissChallenge: () => undefined,
  isPeerOnline: () => false,
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
  const rankingPulseHandlers = useRef(new Set<(p: RankingPulsePayload) => void>())
  const lookingHandlers = useRef(new Set<(p: LookingPayload) => void>())
  const playingRef = useRef(false)
  const selfRef = useRef<{ portalId?: string; uid?: string; username?: string }>({
    uid: user?.uid,
    username: profile?.username,
  })
  selfRef.current.uid = user?.uid
  selfRef.current.username = profile?.username

  const [incomingChallenges, setIncomingChallenges] = useState<
    Array<ChallengePayload & { messageId: string }>
  >([])

  const ingestChallenge = useCallback((c: ChallengePayload, messageId: string) => {
    const self = selfRef.current
    if (!self.uid && !self.username) return
    if (c.fromUid && c.fromUid === self.uid) return
    const forMe =
      (c.toUid && c.toUid === self.uid) ||
      (c.toUsername &&
        self.username &&
        c.toUsername.replace(/^@/, '').toLowerCase() === self.username.toLowerCase())
    if (!forMe) return
    setIncomingChallenges((cur) => {
      if (cur.some((x) => x.messageId === messageId || (c.matchId && x.matchId === c.matchId))) {
        return cur
      }
      return [...cur, { ...c, messageId }]
    })
  }, [])

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
            playing: false,
          }
        : { guest: true },
    [profile, user?.uid],
  )

  const { send, status, presence, setMetadata, me, messages } = useChannel<LobbyPayload>({
    channelId,
    history: 40,
    metadata,
    onMessage: (msg) => {
      const c = msg.content as LobbyPayload | undefined
      if (!c || typeof c !== 'object' || !('type' in c)) return
      if (c.type === 'challenge') {
        ingestChallenge(c, msg.id)
        return
      }
      if (c.type === 'match_ready') {
        for (const h of matchReadyHandlers.current) h(c)
      }
      if (c.type === 'ranking_pulse') {
        for (const h of rankingPulseHandlers.current) h(c)
      }
      if (c.type === 'looking') {
        for (const h of lookingHandlers.current) h(c)
      }
    },
  })

  selfRef.current.portalId = me?.id

  const statusRef = useRef(status)
  statusRef.current = status
  const sendRef = useRef(send)
  sendRef.current = send

  // Historia del canal (si el rival se conectó un instante después).
  useEffect(() => {
    for (const msg of messages) {
      const c = msg.content as LobbyPayload | undefined
      if (c && typeof c === 'object' && c.type === 'challenge') {
        ingestChallenge(c, msg.id)
      }
    }
  }, [messages, ingestChallenge])

  const onMatchReady = useCallback((handler: (p: MatchReadyPayload) => void) => {
    matchReadyHandlers.current.add(handler)
    return () => {
      matchReadyHandlers.current.delete(handler)
    }
  }, [])

  const onRankingPulse = useCallback((handler: (p: RankingPulsePayload) => void) => {
    rankingPulseHandlers.current.add(handler)
    return () => {
      rankingPulseHandlers.current.delete(handler)
    }
  }, [])

  const onLooking = useCallback((handler: (p: LookingPayload) => void) => {
    lookingHandlers.current.add(handler)
    return () => {
      lookingHandlers.current.delete(handler)
    }
  }, [])

  const dismissChallenge = useCallback((messageId: string) => {
    setIncomingChallenges((cur) => cur.filter((x) => x.messageId !== messageId))
  }, [])

  const participants =
    presence?.kind === 'detailed'
      ? presence.participants.map((p) => ({
          id: p.id,
          anon: p.anon,
          meta: p.metadata as Record<string, unknown> | undefined,
        }))
      : []

  function resolvePeerPortalId(toUid: string): string | null {
    const needle = toUid.trim().replace(/^@/, '')
    const hit = participants.find((p) => {
      if (p.anon) return false
      const metaUid = typeof p.meta?.uid === 'string' ? p.meta.uid : undefined
      const metaUser =
        typeof p.meta?.username === 'string' ? p.meta.username.replace(/^@/, '') : undefined
      return p.id === needle || metaUid === needle || metaUser === needle
    })
    return hit?.id ?? null
  }

  function isPeerOnline(uidOrUsername: string): boolean {
    return Boolean(resolvePeerPortalId(uidOrUsername))
  }

  async function waitLobbyReady(timeoutMs = 8000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (statusRef.current === 'ready') return
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('Lobby Portal no listo')
  }

  async function challenge(
    toUid: string,
    opts?: { message?: string; matchId?: string; toUsername?: string },
  ) {
    if (!profile || !user) throw new Error('Inicia sesión para retar')
    await waitLobbyReady()
    const targetUid = toUid.trim().replace(/^@/, '')
    const toUsername = opts?.toUsername?.trim().replace(/^@/, '')
    const payload: ChallengePayload = {
      type: 'challenge',
      title: `@${profile.username} te invita`,
      fromUsername: profile.username,
      fromUid: user.uid,
      toUid: targetUid,
      toUsername,
      message: opts?.message,
      matchId: opts?.matchId,
      at: Date.now(),
    }

    // 1) Broadcast persistente → todos en lobby:presence lo ven (onMessage + history).
    await sendRef.current({ type: 'challenge', content: payload })

    // 2) DM + mention → inbox Portal si el rival es miembro ahora.
    const peerId =
      resolvePeerPortalId(targetUid) ||
      (toUsername ? resolvePeerPortalId(toUsername) : null) ||
      targetUid
    try {
      await sendRef.current({
        type: 'challenge',
        content: payload,
        to: peerId,
        mentions: [{ userId: peerId }],
      })
    } catch {
      // El broadcast ya salió; el DM es opcional.
    }
  }

  function lobbyMeta(extra: Record<string, unknown>) {
    if (!profile || !user) return null
    return {
      username: profile.username,
      displayName: profile.display_name,
      mood: profile.mood_emoji,
      presence: profile.presence,
      uid: user.uid,
      searching: false,
      playing: playingRef.current,
      ...extra,
    }
  }

  async function announceLooking() {
    if (!profile || !user || !channelId) return
    playingRef.current = false
    setMetadata?.(lobbyMeta({ searching: true, playing: false, presence: 'online' })!)
    const payload: LookingPayload = {
      type: 'looking',
      uid: user.uid,
      username: profile.username,
      at: Date.now(),
    }
    await send({ ephemeral: true, content: payload })
    await send({
      ephemeral: true,
      content: { type: 'ranking_pulse', at: Date.now(), reason: 'looking' } satisfies RankingPulsePayload,
    })
  }

  async function clearLooking() {
    if (!profile || !user) return
    setMetadata?.(lobbyMeta({ searching: false })!)
    await send({
      ephemeral: true,
      content: { type: 'ranking_pulse', at: Date.now(), reason: 'clear_looking' } satisfies RankingPulsePayload,
    }).catch(() => undefined)
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
    await send({
      ephemeral: true,
      content: { type: 'ranking_pulse', at: Date.now(), reason: 'match_ready' } satisfies RankingPulsePayload,
    })
  }

  function setPlaying(playing: boolean) {
    if (!profile || !user) return
    playingRef.current = playing
    setMetadata?.(lobbyMeta({ playing, searching: false })!)
    void send({
      ephemeral: true,
      content: {
        type: 'ranking_pulse',
        at: Date.now(),
        reason: playing ? 'playing' : 'left_match',
      } satisfies RankingPulsePayload,
    }).catch(() => undefined)
  }

  async function announceRankingPulse(reason?: string) {
    if (!channelId) return
    await send({
      ephemeral: true,
      content: { type: 'ranking_pulse', at: Date.now(), reason } satisfies RankingPulsePayload,
    })
  }

  const onlineCount =
    presence?.kind === 'detailed'
      ? presence.count
      : presence?.kind === 'aggregate'
        ? presence.count
        : undefined

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
    setPlaying,
    announceRankingPulse,
    onMatchReady,
    onRankingPulse,
    onLooking,
    incomingChallenges,
    dismissChallenge,
    isPeerOnline,
  }
}
