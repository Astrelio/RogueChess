import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { usePortalInbox } from '@/hooks/usePortalInbox'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { portalReady } from '@/lib/portal'

/** Solo montar bajo PortalProvider + providers de lobby/inbox. */
export function PortalLiveChrome() {
  if (!portalReady) return null
  return <PortalLiveChromeInner />
}

function PortalLiveChromeInner() {
  const lobby = useLobbyPresence()
  const inbox = usePortalInbox()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function acceptChallenge(toastId: string, matchId: string) {
    setBusyId(toastId)
    try {
      const token = await getToken()
      if (!token) {
        navigate('/login')
        return
      }
      await api.joinMatch(token, matchId)
      inbox.dismiss(toastId)
      inbox.markAllRead()
      navigate(`/partida/${matchId}`)
    } catch (err) {
      console.error(err)
    } finally {
      setBusyId(null)
    }
  }

  const searching = lobby.searchingPeers.length

  return (
    <>
      {typeof lobby.onlineCount === 'number' ? (
        <p className="pointer-events-none fixed bottom-3 left-3 z-40 font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
          Lobby Portal · {lobby.onlineCount}
          {searching > 0 ? ` · ${searching} buscando` : ''}
          {lobby.ready ? '' : ' · …'}
        </p>
      ) : null}

      <div className="pointer-events-none fixed bottom-3 right-3 z-50 flex max-w-xs flex-col gap-2">
        <AnimatePresence>
          {inbox.toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="pointer-events-auto border border-[var(--color-outline-soft)] bg-[var(--color-surface)] px-3 py-2 shadow-sm"
            >
              <p className="font-label text-[10px] uppercase tracking-wider text-[var(--color-primary)]">
                {t.title}
              </p>
              {t.body ? <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{t.body}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                {t.kind === 'challenge' && t.matchId ? (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    className="font-label text-[10px] uppercase tracking-wider text-[var(--color-primary)] hover:underline disabled:opacity-50"
                    onClick={() => void acceptChallenge(t.id, t.matchId!)}
                  >
                    {busyId === t.id ? 'Entrando…' : 'Aceptar'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  onClick={() => inbox.dismiss(t.id)}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
