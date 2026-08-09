import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PixelEmoji, sampleEmojiColors } from '@/components/PixelEmoji'

export type ReactionSide = 'white' | 'black'

export type ReactionEvent = {
  key: number
  emoji: string
  username?: string
  /** Color del jugador al que va la reacción (lado del tablero). */
  targetColor: ReactionSide
}

/** Pseudo-random determinista (mismos fragmentos en cada render). */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const SHARDS = 9
/** El emoji vive ~2.4s y luego "se rompe" en fragmentos (el padre lo retira a los 3.6s). */
const BREAK_AT_MS = 2400

/**
 * Columna visual según orientación del tablero.
 * white@bottom → blancas a la izquierda; al voltear (negras abajo) se invierte,
 * así cada jugador ve "su lado" / "lado enemigo" de forma coherente.
 */
export function visualColumn(
  targetColor: ReactionSide,
  boardOrientation: ReactionSide,
): 'left' | 'right' {
  if (boardOrientation === 'white') return targetColor === 'white' ? 'left' : 'right'
  return targetColor === 'white' ? 'right' : 'left'
}

function PixelReaction({ event }: { event: ReactionEvent }) {
  const [broken, setBroken] = useState(false)
  const shardColors = useMemo(() => sampleEmojiColors(event.emoji, SHARDS), [event.emoji])

  useEffect(() => {
    const t = window.setTimeout(() => setBroken(true), BREAK_AT_MS)
    return () => window.clearTimeout(t)
  }, [])

  if (broken) {
    return (
      <div className="relative h-10 w-10">
        {Array.from({ length: SHARDS }, (_, i) => {
          const seed = event.key * 31 + i * 7
          const angle = (i / SHARDS) * Math.PI * 2 + rand(seed) * 0.8
          const dist = 12 + rand(seed + 1) * 16
          const px = 3 + Math.round(rand(seed + 2) * 3)
          return (
            <motion.span
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{
                width: px,
                height: px,
                backgroundColor: shardColors[i] ?? 'var(--color-ink-muted)',
              }}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist + 6,
                opacity: 0,
                rotate: (rand(seed + 3) - 0.5) * 180,
              }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1.25, 0.92, 1], opacity: 1 }}
      transition={{ duration: 0.32, times: [0, 0.55, 0.8, 1] }}
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
      >
        <PixelEmoji emoji={event.emoji} size={40} res={16} className="drop-shadow-sm" />
      </motion.div>
      {event.username ? (
        <span className="font-label mt-0.5 max-w-16 truncate rounded bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] px-1 text-[8px] uppercase tracking-wider text-[var(--color-ink-muted)]">
          @{event.username}
        </span>
      ) : null}
    </motion.div>
  )
}

function Column({ side, items }: { side: 'left' | 'right'; items: ReactionEvent[] }) {
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-30 flex w-12 flex-col-reverse items-center gap-2 pb-3 ${
        side === 'left' ? 'left-0 md:-left-14' : 'right-0 md:-right-14'
      }`}
      aria-live="polite"
    >
      <AnimatePresence>
        {items.map((e) => (
          <motion.div key={e.key} layout exit={{ opacity: 0, scale: 0.6 }}>
            <PixelReaction event={e} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Reacciones ancladas al color del jugador espectado. Cada viewer mapea
 * white/black → izquierda/derecha según su orientación del tablero.
 */
export function SpectatorReactionColumns({
  events,
  boardOrientation = 'white',
}: {
  events: ReactionEvent[]
  boardOrientation?: ReactionSide
}) {
  const left = events.filter((e) => visualColumn(e.targetColor, boardOrientation) === 'left')
  const right = events.filter((e) => visualColumn(e.targetColor, boardOrientation) === 'right')
  return (
    <>
      <Column side="left" items={left} />
      <Column side="right" items={right} />
    </>
  )
}
