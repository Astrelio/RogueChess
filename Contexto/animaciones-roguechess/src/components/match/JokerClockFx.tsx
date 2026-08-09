import { AnimatePresence, motion } from 'framer-motion'
import { getJokerFxSpec } from '@/lib/jokerFx'

export type ClockFxEvent = {
  code: 'axio_tempus' | 'arresto_momentum' | 'petrificus_totalus' | string
  at: number
  /** Reloj propio (abajo si blancas / según UI). */
  youSide: 'top' | 'bottom'
}

type Props = {
  event: ClockFxEvent | null
}

/**
 * FX Tempus en HUD de reloj: Axio roba, Petrificus congela, Arresto acelera rival.
 */
export function JokerClockFx({ event }: Props) {
  if (!event) return null
  const spec = getJokerFxSpec(event.code)
  const youIsBottom = event.youSide === 'bottom'
  // Rival = lado opuesto al tuyo
  const rivalSide = youIsBottom ? 'top' : 'bottom'
  const youSide = event.youSide

  return (
    <AnimatePresence>
      {event.code === 'axio_tempus' ? (
        <motion.div
          key={`axio-${event.at}`}
          className="rc-clock-fx rc-clock-fx--steal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          aria-hidden
        >
          <motion.div
            className={`rc-clock-fx-chip rc-clock-fx-chip--${rivalSide} rc-clock-fx-chip--loss`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: youIsBottom ? [0, 8, 40, 70] : [0, -8, -40, -70] }}
            transition={{ duration: spec.durationMs / 1000, ease: 'easeInOut' }}
          >
            <span className="rc-clock-fx-face">
              <span className="rc-clock-fx-hand rc-clock-fx-hand--rev" />
            </span>
            <span>−10s</span>
          </motion.div>
          <motion.div
            className={`rc-clock-fx-chip rc-clock-fx-chip--${youSide} rc-clock-fx-chip--gain`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.7, 0.7, 1.1, 1, 0.95] }}
            transition={{ duration: spec.durationMs / 1000, times: [0, 0.35, 0.55, 0.8, 1] }}
          >
            <span className="rc-clock-fx-face">
              <span className="rc-clock-fx-hand" />
            </span>
            <span>+10s</span>
          </motion.div>
          <motion.p
            className="rc-clock-fx-banner"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4] }}
            transition={{ duration: spec.durationMs / 1000 }}
          >
            Axio Tempus · tiempo robado
          </motion.p>
        </motion.div>
      ) : null}

      {event.code === 'petrificus_totalus' ? (
        <motion.div
          key={`petri-${event.at}`}
          className="rc-clock-fx rc-clock-fx--freeze"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden
        >
          <motion.div
            className={`rc-clock-fx-chip rc-clock-fx-chip--${youSide} rc-clock-fx-chip--ice`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1.05, 1, 1] }}
            transition={{ duration: spec.durationMs / 1000 }}
          >
            <span className="rc-clock-fx-face rc-clock-fx-face--ice">
              <span className="rc-clock-fx-frost" />
            </span>
            <span>❚❚</span>
          </motion.div>
          <motion.p
            className="rc-clock-fx-banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: spec.durationMs / 1000 }}
          >
            Petrificus · tu reloj se detiene
          </motion.p>
        </motion.div>
      ) : null}

      {event.code === 'arresto_momentum' ? (
        <motion.div
          key={`arresto-${event.at}`}
          className="rc-clock-fx rc-clock-fx--haste"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden
        >
          <motion.div
            className={`rc-clock-fx-chip rc-clock-fx-chip--${rivalSide} rc-clock-fx-chip--haste`}
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: [0, 1, 1, 0], rotate: [0, 420] }}
            transition={{ duration: spec.durationMs / 1000, ease: 'easeInOut' }}
          >
            <span className="rc-clock-fx-face">
              <span className="rc-clock-fx-hand rc-clock-fx-hand--fast" />
            </span>
            <span>×2</span>
          </motion.div>
          <motion.p
            className="rc-clock-fx-banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: spec.durationMs / 1000 }}
          >
            Arresto Momentum · rival ×2
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
