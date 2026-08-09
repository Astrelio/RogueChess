import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { DimensionEnv } from '@/components/match/DimensionEnv'
import { getDimension } from '@/lib/dimensions'
import { easeOut } from '@/lib/motion'

type Props = {
  dimensionId: string | null
  onDismiss: () => void
  /** Tras el fade-out: el tablero puede mostrarse. */
  onExitComplete?: () => void
}

/**
 * Reveal de dimensión: atmósfera + presentación (textos sin cambiar).
 * Cubre todo el viewport antes de pintar el tablero.
 */
export function DimensionReveal({ dimensionId, onDismiss, onExitComplete }: Props) {
  const info = dimensionId ? getDimension(dimensionId) : null

  return createPortal(
    <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
      {info ? (
        <motion.div
          key={info.id}
          className={`rc-dim-reveal rc-dim-reveal--${info.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
          onClick={onDismiss}
          role="dialog"
          aria-modal="true"
          aria-label={`${info.title}. ${info.blurb}`}
        >
          <motion.div
            className="absolute inset-0"
            initial={{
              scale: 1.08,
              filter: info.id === 'primo' ? 'brightness(0.85)' : 'brightness(0.35)',
            }}
            animate={{ scale: 1, filter: 'brightness(1)' }}
            transition={{ duration: 0.95, ease: easeOut }}
          >
            <DimensionEnv theme={info.id} intensity={1} />
          </motion.div>

          <div
            className={info.id === 'primo' ? 'rc-dim-vignette rc-dim-vignette--primo' : 'rc-dim-vignette'}
            aria-hidden
          />

          <motion.div
            className={`rc-dim-card-slot rc-dim-card-slot--${info.id}`}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.55, ease: easeOut, delay: 0.12 }}
          >
            {info.id === 'bluriel' ? (
              <div className="rc-dim-bluriel-piece" aria-hidden>
                ♞
              </div>
            ) : null}
            {info.id === 'mercado_negro' ? (
              <div className="rc-dim-mercado-hourglass" aria-hidden />
            ) : null}
            {info.id === 'ruina' ? (
              <div className="rc-dim-ruina-debris" aria-hidden>
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : null}
            <article className={`rc-dim-card rc-dim-card--${info.id}`}>
              <p className="rc-dim-card-eyebrow">{info.eyebrow}</p>
              <h2 className="rc-dim-card-title">{info.title}</h2>
              <p className="rc-dim-card-blurb">{info.blurb}</p>
            </article>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
