import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'

type Props = {
  open: boolean
  cycleIndex?: number
  /** Duración total visible antes de llamar onDone (ms). */
  durationMs?: number
  dark?: boolean
  onDone: () => void
}

/**
 * Intersticial corto al abrir el mercado: “Elige tus comodines”.
 */
export function ShopIntroOverlay({
  open,
  cycleIndex,
  durationMs = 1400,
  dark,
  onDone,
}: Props) {
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(onDone, durationMs)
    return () => window.clearTimeout(t)
  }, [open, durationMs, onDone])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[128] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: easeOut }}
          role="presentation"
        >
          <motion.div
            aria-hidden
            className={
              dark
                ? 'absolute inset-0 bg-[color-mix(in_srgb,#050403_75%,transparent)] backdrop-blur-[10px]'
                : 'absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_42%,transparent)] backdrop-blur-[10px]'
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(212,175,55,0.2), transparent 65%)',
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: easeOut }}
          />

          <div className="relative z-10 text-center">
            <motion.p
              className={
                dark
                  ? 'font-label text-[10px] uppercase tracking-[0.28em] text-[#e9c349]'
                  : 'font-label text-[10px] uppercase tracking-[0.28em] text-[var(--color-primary-bright)]'
              }
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: easeOut }}
            >
              {typeof cycleIndex === 'number' ? `Mercado · ciclo ${cycleIndex}` : 'Mercado'}
            </motion.p>
            <motion.h2
              className={
                dark
                  ? 'font-display mt-3 text-4xl text-[#f7f3ea] sm:text-5xl'
                  : 'font-display mt-3 text-4xl text-[var(--color-primary-fixed)] sm:text-5xl'
              }
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.5, delay: 0.06, ease: easeOut }}
            >
              Elige tus comodines
            </motion.h2>
            <motion.div
              aria-hidden
              className="mx-auto mt-5 h-px w-24 origin-center bg-[var(--color-gold)]/70"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: easeOut }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
