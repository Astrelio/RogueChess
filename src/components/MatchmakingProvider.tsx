import { createContext, useContext, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { MatchmakingModal, useQuickMatchFlow } from '@/components/MatchmakingModal'

type MatchmakingApi = {
  busy: boolean
  start: () => Promise<void>
  close: () => void
}

const MatchmakingContext = createContext<MatchmakingApi | null>(null)

/** Un solo flujo de cola + un modal (Landing y menú comparten). */
export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const flow = useQuickMatchFlow({
    getToken,
    onEnter: (matchId) => navigate(`/partida/${matchId}`),
    onNeedLogin: () => navigate('/login'),
  })

  return (
    <MatchmakingContext.Provider value={{ busy: flow.busy, start: flow.start, close: flow.close }}>
      <MatchmakingModal {...flow.modalProps} />
      {children}
    </MatchmakingContext.Provider>
  )
}

export function useMatchmaking(): MatchmakingApi {
  const ctx = useContext(MatchmakingContext)
  if (!ctx) throw new Error('useMatchmaking debe usarse dentro de MatchmakingProvider')
  return ctx
}
