import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { jokerArtUrl } from '@/lib/jokerArt'
import { easeOut } from '@/lib/motion'

type Props = {
  open: boolean
  code: string
  name: string
}

/**
 * Destello corto al consumir un comodín sin apuntado (Axio, Giratiempo, etc.).
 */
export function InstantJokerFx({ open, code, name }: Props) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[125] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-live="polite"
        >
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 55% 45% at 50% 48%, rgba(212,175,55,0.22), transparent 70%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.55, 0] }}
            transition={{ duration: 0.95, times: [0, 0.2, 0.55, 1], ease: easeOut }}
          />

          <div className="relative flex flex-col items-center gap-3">
            <motion.div
              className="relative overflow-hidden rounded-sm border border-[var(--color-gold)]/50 shadow-[0_12px_40px_rgba(115,92,0,0.25)]"
              style={{ width: 88, height: Math.round(88 * 1.4) }}
              initial={{ opacity: 0, scale: 0.72, y: 16, rotate: -4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.72, 1.06, 1, 0.94], y: [16, 0, 0, -8] }}
              transition={{ duration: 0.95, times: [0, 0.22, 0.65, 1], ease: easeOut }}
            >
              <img
                src={jokerArtUrl(code)}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(115deg, transparent 30%, rgba(255,224,136,0.55) 50%, transparent 70%)',
                }}
                initial={{ x: '-120%' }}
                animate={{ x: '140%' }}
                transition={{ duration: 0.55, delay: 0.12, ease: easeOut }}
              />
            </motion.div>

            <motion.p
              className="font-display text-2xl text-[var(--color-primary)] drop-shadow-sm sm:text-3xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6] }}
              transition={{ duration: 0.95, times: [0, 0.2, 0.65, 1], ease: easeOut }}
            >
              {name}
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
