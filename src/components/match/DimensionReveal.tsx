import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'
import { getDimension, type DimensionTheme } from '@/lib/dimensions'
import { DimensionEnv } from '@/components/match/DimensionEnv'

type Props = {
  dimensionId: string | null
  onDismiss: () => void
}

function Announcement({
  theme,
  title,
  eyebrow,
  blurb,
}: {
  theme: DimensionTheme
  title: string
  eyebrow: string
  blurb: string
}) {
  if (theme === 'bluriel') {
    return (
      <motion.div
        className="rc-announce rc-announce-bluriel"
        initial={{ opacity: 0, filter: 'blur(14px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(8px)' }}
        transition={{ duration: 0.45, ease: easeOut }}
      >
        <p className="rc-announce-eyebrow">{eyebrow}</p>
        <h2 className="rc-announce-title">{title}</h2>
        <p className="rc-announce-blurb">{blurb}</p>
      </motion.div>
    )
  }

  if (theme === 'espejo') {
    return (
      <motion.div
        className="rc-announce rc-announce-espejo"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rc-announce-espejo-row">
          <div className="rc-announce-espejo-side">
            <p className="rc-announce-eyebrow">{eyebrow}</p>
            <h2 className="rc-announce-title">{title}</h2>
            <p className="rc-announce-blurb">{blurb}</p>
          </div>
          <div className="rc-announce-espejo-side rc-announce-espejo-side--mirror" aria-hidden>
            <p className="rc-announce-eyebrow">{eyebrow}</p>
            <h2 className="rc-announce-title">{title}</h2>
            <p className="rc-announce-blurb">{blurb}</p>
          </div>
        </div>
      </motion.div>
    )
  }

  if (theme === 'gravitacional') {
    return (
      <motion.div
        className="rc-announce rc-announce-grav"
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 140, damping: 18 }}
      >
        <p className="rc-announce-eyebrow">{eyebrow}</p>
        <h2 className="rc-announce-title">{title}</h2>
        <p className="rc-announce-blurb">{blurb}</p>
      </motion.div>
    )
  }

  if (theme === 'cadena_sangre') {
    return (
      <motion.div
        className="rc-announce rc-announce-sangre"
        initial={{ opacity: 0, scale: 0.88, x: '-50%', y: '-50%', rotate: -10 }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%', rotate: -6 }}
        exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <div className="rc-announce-sangre-slash" />
        <p className="rc-announce-eyebrow">{eyebrow}</p>
        <h2 className="rc-announce-title">{title}</h2>
        <p className="rc-announce-blurb">{blurb}</p>
      </motion.div>
    )
  }

  if (theme === 'ruina') {
    return (
      <motion.div
        className="rc-announce rc-announce-ruina"
        initial={{ opacity: 0, rotate: -3 }}
        animate={{ opacity: 1, rotate: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <span className="rc-announce-ruina-chip rc-announce-ruina-chip--1" />
        <span className="rc-announce-ruina-chip rc-announce-ruina-chip--2" />
        <p className="rc-announce-eyebrow">{eyebrow}</p>
        <h2 className="rc-announce-title">{title}</h2>
        <p className="rc-announce-blurb">{blurb}</p>
      </motion.div>
    )
  }

  if (theme === 'mercado_negro') {
    return (
      <motion.div
        className="rc-announce rc-announce-mercado"
        initial={{ opacity: 0, x: '-50%', y: 'calc(-50% + 28px)' }}
        animate={{ opacity: 1, x: '-50%', y: '-50%' }}
        exit={{ opacity: 0, x: '-50%', y: '-45%' }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <div className="rc-announce-stele-face">
          <p className="rc-announce-eyebrow">{eyebrow}</p>
          <h2 className="rc-announce-title">{title}</h2>
          <p className="rc-announce-blurb">{blurb}</p>
        </div>
      </motion.div>
    )
  }

  if (theme === 'fragilidad') {
    return (
      <motion.div
        className="rc-announce rc-announce-cristal"
        initial={{ opacity: 0, y: '-45%', scale: 0.92 }}
        animate={{ opacity: 1, y: '-50%', scale: 1 }}
        exit={{ opacity: 0, y: '-48%', scale: 0.96 }}
        transition={{ duration: 0.4, ease: easeOut }}
      >
        <p className="rc-announce-eyebrow">{eyebrow}</p>
        <h2 className="rc-announce-title">{title}</h2>
        <p className="rc-announce-blurb">{blurb}</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="rc-announce rc-announce-primo"
      initial={{ opacity: 0, scale: 0.88, x: '-50%', y: '-50%' }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
      exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <p className="rc-announce-eyebrow">{eyebrow}</p>
      <h2 className="rc-announce-title">{title}</h2>
      <p className="rc-announce-blurb">{blurb}</p>
    </motion.div>
  )
}

export function DimensionReveal({ dimensionId, onDismiss }: Props) {
  const info = dimensionId ? getDimension(dimensionId) : null

  return createPortal(
    <AnimatePresence>
      {info ? (
        <motion.div
          key={info.id}
          className={`rc-dim-reveal rc-dim-reveal--${info.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          onClick={onDismiss}
          role="dialog"
          aria-modal="true"
          aria-label={`${info.title}: ${info.blurb}`}
        >
          <DimensionEnv theme={info.id} />
          <Announcement
            theme={info.id}
            title={info.title}
            eyebrow={info.eyebrow}
            blurb={info.blurb}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
