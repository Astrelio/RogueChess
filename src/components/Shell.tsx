import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { PortalLiveChrome } from '@/components/PortalLiveChrome'
import { UiSoundBridge } from '@/components/UiSoundBridge'
import { LobbyPresenceProvider } from '@/hooks/useLobbyPresence'
import {
  PortalInboxProvider,
  usePortalInbox,
  type PortalToast,
} from '@/hooks/usePortalInbox'
import { MatchmakingProvider, useMatchmaking } from '@/components/MatchmakingProvider'
import { SettingsModal } from '@/components/SettingsModal'
import { TOUR_MENU_EVENT } from '@/components/onboarding/LobbyTour'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { pageFade, easeOut } from '@/lib/motion'

export function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const isMatch = location.pathname.startsWith('/partida')
  const isGallery = location.pathname === '/comodines'
  /** Detalle /lab/:id — full-bleed como partida. Índice /lab usa shell normal. */
  const isLabDetail = location.pathname.startsWith('/lab/')

  return (
    <LobbyPresenceProvider>
      <PortalInboxProvider>
        <MatchmakingProvider>
          <ShellChrome
            isLanding={isLanding}
            isMatch={isMatch}
            isLabDetail={isLabDetail}
            isGallery={isGallery}
          >
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
  isLabDetail,
  isGallery,
}: {
  children: React.ReactNode
  isLanding: boolean
  isMatch: boolean
  isLabDetail: boolean
  isGallery: boolean
}) {
  const { user, getToken } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const matchmaking = useMatchmaking()
  const inbox = usePortalInbox()
  const immersive = isMatch || isLabDetail
  const fullViewport = isLanding || immersive
  const [acceptBusy, setAcceptBusy] = useState<string | null>(null)

  async function acceptInvite(toast: PortalToast) {
    if (!toast.matchId) return
    setAcceptBusy(toast.id)
    try {
      const token = await getToken()
      if (!token) {
        navigate('/login')
        return
      }
      await api.joinMatch(token, toast.matchId)
      toast.markAsRead?.()
      inbox.dismiss(toast.id)
      navigate(`/partida/${toast.matchId}`)
    } catch (err) {
      console.error(err)
    } finally {
      setAcceptBusy(null)
    }
  }

  return (
    <div
      className={cn(
        'relative overflow-x-hidden',
        immersive ? 'bg-black' : 'parchment',
        fullViewport ? 'flex h-dvh max-h-dvh flex-col overflow-hidden' : 'min-h-full',
      )}
    >
      <PortalLiveChrome />
      <UiSoundBridge />
      {!immersive ? (
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="relative z-40 shrink-0 border-b hairline bg-[color-mix(in_srgb,var(--color-surface)_80%,transparent)] backdrop-blur-md"
        >
          <div
            className={cn(
              'mx-auto flex items-center justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-8 sm:py-3',
              isGallery ? 'max-w-6xl' : 'max-w-5xl',
            )}
          >
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
              <div className="flex items-center gap-2 sm:gap-3">
                <InviteBell
                  invites={inbox.invites}
                  badge={inbox.badge}
                  acceptBusyId={acceptBusy}
                  onAccept={(t) => void acceptInvite(t)}
                  onDismiss={(id) => inbox.dismiss(id)}
                />
                <UserMenu
                  onPlay={() => {
                    void matchmaking.start()
                  }}
                  playBusy={matchmaking.busy}
                  inboxBadge={inbox.badge}
                  onClearInbox={() => inbox.markAllRead()}
                />
              </div>
            ) : (
              <GuestMenu />
            )}
          </div>
        </motion.header>
      ) : null}

      <main
        className={cn(
          'relative z-10 w-full',
          immersive
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : isGallery
              ? 'mx-auto max-w-6xl px-4 sm:px-8'
              : 'mx-auto max-w-5xl px-4 sm:px-8',
          immersive && 'px-3 pt-2 pb-[max(0.5rem,var(--rc-safe-bottom))] sm:px-5',
          isLanding && 'flex min-h-0 flex-1 flex-col justify-center overflow-hidden py-3 sm:py-4',
          !isLanding && !immersive && 'py-5 sm:py-8 lg:py-12',
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
                : immersive
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
    <div className="font-label flex items-center gap-2 text-xs uppercase tracking-[0.12em] sm:gap-4">
      <NavLink
        to="/comodines"
        className={({ isActive }) =>
          cn(
            'cursor-pointer rounded-sm px-1.5 py-1 transition',
            isActive
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-ink)]',
          )
        }
      >
        Comodines
      </NavLink>
      <NavLink
        to="/ranking"
        className={({ isActive }) =>
          cn(
            'cursor-pointer rounded-sm px-1.5 py-1 transition',
            isActive
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-ink)]',
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

