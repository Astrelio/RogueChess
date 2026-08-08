import { AnimatePresence, motion } from 'framer-motion'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { usePortalInbox } from '@/hooks/usePortalInbox'
import { portalReady } from '@/lib/portal'

/** Solo montar bajo PortalProvider. */
export function PortalLiveChrome() {
  if (!portalReady) return null
  return <PortalLiveChromeInner />
}

function PortalLiveChromeInner() {
  const lobby = useLobbyPresence(true)
  const inbox = usePortalInbox()

  return (
    <>
      {typeof lobby.onlineCount === 'number' ? (
        <p className="pointer-events-none fixed bottom-3 left-3 z-40 font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
          Lobby · {lobby.onlineCount} en Portal
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
              <button
                type="button"
                className="mt-2 font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                onClick={() => inbox.dismiss(t.id)}
              >
                Cerrar
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
