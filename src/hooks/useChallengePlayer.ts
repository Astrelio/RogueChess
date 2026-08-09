import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { api } from '@/lib/api'

/** Crea partida custom + invita (Portal lobby + fila Neon para bandeja). */
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
      const clean = username.replace(/^@/, '')
      const { profile } = await api.getProfile(clean)
      if (profile.firebase_uid === user.uid) {
        setError('No puedes retarte a ti mismo')
        return
      }
      const { match } = await api.createChallengeMatch(token, {
        timeControlS: 300,
        allowSpectators: true,
        mode: 'custom',
        inviteUsername: clean,
      })
      try {
        await lobby.challenge(profile.firebase_uid, {
          matchId: match.id,
          toUsername: clean,
          message: '¿Partida personalizada en RogueChess?',
        })
      } catch (inviteErr) {
        console.warn('No se pudo enviar invite Portal', inviteErr)
      }
      navigate(`/partida/${match.id}`, {
        state: { invitedUsername: clean, inviteSent: true },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el reto')
    } finally {
      setBusy(false)
    }
  }

  return { challengeUsername, busy, error, clearError: () => setError(null) }
}
