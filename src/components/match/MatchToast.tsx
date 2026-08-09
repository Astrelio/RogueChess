import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'
import { cn } from '@/lib/utils'

type ToastTone = 'error' | 'info' | 'aim'

type Props = {
  message: string | null
  tone?: ToastTone
  /** Contenido extra bajo el mensaje (p.ej. progreso de apuntado). */
  detail?: string | null
  onDismiss?: () => void
  actionLabel?: string
  className?: string
  /** Fondo oscuro + texto claro (dimensiones oscuras). */
  dark?: boolean
}

/**
 * Notificación flotante semi-transparente (errores, hints, apuntado de comodín).
 */
export function MatchToast({
  message,
  tone = 'info',
  detail,
  onDismiss,
  actionLabel = 'Cerrar',
  className,
  dark,
}: Props) {
  const isError = tone === 'error'

  return createPortal(
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          aria-live={isError ? 'assertive' : 'polite'}
          initial={
            isError
              ? { opacity: 0, y: -16, scale: 0.92 }
              : { opacity: 0, y: -12 }
          }
          animate={
            isError
              ? { opacity: 1, y: 0, scale: 1, x: [0, -5, 5, -3, 3, 0] }
              : { opacity: 1, y: 0 }
          }
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={
            isError
              ? { duration: 0.45, ease: easeOut, x: { duration: 0.4 } }
              : { duration: 0.25, ease: easeOut }
          }
          className={cn(
            'pointer-events-auto fixed left-1/2 top-4 z-[160] flex max-w-[min(92vw,440px)] -translate-x-1/2 items-start gap-3 rounded-md border px-4 py-3 backdrop-blur-md',
            isError
              ? 'border-[var(--color-error)]/70 bg-[color-mix(in_srgb,var(--color-error)_22%,#fff)] text-[var(--color-error)] shadow-[0_14px_44px_rgba(160,40,30,0.28)]'
              : dark
                ? 'border-white/20 bg-[color-mix(in_srgb,#12100e_88%,transparent)] text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
                : tone === 'aim'
                  ? 'border-[var(--color-primary)]/40 bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] text-[var(--color-primary)] shadow-[0_12px_40px_rgba(27,28,25,0.18)]'
                  : 'border-[var(--color-outline-soft)]/50 bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] text-[var(--color-ink)] shadow-[0_12px_40px_rgba(27,28,25,0.18)]',
            className,
          )}
        >
          {isError ? (
            <span
              aria-hidden
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-error)] font-display text-sm leading-none text-white"
            >
              !
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {isError ? (
              <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-error)]">
                Aviso
              </p>
            ) : null}
            <p
              className={cn(
                'leading-snug',
                isError ? 'mt-0.5 font-display text-base' : 'text-sm',
              )}
            >
              {message}
            </p>
            {detail ? (
              <p
                className={cn(
                  'mt-1 font-label text-[10px] uppercase tracking-[0.14em]',
                  dark ? 'text-white/65' : 'text-[var(--color-ink-muted)]',
                )}
              >
                {detail}
              </p>
            ) : null}
          </div>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                'shrink-0 font-label text-[10px] uppercase tracking-wider',
                dark
                  ? 'text-white/70 hover:text-white'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
              )}
            >
              {actionLabel}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
