import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  resultLabel: string
  youWon: boolean
  onExit: () => void
  onRematch?: () => void
}

export function VictoryOverlay({ open, title, subtitle, resultLabel, youWon, onExit, onRematch }: Props) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_50%,transparent)] backdrop-blur-[12px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md overflow-hidden border border-[var(--color-outline-soft)]/50 bg-[color-mix(in_srgb,var(--color-surface)_95%,#fff)] px-8 py-10 text-center shadow-[0_28px_80px_rgba(27,28,25,0.3)]"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.45, ease: easeOut }}
          >
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: youWon
                  ? 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.28), transparent 55%)'
                  : 'radial-gradient(ellipse at 50% 0%, rgba(115,92,0,0.12), transparent 55%)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.6 }}
            />

            <motion.p
              className="font-label relative text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              {resultLabel}
            </motion.p>

            <motion.h2
              className="font-display relative mt-3 text-4xl text-[var(--color-primary)] sm:text-5xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45, ease: easeOut }}
            >
              {title}
            </motion.h2>

            {subtitle ? (
              <motion.p
                className="relative mt-4 text-sm leading-relaxed text-[var(--color-ink-muted)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28 }}
              >
                {subtitle}
              </motion.p>
            ) : null}

            <motion.div
              className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              {onRematch ? (
                <button type="button" onClick={onRematch} className="btn-primary">
                  Otra partida
                </button>
              ) : null}
              <button type="button" onClick={onExit} className={onRematch ? 'btn-ghost' : 'btn-primary'}>
                Volver al lobby
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
