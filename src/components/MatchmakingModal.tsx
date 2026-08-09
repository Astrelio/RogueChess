import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { easeOut } from '@/lib/motion'

export type MatchmakingPhase = 'searching' | 'found' | 'error'

export type MatchmakingModalProps = {
  open: boolean
  phase: MatchmakingPhase
  elapsedMs: number
  estimatedMs: number
  error?: string | null
  vsBot?: boolean
  peersSearching?: number
  onClose?: () => void
}

function formatTimer(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

/**
 * Overlay de emparejamiento: blur + timer + “partida encontrada”.
 */
export function MatchmakingModal({
  open,
  phase,
  elapsedMs,
  estimatedMs,
  error,
  vsBot,
  peersSearching = 0,
  onClose,
}: MatchmakingModalProps) {
  const progress = Math.min(1, elapsedMs / Math.max(estimatedMs, 1))

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_45%,transparent)] backdrop-blur-[12px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="matchmaking-title"
            className="panel relative z-10 w-full max-w-md overflow-hidden border-[var(--color-outline-soft)]/55 bg-[color-mix(in_srgb,#fff_90%,transparent)] p-8 shadow-[0_24px_60px_rgba(115,92,0,0.14)]"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <AnimatePresence mode="wait">
              {phase === 'searching' || phase === 'error' ? (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="text-center"
                >
                  <p className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
                    Buscando partida
                  </p>
                  <h2
                    id="matchmaking-title"
                    className="font-display mt-2 text-3xl text-[var(--color-primary)]"
                  >
                    Buscando rival
                  </h2>
                  <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                    {peersSearching > 0
                      ? `${peersSearching} jugador${peersSearching === 1 ? '' : 'es'} buscando ahora`
                      : `Explorando el lobby… espera ~${Math.ceil(estimatedMs / 1000)}s; si no hay nadie, juegas contra RogueBot`}
                  </p>

                  <motion.p
                    key={Math.floor(elapsedMs / 1000)}
                    className="font-display mt-8 text-5xl tabular-nums text-[var(--color-ink)]"
                    initial={{ opacity: 0.7, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {formatTimer(elapsedMs)}
                  </motion.p>

                  <div className="mx-auto mt-6 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-[var(--color-surface-high)]">
                    <motion.div
                      className="h-full rounded-full bg-[var(--color-primary-container)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(8, progress * 100)}%` }}
                      transition={{ duration: 0.35, ease: easeOut }}
                    />
                  </div>

                  <div className="mt-8 flex justify-center gap-2" aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-[var(--color-primary)]"
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -4, 0] }}
                        transition={{
                          duration: 1.1,
                          repeat: Infinity,
                          delay: i * 0.18,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                  </div>

                  {phase === 'error' && error ? (
                    <div className="mt-6 space-y-3">
                      <p className="text-sm text-[var(--color-error)]">{error}</p>
                      {onClose ? (
                        <button type="button" className="btn-ghost" onClick={onClose}>
                          Cerrar
                        </button>
                      ) : null}
                    </div>
                  ) : onClose ? (
                    <button type="button" className="btn-ghost mt-8" onClick={onClose}>
                      Cancelar
                    </button>
                  ) : null}
                </motion.div>
              ) : (
                <motion.div
                  key="found"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: easeOut }}
                  className="text-center"
                >
                  <motion.div
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--color-primary-container)] bg-[color-mix(in_srgb,var(--color-primary-fixed)_55%,transparent)]"
                    initial={{ scale: 0.4, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  >
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--color-primary)" aria-hidden>
                      <path d="M11 2h2v2h2v2h-2v1.05A5.5 5.5 0 0 1 17.5 12.5V15h-2.5v-2.5a3 3 0 0 0-6 0V15H6.5v-2.5A5.5 5.5 0 0 1 11 7.05V6H9V4h2V2z" />
                      <path d="M7 16.5h10l.75 2.25H6.25L7 16.5z" />
                      <path d="M5.5 19.5h13V21.5h-13v-2z" />
                    </svg>
                  </motion.div>
                  <motion.p
                    className="font-label mt-5 text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    {vsBot ? 'Práctica' : 'Grieta abierta'}
                  </motion.p>
                  <motion.h2
                    className="font-display mt-2 text-3xl text-[var(--color-primary)] sm:text-4xl"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22, duration: 0.4, ease: easeOut }}
                  >
                    {vsBot ? '¡RogueBot listo!' : '¡Partida encontrada!'}
                  </motion.h2>
                  <motion.p
                    className="mt-3 text-sm text-[var(--color-ink-muted)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {vsBot
                      ? 'Nadie en cola — empezando contra el bot…'
                      : 'Rival encontrado — entrando al tablero…'}
                  </motion.p>
                  <motion.div
                    className="mx-auto mt-8 h-px w-24 origin-center bg-[var(--color-primary-container)]"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.35, duration: 0.5, ease: easeOut }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

const FOUND_HOLD_MS = 1800
const POLL_MS = 900
const HUMAN_WAIT_MS = 15000

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function freshEstimate() {
  return HUMAN_WAIT_MS
}

