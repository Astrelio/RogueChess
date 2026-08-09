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
import { useInbox } from '@portalsdk/react'
import { portalReady, type ChallengePayload } from '@/lib/portal'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'

export type PortalToast = {
  id: string
  title: string
  body?: string
  matchId?: string
  fromUsername?: string
  kind: 'challenge' | 'notice'
  markAsRead?: () => void
}

type PortalInboxApi = {
  ready: boolean
  badge: number
  invites: PortalToast[]
  toasts: PortalToast[]
  invitePulse: number
  dismiss: (id: string) => void
  markAllRead: () => void
}

const PortalInboxContext = createContext<PortalInboxApi | null>(null)

const stub: PortalInboxApi = {
  ready: false,
  badge: 0,
  invites: [],
  toasts: [],
  invitePulse: 0,
  dismiss: () => undefined,
  markAllRead: () => undefined,
}

function toastFromChallenge(
  id: string,
  data: Partial<ChallengePayload> & { message?: string },
  title?: string,
  markAsRead?: () => void,
): PortalToast {
  return {
    id,
    title: title ?? 'Invitación de partida',
    body:
      typeof data.message === 'string'
        ? data.message
        : data.fromUsername
          ? `@${data.fromUsername} te invita a jugar`
          : undefined,
    matchId: typeof data.matchId === 'string' ? data.matchId : undefined,
    fromUsername: typeof data.fromUsername === 'string' ? data.fromUsername : undefined,
    kind: 'challenge',
    markAsRead,
  }
}

export function PortalInboxProvider({ children }: { children: ReactNode }) {
  if (!portalReady) {
    return <PortalInboxContext.Provider value={stub}>{children}</PortalInboxContext.Provider>
  }
  return <PortalInboxLive>{children}</PortalInboxLive>
}

function PortalInboxLive({ children }: { children: ReactNode }) {
  const { getToken, user } = useAuth()
  const lobby = useLobbyPresence()
  const [toasts, setToasts] = useState<PortalToast[]>([])
  const [neonInvites, setNeonInvites] = useState<PortalToast[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [invitePulse, setInvitePulse] = useState(0)
  const seenRef = useRef<Set<string>>(new Set())

  const pushToast = useCallback((toast: PortalToast) => {
    if (seenRef.current.has(toast.id)) return
    seenRef.current.add(toast.id)
    setToasts((cur) => (cur.some((t) => t.id === toast.id) ? cur : [...cur, toast]))
    setInvitePulse((n) => n + 1)
  }, [])

  const { counter, status, markAllRead } = useInbox({
    onItem: (item) => {
      const data = (item.data ?? {}) as Partial<ChallengePayload> & { message?: string }
      const isChallenge =
        item.type === 'challenge' || data.type === 'challenge' || Boolean(data.matchId)
      if (!isChallenge || !data.matchId) return
      pushToast(toastFromChallenge(item.id, data, item.title ?? undefined, () => item.markAsRead()))
    },
  })

  useEffect(() => {
    for (const ch of lobby.incomingChallenges) {
      if (!ch.matchId || dismissed.has(ch.messageId)) continue
      pushToast(toastFromChallenge(ch.messageId, ch, ch.title))
    }
  }, [lobby.incomingChallenges, dismissed, pushToast])

  // Respaldo Neon: la bandeja se llena aunque Portal no empuje el WS.
  useEffect(() => {
    if (!user) {
      setNeonInvites([])
      return
    }
    let cancelled = false
    let failStreak = 0
    let timer: number | null = null

    async function pull() {
      try {
        const token = await getToken()
        if (!token || cancelled) return
        const { invites } = await api.getPendingInvites(token)
        if (cancelled) return
        failStreak = 0
        const mapped = invites
          .filter((inv) => !dismissed.has(`neon:${inv.invite_id}`))
          .map((inv) =>
            toastFromChallenge(
              `neon:${inv.invite_id}`,
              {
                type: 'challenge',
                fromUsername: inv.from_username,
                fromUid: inv.from_uid,
                toUid: user!.uid,
                matchId: inv.match_id,
                title: `@${inv.from_username} te invita`,
              },
              `@${inv.from_username} te invita`,
            ),
          )
        setNeonInvites((prev) => {
          const prevIds = prev.map((p) => p.id).join('|')
          const nextIds = mapped.map((p) => p.id).join('|')
          if (prevIds !== nextIds) {
            for (const t of mapped) {
              if (!seenRef.current.has(t.id)) {
                seenRef.current.add(t.id)
                setToasts((cur) => (cur.some((x) => x.id === t.id) ? cur : [...cur, t]))
                setInvitePulse((n) => n + 1)
              }
            }
          }
          return mapped
        })
      } catch {
        failStreak = Math.min(failStreak + 1, 6)
      } finally {
        if (!cancelled) {
          const delay = failStreak === 0 ? 12_000 : Math.min(60_000, 12_000 * 2 ** failStreak)
          timer = window.setTimeout(() => void pull(), delay)
        }
      }
    }

    void pull()
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [user, getToken, dismissed])

  const invites = useMemo(() => {
    const byMatch = new Map<string, PortalToast>()
    const add = (t: PortalToast) => {
      if (dismissed.has(t.id) || !t.matchId) return
      if (!byMatch.has(t.matchId)) byMatch.set(t.matchId, t)
    }
    for (const ch of lobby.incomingChallenges) {
      if (ch.matchId) add(toastFromChallenge(ch.messageId, ch, ch.title))
    }
    for (const t of neonInvites) add(t)
    for (const t of toasts) add(t)
    return [...byMatch.values()]
  }, [lobby.incomingChallenges, neonInvites, toasts, dismissed])

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set(prev).add(id))
      setToasts((cur) => cur.filter((t) => t.id !== id))
      lobby.dismissChallenge(id)
      setNeonInvites((cur) => cur.filter((t) => t.id !== id))
    },
    [lobby],
  )

  const visibleToasts = useMemo(
    () => toasts.filter((t) => !dismissed.has(t.id)),
    [toasts, dismissed],
  )

  const value: PortalInboxApi = {
    ready: status === 'ready' || lobby.ready,
    badge: Math.max(counter, invites.length),
    invites,
    toasts: visibleToasts,
    invitePulse,
    dismiss,
    markAllRead,
  }

  return <PortalInboxContext.Provider value={value}>{children}</PortalInboxContext.Provider>
}

export function usePortalInbox(): PortalInboxApi {
  const ctx = useContext(PortalInboxContext)
  if (!ctx) throw new Error('usePortalInbox dentro de PortalInboxProvider')
  return ctx
}
