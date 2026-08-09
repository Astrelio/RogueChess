import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'

/** Se registra como espectador en Neon y navega a la partida en modo lectura. */
export function useSpectateMatch() {
  const { getToken, user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** @param cheerUsername jugador al que se anima (reacciones en su lado del tablero) */
  async function spectate(matchId: string, cheerUsername?: string) {
    if (!user) {
      navigate('/login')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) {
        navigate('/login')
        return
      }
      await api.spectateMatch(token, matchId)
      const q = cheerUsername ? `?cheer=${encodeURIComponent(cheerUsername)}` : ''
      navigate(`/partida/${matchId}${q}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo espectar la partida')
    } finally {
      setBusy(false)
    }
  }

  return { spectate, busy, error, clearError: () => setError(null) }
}