/** Cola Neon + señales Portal; si no hay rival en ~15s → bot. */
export function useQuickMatchFlow(opts: {
  getToken: () => Promise<string | null>
  onEnter: (matchId: string) => void
  onNeedLogin: () => void
}) {
  const { user } = useAuth()
  const lobby = useLobbyPresence()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<MatchmakingPhase>('searching')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [estimatedMs, setEstimatedMs] = useState(freshEstimate)
  const [error, setError] = useState<string | null>(null)
  const [vsBot, setVsBot] = useState(false)
  const [busy, setBusy] = useState(false)
  const tickRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const cancelledRef = useRef(false)
  const searchingRef = useRef(false)
  const resolvedIdRef = useRef<string | null>(null)
  const wakeRef = useRef<(() => void) | null>(null)

  function stopTick() {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }

  function wakeWait() {
    wakeRef.current?.()
    wakeRef.current = null
  }

  function waitPoll(ms: number) {
    return new Promise<void>((resolve) => {
      const t = window.setTimeout(() => {
        if (wakeRef.current === resolve) wakeRef.current = null
        resolve()
      }, ms)
      wakeRef.current = () => {
        window.clearTimeout(t)
        wakeRef.current = null
        resolve()
      }
    })
  }

  async function cleanupQueue(token: string | null) {
    searchingRef.current = false
    await lobby.clearLooking().catch(() => undefined)
    if (token) await api.cancelQueue(token).catch(() => undefined)
  }

  function close() {
    cancelledRef.current = true
    wakeWait()
    stopTick()
    void (async () => {
      const token = await opts.getToken().catch(() => null)
      await cleanupQueue(token)
    })()
    setOpen(false)
    setBusy(false)
    setPhase('searching')
    setError(null)
    setElapsedMs(0)
    setVsBot(false)
  }

  async function finishFound(matchId: string, bot: boolean) {
    if (cancelledRef.current) return
    searchingRef.current = false
    stopTick()
    setElapsedMs(Date.now() - startRef.current)
    setVsBot(bot)
    setPhase('found')
    await lobby.clearLooking().catch(() => undefined)
    await sleep(FOUND_HOLD_MS)
    if (cancelledRef.current) return
    setOpen(false)
    setBusy(false)
    opts.onEnter(matchId)
  }

  async function start() {
    if (busy) return
    cancelledRef.current = false
    searchingRef.current = true
    resolvedIdRef.current = null
    setBusy(true)
    setError(null)
    setPhase('searching')
    setVsBot(false)
    setElapsedMs(0)
    setEstimatedMs(freshEstimate())
    setOpen(true)
    startRef.current = Date.now()
    stopTick()
    tickRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startRef.current)
    }, 200)

    try {
      const token = await opts.getToken()
      if (!token) {
        stopTick()
        setOpen(false)
        setBusy(false)
        searchingRef.current = false
        opts.onNeedLogin()
        return
      }

      await lobby.announceLooking().catch(() => undefined)

      const enq = await api.enqueueMatch(token, 300)
      if (cancelledRef.current) return

      if (enq.queue.status === 'matched' && enq.queue.matched_match_id) {
        const matchId = String(enq.queue.matched_match_id)
        await lobby
          .announceMatchReady(matchId, user?.uid ? [user.uid] : [])
          .catch(() => undefined)
        const left = Math.max(0, 2200 - (Date.now() - startRef.current))
        if (left) await sleep(left)
        await finishFound(matchId, false)
        return
      }

      const unsub = lobby.onMatchReady(() => {
        if (!searchingRef.current || cancelledRef.current) return
        void api
          .getQueue(token)
          .then((st) => {
            if (st.queue?.status === 'matched' && st.queue.matched_match_id) {
              resolvedIdRef.current = String(st.queue.matched_match_id)
              wakeWait()
            }
          })
          .catch(() => undefined)
      })

      const deadline = Date.now() + HUMAN_WAIT_MS
      while (!cancelledRef.current && !resolvedIdRef.current && Date.now() < deadline) {
        await waitPoll(POLL_MS)
        if (cancelledRef.current || resolvedIdRef.current) break
        try {
          const st = await api.getQueue(token)
          if (st.queue?.status === 'matched' && st.queue.matched_match_id) {
            resolvedIdRef.current = String(st.queue.matched_match_id)
            break
          }
        } catch {
          // seguir
        }
      }
      unsub()

      if (cancelledRef.current) return

      const resolvedId = resolvedIdRef.current
      if (resolvedId) {
        await finishFound(resolvedId, false)
        return
      }

      const bot = await api.queueFallbackBot(token)
      if (cancelledRef.current) return
      await finishFound(String(bot.match.id), true)
    } catch (err) {
      stopTick()
      searchingRef.current = false
      await lobby.clearLooking().catch(() => undefined)
      setPhase('error')
      setError(err instanceof Error ? err.message : 'No se pudo emparejar')
      setBusy(false)
    }
  }

  useEffect(() => () => stopTick(), [])

  const peersSearching = lobby.searchingPeers.filter((p) => p.meta?.uid !== user?.uid).length

  return {
    busy,
    start,
    close,
    modalProps: {
      open,
      phase,
      elapsedMs,
      estimatedMs,
      error,
      vsBot,
      peersSearching,
      onClose: close,
    } satisfies MatchmakingModalProps,
  }
}
