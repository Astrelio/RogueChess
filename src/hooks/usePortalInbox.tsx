import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useInbox } from '@portalsdk/react'
import { portalReady, type ChallengePayload } from '@/lib/portal'

export type PortalToast = {
  id: string
  title: string
  body?: string
  matchId?: string
  fromUsername?: string
  kind: 'challenge' | 'notice'
}

type PortalInboxApi = {
  ready: boolean
  badge: number
  toasts: PortalToast[]
  dismiss: (id: string) => void
  markAllRead: () => void
}

const PortalInboxContext = createContext<PortalInboxApi | null>(null)

const stub: PortalInboxApi = {
  ready: false,
  badge: 0,
  toasts: [],
  dismiss: () => undefined,
  markAllRead: () => undefined,
}

export function PortalInboxProvider({ children }: { children: ReactNode }) {
  if (!portalReady) {
    return <PortalInboxContext.Provider value={stub}>{children}</PortalInboxContext.Provider>
  }
  return <PortalInboxLive>{children}</PortalInboxLive>
}

function PortalInboxLive({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<PortalToast[]>([])

  const { counter, status, markAllRead } = useInbox({
    onItem: (item) => {
      const data = (item.data ?? {}) as Partial<ChallengePayload> & { message?: string }
      const isChallenge = data.type === 'challenge' || Boolean(data.matchId && data.fromUsername)
      setToasts((cur) => [
        ...cur,
        {
          id: item.id,
          title: item.title ?? (isChallenge ? 'Reto Portal' : item.type),
          body:
            typeof data.message === 'string'
              ? data.message
              : data.fromUsername
                ? `@${data.fromUsername} te desafía`
                : undefined,
          matchId: typeof data.matchId === 'string' ? data.matchId : undefined,
          fromUsername: typeof data.fromUsername === 'string' ? data.fromUsername : undefined,
          kind: isChallenge ? 'challenge' : 'notice',
        },
      ])
    },
  })

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id))
  }, [])

  const value: PortalInboxApi = {
    ready: status === 'ready',
    badge: counter,
    toasts,
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
