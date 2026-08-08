import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageTransition } from '@/components/PageTransition'
import { easeOut, riseItem, stagger } from '@/lib/motion'

export function LandingPage() {
  const { user, ready } = useAuth()

  return (
    <PageTransition>
      <section className="relative flex min-h-[calc(100vh-9rem)] flex-col justify-center overflow-hidden py-6">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-8 top-8 hidden h-72 w-72 sm:block"
          initial={{ opacity: 0, rotate: -6 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ duration: 0.9, ease: easeOut }}
        >
          <div
            className="h-full w-full rounded-sm border border-[var(--color-outline-soft)]/50"
            style={{
              backgroundImage:
                'linear-gradient(45deg, transparent 46%, rgba(115,92,0,0.06) 46%, rgba(115,92,0,0.06) 54%, transparent 54%), linear-gradient(-45deg, transparent 46%, rgba(212,175,55,0.08) 46%, rgba(212,175,55,0.08) 54%, transparent 54%)',
              backgroundSize: '36px 36px',
            }}
          />
          <motion.div
            className="absolute inset-6 rounded-sm border border-[var(--color-primary)]/20"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.div variants={stagger} initial="initial" animate="animate" className="relative max-w-xl">
          <motion.p
            variants={riseItem}
            className="font-label mb-4 text-xs uppercase tracking-[0.28em] text-[var(--color-primary)]"
          >
            RogueChess
          </motion.p>
          <motion.h1
            variants={riseItem}
            className="font-display text-3xl leading-tight tracking-tight text-[var(--color-primary)] sm:text-5xl sm:leading-[1.15]"
          >
            El tablero cambia. El tiempo es tu moneda.
          </motion.h1>
          <motion.p variants={riseItem} className="mt-5 max-w-md text-base leading-relaxed text-[var(--color-ink-muted)]">
            Ajedrez rogue-like: dimensiones, comodines y relojes que sangran ventaja.
          </motion.p>

          <motion.div variants={riseItem} className="mt-9 flex flex-wrap gap-3">
            {!ready ? (
              <span className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                Cargando…
              </span>
            ) : user ? (
              <>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/ranking" className="btn-primary inline-block">
                    Ver ranking
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/perfil" className="btn-ghost inline-block">
                    Mi perfil
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
      </section>
    </PageTransition>
  )
}
