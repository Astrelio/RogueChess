import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { cn, presenceLabel } from '@/lib/utils'
import { pageFade, easeOut } from '@/lib/motion'

export function Shell({ children }: { children: React.ReactNode }) {
  const { profile, logout, user } = useAuth()
  const location = useLocation()

  return (
    <div className="parchment relative min-h-full overflow-x-hidden">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeOut }}
        className="relative z-10 border-b hairline bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/" className="group relative">
            <span className="font-display text-lg tracking-tight text-[var(--color-primary)] sm:text-xl">
              RogueChess
            </span>
            <motion.span
              layoutId="brand-underline"
              className="absolute -bottom-1 left-0 h-px w-full origin-left bg-[var(--color-primary-container)]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.35, duration: 0.5, ease: easeOut }}
            />
          </Link>
          <nav className="font-label flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.12em] sm:gap-6">
            <NavItem to="/ranking">Ranking</NavItem>
            <NavItem to="/devs">Devs</NavItem>
            {user ? (
              <>
                <NavItem to="/perfil">Perfil</NavItem>
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => void logout()}
                  className="text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
                >
                  Salir
                </motion.button>
              </>
            ) : (
              <NavItem to="/login">Entrar</NavItem>
            )}
          </nav>
        </div>
        <AnimatePresence>
          {profile ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pb-3 font-label text-[11px] uppercase tracking-wider text-[var(--color-ink-muted)] sm:px-8">
                <span
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    profile.presence === 'offline' ? 'bg-[var(--color-outline)]' : 'bg-[var(--color-online)]',
                  )}
                />
                <span>@{profile.username}</span>
                <span className="text-[var(--color-outline-soft)]">·</span>
                <span>{presenceLabel(profile.presence)}</span>
                {(profile.mood_emoji || profile.mood_text) && (
                  <>
                    <span className="text-[var(--color-outline-soft)]">·</span>
                    <span className="normal-case tracking-normal text-[var(--color-ink)]">
                      {profile.mood_emoji} {profile.mood_text}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageFade}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} className="relative py-1">
      {({ isActive }) => (
        <motion.span
          whileHover={{ y: -1 }}
          className={cn(
            'inline-block transition-colors',
            isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
          )}
        >
          {children}
          {isActive ? (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-x-0 -bottom-0.5 h-px bg-[var(--color-primary-container)]"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          ) : null}
        </motion.span>
      )}
    </NavLink>
  )
}