function InviteBell({
  invites,
  badge,
  acceptBusyId,
  onAccept,
  onDismiss,
}: {
  invites: PortalToast[]
  badge: number
  acceptBusyId?: string | null
  onAccept: (t: PortalToast) => void
  onDismiss: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const count = Math.max(badge, invites.length)

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

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title={count > 0 ? `${count} invitación(es)` : 'Invitaciones'}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center border transition',
          open || count > 0
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
            : 'border-[var(--color-outline-soft)]/70 text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]/60 hover:text-[var(--color-ink)]',
        )}
      >
        <BellIcon className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1 font-label text-[9px] text-[var(--color-on-primary)]">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Invitaciones"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: easeOut }}
            className="panel absolute right-0 top-[calc(100%+10px)] z-[70] w-72 overflow-hidden border-[var(--color-outline-soft)]/60 bg-[color-mix(in_srgb,#fff_92%,transparent)] p-0 shadow-[0_16px_40px_rgba(115,92,0,0.14)] backdrop-blur-md"
          >
            <div className="border-b hairline px-3 py-2.5">
              <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">
                Invitaciones
              </p>
            </div>
            {invites.length === 0 ? (
              <p className="px-3 py-4 text-xs normal-case tracking-normal text-[var(--color-ink-muted)]">
                No tienes invitaciones. Si te retan estando en la app, aparecen aquí con Aceptar /
                Rechazar.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto px-3 py-2.5">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="border border-[var(--color-outline-soft)]/50 bg-[var(--color-surface)] px-2.5 py-2"
                  >
                    <p className="text-xs normal-case tracking-normal text-[var(--color-ink)]">
                      {inv.fromUsername ? (
                        <>
                          <span className="font-medium">@{inv.fromUsername}</span> te invita a jugar
                        </>
                      ) : (
                        inv.title
                      )}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={acceptBusyId === inv.id}
                        className="btn-primary !px-2.5 !py-1 text-[10px] disabled:opacity-50"
                        onClick={() => onAccept(inv)}
                      >
                        {acceptBusyId === inv.id ? 'Entrando…' : 'Aceptar'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1 text-[10px]"
                        onClick={() => onDismiss(inv.id)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const tourLockRef = useRef(false)
  const menuId = useId()

  const avatarUrl = profile?.avatar_url || user?.photoURL || null
  const initial = (profile?.username || profile?.display_name || user?.displayName || '?')
    .trim()
    .charAt(0)
    .toUpperCase()

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (tourLockRef.current) return
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (tourLockRef.current) return
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // El LobbyTour fuerza el menú abierto para señalar Ranking / Comodines.
  useEffect(() => {
    function onTourMenu(e: Event) {
      const wantOpen = Boolean((e as CustomEvent).detail)
      tourLockRef.current = wantOpen
      setOpen(wantOpen)
    }
    window.addEventListener(TOUR_MENU_EVENT, onTourMenu)
    return () => window.removeEventListener(TOUR_MENU_EVENT, onTourMenu)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div ref={rootRef} className="relative">
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <motion.button
        type="button"
        whileHover={{ y: -2, scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Menú de perfil"
        title="Menú · Comodines, ranking y más"
        data-tour="nav-profile"
        onClick={() => {
          setOpen((v) => !v)
          if (inboxBadge > 0) onClearInbox?.()
        }}
        className={cn(
          'group relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border transition',
          open
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-2 ring-[var(--color-primary-container)]/55 shadow-[0_0_0_3px_rgba(212,175,55,0.18)]'
            : 'border-[var(--color-outline-soft)]/70 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 hover:shadow-[0_0_0_3px_rgba(212,175,55,0.16)] hover:ring-2 hover:ring-[var(--color-primary-container)]/40',
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:brightness-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="font-display text-sm text-[var(--color-primary)] transition group-hover:scale-110">
            {initial}
          </span>
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
              <MenuLink to="/comodines" dataTour="nav-jokers" onNavigate={() => setOpen(false)}>
                Comodines
              </MenuLink>
              <MenuLink to="/ranking" dataTour="nav-ranking" onNavigate={() => setOpen(false)}>
                Ranking
              </MenuLink>
              <MenuLink to="/devs" onNavigate={() => setOpen(false)}>
                Equipo
              </MenuLink>
              <MenuLink to="/perfil" onNavigate={() => setOpen(false)}>
                Perfil
              </MenuLink>
              <MenuAction
                onClick={() => {
                  setOpen(false)
                  setSettingsOpen(true)
                }}
              >
                Ajustes
              </MenuAction>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full cursor-pointer px-3 py-2.5 text-left text-[var(--color-ink-muted)] transition hover:bg-[var(--color-primary)]/10 hover:pl-4 hover:text-[var(--color-ink)]"
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
  dataTour,
}: {
  to: string
  children: React.ReactNode
  onNavigate: () => void
  dataTour?: string
}) {
  return (
    <li>
      <NavLink
        to={to}
        role="menuitem"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'block cursor-pointer px-3 py-2.5 transition hover:bg-[var(--color-primary)]/10 hover:pl-4',
            isActive
              ? 'bg-[var(--color-primary)]/8 text-[var(--color-primary)]'
              : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
          )
        }
      >
        {/* data-tour en el texto: el spotlight encaja en la etiqueta, no en todo el ancho del menú */}
        <span data-tour={dataTour} className="inline-block">
          {children}
        </span>
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
        className="w-full cursor-pointer px-3 py-2.5 text-left text-[var(--color-primary)] transition hover:bg-[var(--color-primary)]/10 hover:pl-4 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {children}
      </button>
    </li>
  )
}
