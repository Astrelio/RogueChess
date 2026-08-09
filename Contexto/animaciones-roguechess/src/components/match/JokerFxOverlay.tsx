import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  getJokerFxSpec,
  squareToGrid,
  type JokerFxTheme,
} from '@/lib/jokerFx'

type AimAura = {
  squares: string[]
  theme: JokerFxTheme
  code: string
}

type CastBurst = {
  squares: string[]
  code: string
  at: number
}

type Props = {
  orientation: 'white' | 'black'
  aim?: AimAura | null
  burst?: CastBurst | null
}

function particlesFor(count: number, seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: count }, (_, i) => {
    const n = (h + i * 9973) >>> 0
    return {
      id: `${seed}-${i}`,
      x: 12 + (n % 76),
      y: 10 + ((n >> 3) % 78),
      delay: ((n >> 7) % 40) / 100,
      size: 3 + ((n >> 11) % 5),
      drift: 8 + ((n >> 15) % 18),
    }
  })
}

function SquareLayer({
  square,
  orientation,
  theme,
  mode,
  code,
  burstCount,
  extraClass,
}: {
  square: string
  orientation: 'white' | 'black'
  theme: JokerFxTheme
  mode: 'aim' | 'burst'
  code: string
  burstCount: number
  extraClass?: string
}) {
  const { col, row } = squareToGrid(square, orientation)
  const count = mode === 'aim' ? Math.min(6, burstCount) : burstCount
  const parts = useMemo(
    () => particlesFor(count, `${square}-${code}-${mode}`),
    [count, square, code, mode],
  )

  return (
    <div
      className={`rc-jfx-cell rc-jfx-cell--${theme} rc-jfx-cell--${mode} ${extraClass ?? ''}`}
      style={{
        left: `${(col / 8) * 100}%`,
        top: `${(row / 8) * 100}%`,
        width: '12.5%',
        height: '12.5%',
      }}
      aria-hidden
    >
      <span className="rc-jfx-ring" />
      {parts.map((p) => (
        <span
          key={p.id}
          className="rc-jfx-dot"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            ['--rc-jfx-drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  )
}

function StageRitual({ code, theme, durationMs }: { code: string; theme: JokerFxTheme; durationMs: number }) {
  const sec = durationMs / 1000
  if (code === 'paso_fantasma') {
    return (
      <motion.div
        className="rc-jfx-ritual rc-jfx-ritual--ghost"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: sec, times: [0, 0.15, 0.7, 1] }}
      >
        <span className="rc-jfx-ghost-trail rc-jfx-ghost-trail--1" />
        <span className="rc-jfx-ghost-trail rc-jfx-ghost-trail--2" />
        <span className="rc-jfx-ghost-trail rc-jfx-ghost-trail--3" />
        <p className="rc-jfx-ritual-label">Paso Fantasma</p>
        <p className="rc-jfx-ritual-sub">Tus piezas pueden atravesar</p>
      </motion.div>
    )
  }
  if (code === 'giratiempo') {
    return (
      <motion.div
        className="rc-jfx-ritual rc-jfx-ritual--tempus"
        initial={{ opacity: 0, rotate: -20 }}
        animate={{ opacity: [0, 1, 1, 0], rotate: [ -20, 0, 180, 340 ] }}
        transition={{ duration: sec, ease: 'easeOut' }}
      >
        <span className="rc-jfx-hourglass" />
        <span className="rc-jfx-hourglass-ring" />
        <p className="rc-jfx-ritual-label">Giratiempo</p>
        <p className="rc-jfx-ritual-sub">Un movimiento extra</p>
      </motion.div>
    )
  }
  if (code === 'expecto_patronum') {
    return (
      <motion.div
        className="rc-jfx-ritual rc-jfx-ritual--patronum"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.05, 1.1, 1.2] }}
        transition={{ duration: sec }}
      >
        <span className="rc-jfx-shield" />
        <span className="rc-jfx-shield rc-jfx-shield--2" />
        <p className="rc-jfx-ritual-label">Expecto Patronum</p>
        <p className="rc-jfx-ritual-sub">Morsmordre anulado</p>
      </motion.div>
    )
  }
  return (
    <motion.div
      className={`rc-jfx-ritual rc-jfx-ritual--${theme}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.8, 0] }}
      transition={{ duration: sec }}
    />
  )
}

/**
 * Overlay 8×8: aura al apuntar + cast por stage (no spray genérico).
 */
export function JokerFxOverlay({ orientation, aim, burst }: Props) {
  const aimSpec = aim ? getJokerFxSpec(aim.code) : null
  const burstSpec = burst ? getJokerFxSpec(burst.code) : null
  const aimBurstCount =
    aim && aimSpec
      ? aim.squares.length > 16
        ? 2
        : aim.squares.length > 8
          ? 4
          : Math.min(5, aimSpec.burstCount || 5)
      : 0

  const stage = burstSpec?.stage
  const showTargetBurst =
    burst &&
    burstSpec &&
    (stage === 'targets' || stage === 'pieceBlur') &&
    burst.squares.length > 0
  const showRitual =
    burst &&
    burstSpec &&
    (stage === 'boardCenter' || stage === 'shield')

  return (
    <div className="rc-jfx-overlay" aria-hidden>
      <AnimatePresence>
        {aim && aimSpec
          ? aim.squares.map((sq) => (
              <motion.div
                key={`aim-${sq}`}
                className="rc-jfx-slot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <SquareLayer
                  square={sq}
                  orientation={orientation}
                  theme={aim.theme}
                  mode="aim"
                  code={aim.code}
                  burstCount={aimBurstCount}
                />
              </motion.div>
            ))
          : null}
      </AnimatePresence>

      <AnimatePresence>
        {showTargetBurst
          ? burst!.squares.map((sq) => (
              <motion.div
                key={`burst-${burst!.at}-${sq}`}
                className="rc-jfx-slot"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SquareLayer
                  square={sq}
                  orientation={orientation}
                  theme={burstSpec!.theme}
                  mode="burst"
                  code={burst!.code}
                  burstCount={burstSpec!.burstCount}
                  extraClass={
                    burst!.code === 'capa_invisibilidad'
                      ? 'rc-jfx-cell--blur-cast'
                      : burst!.code === 'aparicion'
                        ? 'rc-jfx-cell--swap-cast'
                        : burst!.code === 'avada_kedavra'
                          ? 'rc-jfx-cell--death-cast'
                          : undefined
                  }
                />
              </motion.div>
            ))
          : null}
      </AnimatePresence>

      <AnimatePresence>
        {showRitual && burstSpec && burst ? (
          <StageRitual
            key={`ritual-${burst.at}`}
            code={burst.code}
            theme={burstSpec.theme}
            durationMs={burstSpec.durationMs}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
