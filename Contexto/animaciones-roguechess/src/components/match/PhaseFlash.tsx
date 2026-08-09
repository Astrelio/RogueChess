import { AnimatePresence, motion } from 'framer-motion'
import { easeOut, easeSnap } from '@/lib/motion'
import { LOOP_PHASES } from '@/lib/dimensions'

type Props = {
  kind: 'action' | 'rift' | 'shop' | null
}

const SHOP_COPY = {
  key: 'shop',
  eyebrow: 'Pausa · Mercado',
  title: 'Elige tus comodines',
  blurb: 'Tiempo es moneda. Escoge con cuidado — solo tres espacios en el inventario.',
} as const

export function PhaseFlash({ kind }: Props) {
  const info =
    kind === 'action'
      ? { ...LOOP_PHASES.action, eyebrow: 'Ciclo · Acción' }
      : kind === 'rift'
        ? { ...LOOP_PHASES.rift, eyebrow: 'Ciclo · Grieta' }
        : kind === 'shop'
          ? SHOP_COPY
          : null

  return (
    <AnimatePresence>
      {info ? (
        <motion.div
          key={info.key}
          className="rc-phase-flash-root pointer-events-none fixed inset-0 z-[115] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: easeOut }}
        >
          <motion.div
            className={`rc-phase-flash-veil rc-phase-flash-veil--${kind}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
          <motion.div
            className={`rc-phase-flash panel text-center !border-0 ${
              kind === 'rift'
                ? 'rc-phase-flash--rift'
                : kind === 'shop'
                  ? 'rc-phase-flash--shop'
                  : 'rc-phase-flash--action'
            }`}
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.48, ease: easeSnap }}
          >
            <motion.p
              className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]"
              initial={{ opacity: 0, letterSpacing: '0.08em' }}
              animate={{ opacity: 1, letterSpacing: '0.18em' }}
              transition={{ duration: 0.5, ease: easeOut }}
            >
              {info.eyebrow}
            </motion.p>
            <motion.h2
              className="rc-phase-flash-title font-display mt-2 text-[var(--color-ink)]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.4, ease: easeOut }}
            >
              {info.title}
            </motion.h2>
            <motion.p
              className="rc-phase-flash-blurb mt-2 text-[var(--color-ink-muted)]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.35 }}
            >
              {info.blurb}
            </motion.p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
