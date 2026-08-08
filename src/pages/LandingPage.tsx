import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { PageTransition } from '@/components/PageTransition'
import { useMatchmaking } from '@/components/MatchmakingProvider'
import { easeOut, riseItem, stagger } from '@/lib/motion'

const MASCOT_SRC = '/mascot/Bishop.png'

export function LandingPage() {
  const { user, ready } = useAuth()
  const matchmaking = useMatchmaking()

  return (
    <PageTransition className="flex min-h-0 flex-1 flex-col justify-center">
      <section className="relative grid min-h-0 flex-1 items-center gap-4 overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-6">
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
            Ajedrez rogue-like: dimensiones, comodines y relojes que sangran ventaja.
          </motion.p>

          <motion.div variants={riseItem} className="mt-7 flex flex-wrap gap-3 sm:mt-9">
            {!ready ? (
              <span className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                Cargando…
              </span>
            ) : user ? (
              <>
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
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/ranking" className="btn-ghost inline-block">
                    Ranking
                  </Link>
                </motion.div>
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
          className="relative mx-auto flex h-full max-h-full w-full max-w-[680px] items-center justify-center lg:max-w-none lg:justify-end"
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
            className="h-auto max-h-[min(480px,58dvh)] w-full max-w-[800px] select-none object-contain object-center sm:max-h-[min(720px,78dvh)] lg:max-h-[min(880px,90dvh)]"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </section>
    </PageTransition>
  )
}
