import { AnimatePresence, motion } from 'framer-motion'
import { getJokerFxSpec } from '@/lib/jokerFx'

export type ClockFxEvent = {
  code: 'axio_tempus' | 'arresto_momentum' | 'petrificus_totalus' | string
  at: number
  /** Reloj propio (abajo en UI rival-arriba / tú-abajo). */
  youSide: 'top' | 'bottom'
}

type Props = {
  event: ClockFxEvent | null
}

/**
 * FX Tempus en HUD de reloj: Axio roba, Petrificus congela, Arresto acelera rival.
 * AnimatePresence envuelve el evento para permitir exit limpio.
 */
export function JokerClockFx({ event }: Props) {
  const spec = event ? getJokerFxSpec(event.code) : null
  const youIsBottom = event?.youSide !== 'top'
  const rivalSide = youIsBottom ? 'top' : 'bottom'
  const youSide = youIsBottom ? 'bottom' : 'top'
  const dur = (spec?.durationMs ?? 1200) / 1000

  return (
    <AnimatePresence mode="popLayout">
      {event && spec ? (
        <motion.div
          key={`${event.code}-${event.at}`}
          className="rc-clock-fx"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          aria-hidden
        >
          {event.code === 'axio_tempus' ? (
            <>
              <motion.div
                className={`rc-clock-fx-chip rc-clock-fx-chip--${rivalSide} rc-clock-fx-chip--loss`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: youIsBottom ? [0, 8, 40, 70] : [0, -8, -40, -70],
                }}
                transition={{ duration: dur, ease: 'easeInOut' }}
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
                transition={{ duration: dur, times: [0, 0.35, 0.55, 0.8, 1] }}
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
                transition={{ duration: dur }}
              >
                Axio Tempus · tiempo robado
              </motion.p>
            </>
          ) : null}

          {event.code === 'petrificus_totalus' ? (
            <>
              <motion.div
                className={`rc-clock-fx-chip rc-clock-fx-chip--${youSide} rc-clock-fx-chip--ice`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1.05, 1, 1] }}
                transition={{ duration: dur }}
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
                transition={{ duration: dur }}
              >
                Petrificus · tu reloj se detiene
              </motion.p>
            </>
          ) : null}

          {event.code === 'arresto_momentum' ? (
            <>
              <motion.div
                className={`rc-clock-fx-chip rc-clock-fx-chip--${rivalSide} rc-clock-fx-chip--haste`}
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: [0, 1, 1, 0], rotate: [0, 420] }}
                transition={{ duration: dur, ease: 'easeInOut' }}
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
                transition={{ duration: dur }}
              >
                Arresto Momentum · rival ×2
              </motion.p>
            </>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
