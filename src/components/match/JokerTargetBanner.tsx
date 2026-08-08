import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'
import type { JokerTargetMode } from '@/lib/jokerTargets'

type Props = {
  open: boolean
  jokerName: string
  mode: JokerTargetMode
  selected: string[]
  onCancel: () => void
}

/**
 * Banner sobre el tablero mientras se eligen casillas para un comodín.
 */
export function JokerTargetBanner({ open, jokerName, mode, selected, onCancel }: Props) {
  const slot = mode.slots[Math.min(selected.length, Math.max(mode.slots.length - 1, 0))]
  const progress = `${Math.min(selected.length + 1, mode.slots.length)}/${mode.slots.length}`

  return (
    <AnimatePresence>
      {open && slot ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: easeOut }}
          className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-[var(--color-primary)]/35 bg-[color-mix(in_srgb,var(--color-surface)_92%,#fff)] px-4 py-3 shadow-sm"
        >
          <div className="min-w-0">
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">
              Apuntando · {jokerName} · {progress}
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink)]">{slot.hint}</p>
            {selected.length > 0 ? (
              <p className="mt-1 font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                Elegidas: {selected.join(' → ')}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onCancel} className="btn-ghost shrink-0 px-3 py-2 text-[10px]">
            Cancelar · Esc
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
