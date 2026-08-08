import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'
import { LOOP_PHASES } from '@/lib/dimensions'

type Props = {
  kind: 'action' | 'rift' | null
}

export function PhaseFlash({ kind }: Props) {
  const info = kind === 'action' ? LOOP_PHASES.action : kind === 'rift' ? LOOP_PHASES.rift : null

  return (
    <AnimatePresence>
      {info ? (
        <motion.div
          key={info.key}
          className="pointer-events-none fixed inset-x-0 top-16 z-[115] flex justify-center px-4"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: easeOut }}
        >
          <div className="panel max-w-md px-5 py-3 text-center shadow-[0_16px_40px_rgba(27,28,25,0.12)]">
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">
              Ciclo · {info.title}
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{info.blurb}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
