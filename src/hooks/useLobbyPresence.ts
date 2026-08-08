import { useMemo } from 'react'
import { useChannel } from '@portalsdk/react'
import { lobbyChannelId, portalReady, type ChallengePayload } from '@/lib/portal'
import { useAuth } from '@/auth/AuthContext'

/**
 * Presencia del lobby + retos dirigidos (inbox vía notify en portal.config).
 */
export function useLobbyPresence(enabled = true) {
  const { profile, user } = useAuth()
  const channelId = portalReady && enabled ? lobbyChannelId() : undefined

  const metadata = useMemo(
    () =>
      profile
        ? {
            username: profile.username,
            displayName: profile.display_name,
            mood: profile.mood_emoji,
            presence: profile.presence,
            uid: user?.uid,
          }
        : { guest: true },
    [profile, user?.uid],
  )

  const { send, status, presence, setMetadata, me } = useChannel<ChallengePayload>({
    channelId,
    history: 'none',
    metadata,
  })

  async function challenge(toUid: string, message?: string) {
    if (!profile || !user) throw new Error('Inicia sesión para retar')
    const payload: ChallengePayload = {
      type: 'challenge',
      title: `@${profile.username} te reta`,
      fromUsername: profile.username,
      fromUid: user.uid,
      message,
    }
    await send({
      content: payload,
      to: toUid,
      mentions: [{ userId: toUid }],
    })
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
          meta: p.metadata,
        }))
      : []

  return {
    ready: portalReady && Boolean(channelId) && status === 'ready',
    status,
    onlineCount,
    participants,
    me,
    challenge,
    setMetadata,
  }
}
