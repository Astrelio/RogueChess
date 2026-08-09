import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { api } from '@/lib/api'

export type CustomMatchOpts = {
  timeControlS?: number
  allowSpectators?: boolean
  inviteUsername?: string
}

/** Crea sala personalizada (código) y opcionalmente invita por Portal + Neon. */
export function useCustomMatch() {
  const { getToken, user } = useAuth()
  const lobby = useLobbyPresence()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createRoom(opts: CustomMatchOpts = {}) {
    if (!user) {
      navigate('/login')
      return null
    }
    setBusy(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) {
        navigate('/login')
        return null
      }

      const inviteUsername = opts.inviteUsername?.trim().replace(/^@/, '')
      if (inviteUsername) {
        const { profile } = await api.getProfile(inviteUsername)
        if (profile.firebase_uid === user.uid) {
          setError('No puedes invitarte a ti mismo')
          return null
        }
        const { match } = await api.createCustomMatch(token, {
          timeControlS: opts.timeControlS,
          allowSpectators: opts.allowSpectators,
          inviteUsername,
        })
        try {
          await lobby.challenge(profile.firebase_uid, {
            matchId: match.id,
            toUsername: inviteUsername,
            message: '¿Partida personalizada en RogueChess?',
          })
        } catch (inviteErr) {
          console.warn('No se pudo enviar invite Portal', inviteErr)
        }
        navigate(`/partida/${match.id}`, {
          state: { invitedUsername: inviteUsername, inviteSent: true },
        })
        return match
      }

      const { match } = await api.createCustomMatch(token, {
        timeControlS: opts.timeControlS,
        allowSpectators: opts.allowSpectators,
      })
      navigate(`/partida/${match.id}`)
      return match
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la sala')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function joinByCode(code: string) {
    if (!user) {
      navigate('/login')
      return null
    }
    setBusy(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) {
        navigate('/login')
        return null
      }
      const { match } = await api.joinMatchByCode(token, code.trim())
      navigate(`/partida/${match.id}`)
      return match
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o sala llena')
      return null
    } finally {
      setBusy(false)
    }
  }

  return { createRoom, joinByCode, busy, error, clearError: () => setError(null) }
}
