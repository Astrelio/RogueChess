import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { PortalLiveChrome } from '@/components/PortalLiveChrome'
import { LobbyPresenceProvider } from '@/hooks/useLobbyPresence'
import { PortalInboxProvider, usePortalInbox } from '@/hooks/usePortalInbox'
import { MatchmakingProvider, useMatchmaking } from '@/components/MatchmakingProvider'
import { cn } from '@/lib/utils'
import { pageFade, easeOut } from '@/lib/motion'

export function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const isMatch = location.pathname.startsWith('/partida')

  return (
    <LobbyPresenceProvider>
      <PortalInboxProvider>
        <MatchmakingProvider>
          <ShellChrome isLanding={isLanding} isMatch={isMatch}>
            {children}
          </ShellChrome>
        </MatchmakingProvider>
      </PortalInboxProvider>
    </LobbyPresenceProvider>
  )
}

function ShellChrome({
  children,
  isLanding,
  isMatch,
}: {
  children: React.ReactNode
  isLanding: boolean
  isMatch: boolean
}) {
  const { user } = useAuth()
  const location = useLocation()
  const matchmaking = useMatchmaking()
  const inbox = usePortalInbox()
  const fullViewport = isLanding || isMatch

  return (
    <div
      className={cn(
        'parchment relative overflow-x-hidden',
        fullViewport ? 'flex h-dvh max-h-dvh flex-col overflow-hidden' : 'min-h-full',
      )}
    >
      <PortalLiveChrome />
      {!isMatch ? (
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="relative z-40 shrink-0 border-b hairline bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
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
            {user ? (
              <UserMenu
                onPlay={() => {
                  void matchmaking.start()
                }}
                playBusy={matchmaking.busy}
                inboxBadge={inbox.badge}
                onClearInbox={() => inbox.markAllRead()}
              />
            ) : (
              <GuestMenu />
            )}
          </div>
        </motion.header>
      ) : null}

      <main
        className={cn(
          'relative z-10 w-full',
          isMatch
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 sm:px-5'
            : 'mx-auto max-w-5xl px-4 sm:px-8',
          isLanding && 'flex min-h-0 flex-1 flex-col justify-center overflow-hidden py-3 sm:py-4',
          !isLanding && !isMatch && 'py-8 sm:py-12',
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageFade}
            initial="initial"
            animate="animate"
            exit="exit"
            className={
              isLanding
                ? 'flex min-h-0 flex-1 flex-col justify-center'
                : isMatch
                  ? 'flex min-h-0 flex-1 flex-col'
                  : undefined
            }
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function GuestMenu() {
  return (
    <div className="font-label flex items-center gap-4 text-xs uppercase tracking-[0.12em]">
      <NavLink
        to="/ranking"
        className={({ isActive }) =>
          cn(
            'transition-colors',
            isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
          )
        }
      >
        Ranking
      </NavLink>
      <Link to="/login" className="btn-primary !px-4 !py-2 text-[10px]">
        Entrar
      </Link>
    </div>
  )
}

function UserMenu({
  onPlay,
  playBusy,
  inboxBadge = 0,
  onClearInbox,
}: {
  onPlay: () => void
  playBusy?: boolean
  inboxBadge?: number
  onClearInbox?: () => void
}) {
  const { profile, user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const avatarUrl = profile?.avatar_url || user?.photoURL || null
  const initial = (profile?.username || profile?.display_name || user?.displayName || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((v) => !v)
          if (inboxBadge > 0) onClearInbox?.()
        }}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition',
          open
            ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-container)]/50'
            : 'border-[var(--color-outline-soft)]/70 hover:border-[var(--color-primary)]/60',
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="font-display text-sm text-[var(--color-primary)]">{initial}</span>
        )}
        {inboxBadge > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 font-label text-[9px] text-[var(--color-on-primary)]">
            {inboxBadge > 9 ? '9+' : inboxBadge}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: easeOut }}
            className="panel absolute right-0 top-[calc(100%+10px)] z-[60] w-56 overflow-hidden border-[var(--color-outline-soft)]/60 bg-[color-mix(in_srgb,#fff_88%,transparent)] p-0 shadow-[0_16px_40px_rgba(115,92,0,0.12)] backdrop-blur-md"
          >
            <div className="border-b hairline px-3 py-3">
              <p className="font-display text-base text-[var(--color-primary)] truncate">
                {profile?.display_name || user?.displayName || 'Jugador'}
              </p>
              <p className="font-label mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)] truncate">
                @{profile?.username ?? '…'}
              </p>
            </div>
            <ul className="font-label py-1 text-[11px] uppercase tracking-[0.14em]">
              <MenuAction
                disabled={playBusy}
                onClick={() => {
                  setOpen(false)
                  onPlay()
                }}
              >
                {playBusy ? 'Buscando…' : 'Jugar'}
              </MenuAction>
              <MenuLink to="/ranking" onNavigate={() => setOpen(false)}>
                Ranking
              </MenuLink>
              <MenuLink to="/devs" onNavigate={() => setOpen(false)}>
                Devs
              </MenuLink>
              <MenuLink to="/perfil" onNavigate={() => setOpen(false)}>
                Perfil
              </MenuLink>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2.5 text-left text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface-low)] hover:text-[var(--color-ink)]"
                  onClick={() => {
                    setOpen(false)
                    void logout()
                  }}
                >
                  Salir
                </button>
              </li>
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function MenuLink({
  to,
  children,
  onNavigate,
}: {
  to: string
  children: React.ReactNode
  onNavigate: () => void
}) {
  return (
    <li>
      <NavLink
        to={to}
        role="menuitem"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'block px-3 py-2.5 transition hover:bg-[var(--color-surface-low)]',
            isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
          )
        }
      >
        {children}
      </NavLink>
    </li>
  )
}

function MenuAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={onClick}
        className="w-full px-3 py-2.5 text-left text-[var(--color-primary)] transition hover:bg-[var(--color-surface-low)] disabled:opacity-50"
      >
        {children}
      </button>
    </li>
  )
}
