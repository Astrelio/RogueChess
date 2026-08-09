import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut, easeSnap } from '@/lib/motion'
import { getDimension, type DimensionTheme } from '@/lib/dimensions'
import { DimensionEnv } from '@/components/match/DimensionEnv'

type Props = {
  dimensionId: string | null
  onDismiss: () => void
}

/** Tablero 3D por dimensión (solo imagen). */
const BOARD_ART: Record<DimensionTheme, string> = {
  primo: '/dimensions/dim-primo.png',
  espejo: '/dimensions/dim-espejo.png',
  bluriel: '/dimensions/dim-bluriel.png',
  gravitacional: '/dimensions/dim-gravitacional.png',
  cadena_sangre: '/dimensions/dim-sangre.png',
  ruina: '/dimensions/dim-ruina.png',
  mercado_negro: '/dimensions/dim-mercado.png',
  fragilidad: '/dimensions/dim-fragilidad.png',
}

/** Temas con copy en el centro: tablero más chico / detrás. */
const BOARD_BEHIND = new Set<DimensionTheme>(['cadena_sangre', 'mercado_negro', 'primo'])

function DimensionBoardArt({ theme }: { theme: DimensionTheme }) {
  const src = BOARD_ART[theme]
  const behind = BOARD_BEHIND.has(theme)
  return (
    <motion.div
      className={`rc-dim-board ${behind ? 'rc-dim-board--behind' : 'rc-dim-board--hero'} rc-dim-board--${theme}`}
      aria-hidden
      initial={{ opacity: 0, scale: 0.88, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.55, delay: 0.08, ease: easeOut }}
    >
      <img src={src} alt="" draggable={false} />
    </motion.div>
  )
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
        initial={{ opacity: 0, filter: 'blur(18px)', y: 24 }}
        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        exit={{ opacity: 0, filter: 'blur(10px)', y: 8 }}
        transition={{ duration: 0.55, ease: easeOut }}
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
        initial={{ opacity: 0, scaleX: 0.92 }}
        animate={{ opacity: 1, scaleX: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: easeSnap }}
      >
        <div className="rc-announce-espejo-row">
          <motion.div
            className="rc-announce-espejo-side"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.45, ease: easeOut }}
          >
            <p className="rc-announce-eyebrow">{eyebrow}</p>
            <h2 className="rc-announce-title">{title}</h2>
            <p className="rc-announce-blurb">{blurb}</p>
          </motion.div>
          <motion.div
            className="rc-announce-espejo-side rc-announce-espejo-side--mirror"
            aria-hidden
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 0.55 }}
            transition={{ delay: 0.18, duration: 0.45, ease: easeOut }}
          >
            <p className="rc-announce-eyebrow">{eyebrow}</p>
            <h2 className="rc-announce-title">{title}</h2>
            <p className="rc-announce-blurb">{blurb}</p>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  if (theme === 'gravitacional') {
    return (
      <motion.div
        className="rc-announce rc-announce-grav"
        initial={{ y: -90, opacity: 0, scaleY: 1.2 }}
        animate={{ y: 0, opacity: 1, scaleY: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
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
        initial={{ opacity: 0, scale: 0.82, x: '-50%', y: '-50%', rotate: -14 }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%', rotate: -6 }}
        exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
        transition={{ duration: 0.48, ease: easeSnap }}
      >
        <motion.div
          className="rc-announce-sangre-slash"
          initial={{ opacity: 0, scaleX: 0.2 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        />
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
        initial={{ opacity: 0, rotate: -6, y: -16 }}
        animate={{ opacity: 1, rotate: 0, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
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
        initial={{ opacity: 0, x: '-50%', y: 'calc(-50% + 40px)', filter: 'brightness(0.7)' }}
        animate={{ opacity: 1, x: '-50%', y: '-50%', filter: 'brightness(1)' }}
        exit={{ opacity: 0, x: '-50%', y: '-45%' }}
        transition={{ duration: 0.5, ease: easeOut }}
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
        initial={{ opacity: 0, y: '-42%', scale: 0.88, rotate: -2 }}
        animate={{ opacity: 1, y: '-50%', scale: 1, rotate: 0 }}
        exit={{ opacity: 0, y: '-48%', scale: 0.96 }}
        transition={{ duration: 0.5, ease: easeSnap }}
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
      initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%', rotate: -4 }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%', rotate: 0 }}
      exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-50%' }}
      transition={{ duration: 0.45, ease: easeSnap }}
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
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35, ease: easeOut }}
          onClick={onDismiss}
          role="dialog"
          aria-modal="true"
          aria-label={`${info.title}: ${info.blurb}`}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.08, filter: 'brightness(0.6)' }}
            animate={{ scale: 1, filter: 'brightness(1)' }}
            transition={{ duration: 0.85, ease: easeOut }}
          >
            <DimensionEnv theme={info.id} />
          </motion.div>
          <div className="rc-dim-vignette" aria-hidden />
          <span className="rc-dim-shock" aria-hidden />
          <span className="rc-dim-shock rc-dim-shock--2" aria-hidden />
          <DimensionBoardArt theme={info.id} />
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
