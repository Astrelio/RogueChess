import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { CustomMatchModal } from '@/components/CustomMatchModal'
import { PageTransition } from '@/components/PageTransition'
import { useMatchmaking } from '@/components/MatchmakingProvider'
import { LobbyTour } from '@/components/onboarding/LobbyTour'
import { api } from '@/lib/api'
import { hasSeenLobbyTour, START_LOBBY_TOUR_EVENT } from '@/lib/onboarding'
import { easeOut, riseItem, stagger } from '@/lib/motion'

const MASCOT_SRC = '/mascot/Bishop.webp'

export function LandingPage() {
  const { user, ready, getToken } = useAuth()
  const navigate = useNavigate()
  const matchmaking = useMatchmaking()
  const [customOpen, setCustomOpen] = useState(false)
  const [tutorialBusy, setTutorialBusy] = useState(false)
  const [showTour, setShowTour] = useState(false)

  // Tour de primer login: solo autenticados y una única vez.
  useEffect(() => {
    if (!ready || !user || hasSeenLobbyTour()) return
    const t = window.setTimeout(() => setShowTour(true), 900)
    return () => window.clearTimeout(t)
  }, [ready, user])

  // Desde Ajustes → «Tutorial de interfaz»
  useEffect(() => {
    function onStartTour() {
      setShowTour(true)
    }
    window.addEventListener(START_LOBBY_TOUR_EVENT, onStartTour)
    return () => window.removeEventListener(START_LOBBY_TOUR_EVENT, onStartTour)
  }, [])

  async function startTutorial() {
    if (tutorialBusy) return
    setTutorialBusy(true)
    try {
      const token = await getToken()
      if (!token) {
        navigate('/login')
        return
      }
      const { match } = await api.queueFallbackBot(token, { tutorial: true })
      navigate(`/partida/${match.id}?tutorial=1`)
    } catch (err) {
      console.error(err)
    } finally {
      setTutorialBusy(false)
    }
  }

  return (
    <PageTransition className="flex min-h-0 flex-1 flex-col justify-center">
      <CustomMatchModal open={customOpen} onClose={() => setCustomOpen(false)} />
      {showTour ? <LobbyTour onDone={() => setShowTour(false)} /> : null}
      <section className="relative grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] items-center gap-3 overflow-hidden sm:gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:grid-rows-1 lg:gap-6">
        <motion.div variants={stagger} initial="initial" animate="animate" className="relative z-10 max-w-xl">
          <motion.div
            variants={riseItem}
            className="mb-3 text-[var(--color-primary)] sm:mb-4"
            aria-label="RogueChess"
          >
            <svg viewBox="0 0 24 24" width="38" height="38" fill="currentColor" aria-hidden>
              <path d="M11 2h2v2h2v2h-2v1.05A5.5 5.5 0 0 1 17.5 12.5V15h-2.5v-2.5a3 3 0 0 0-6 0V15H6.5v-2.5A5.5 5.5 0 0 1 11 7.05V6H9V4h2V2z" />
              <path d="M7 16.5h10l.75 2.25H6.25L7 16.5z" />
              <path d="M5.5 19.5h13V21.5h-13v-2z" />
              <circle cx="12" cy="1.75" r="1.15" fill="var(--color-primary-container)" />
            </svg>
          </motion.div>
          <motion.h1
            variants={riseItem}
            className="font-display text-3xl leading-tight tracking-tight text-[var(--color-primary)] sm:text-5xl sm:leading-[1.15]"
          >
            El tablero cambia. El tiempo es tu moneda.
          </motion.h1>
          <motion.p
            variants={riseItem}
            className="mt-4 max-w-md text-sm leading-relaxed text-[var(--color-ink-muted)] sm:mt-5 sm:text-base"
          >
            Ajedrez con giros: dimensiones que cambian las reglas, comodines y un reloj que es tu moneda.
          </motion.p>

          <motion.div variants={riseItem} className="mt-5 flex flex-wrap gap-2.5 sm:mt-9 sm:gap-3">
            {!ready ? (
              <span className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                Cargando…
              </span>
            ) : user ? (
              <>
                <div data-tour="play" className="flex flex-wrap gap-3">
                  <motion.button
                    type="button"
                    disabled={matchmaking.busy}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void matchmaking.start()}
                    className="btn-primary disabled:opacity-50"
                  >
                    {matchmaking.busy ? 'Buscando…' : 'Partida rápida'}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCustomOpen(true)}
                    className="btn-ghost"
                  >
                    Partida personalizada
                  </motion.button>
                </div>
                <motion.button
                  type="button"
                  data-tour="tutorial"
                  disabled={tutorialBusy}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void startTutorial()}
                  className="btn-ghost !border-dashed disabled:opacity-50"
                >
                  {tutorialBusy ? 'Preparando…' : 'Tutorial'}
                </motion.button>
              </>
            ) : (
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link to="/login" className="btn-primary inline-block">
                  Entrar para jugar
                </Link>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          className="relative mx-auto flex h-full max-h-full min-h-0 w-full max-w-[680px] items-center justify-center lg:max-w-none lg:justify-end"
          initial={{ opacity: 0, x: 28, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.85, ease: easeOut, delay: 0.12 }}
        >
          <motion.img
            src={MASCOT_SRC}
            alt="Mascota de RogueChess"
            width={1696}
            height={2528}
            decoding="async"
            draggable={false}
            className="h-full max-h-[min(420px,40dvh)] w-full max-w-[800px] select-none object-contain object-center sm:max-h-[min(720px,78dvh)] lg:max-h-[min(880px,90dvh)]"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </section>
    </PageTransition>
  )
}
