import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { api } from '@/lib/api'

/** Crea partida waiting + envía reto Portal al firebase uid del rival. */
export function useChallengePlayer() {
  const { getToken, user } = useAuth()
  const lobby = useLobbyPresence()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function challengeUsername(username: string) {
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
      const { profile } = await api.getProfile(username)
      if (profile.firebase_uid === user.uid) {
        setError('No puedes retarte a ti mismo')
        return
      }
      const { match } = await api.createChallengeMatch(token)
      await lobby.challenge(profile.firebase_uid, {
        matchId: match.id,
        message: '¿Partida rápida en RogueChess?',
      })
      navigate(`/partida/${match.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el reto')
    } finally {
      setBusy(false)
    }
  }

  return { challengeUsername, busy, error, clearError: () => setError(null) }
}
