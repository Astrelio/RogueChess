import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { factionLabel, jokerArtUrl, rarityLabel } from '@/lib/jokerArt'
import type { Joker } from '@/types/match'

type Props = {
  joker: Joker
  size?: number
  className?: string
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  /** HTML5 drag (p.ej. oferta → slot vacío en tienda). */
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragEnd?: (e: DragEvent) => void
  /** Sombra extra (p.ej. no se puede comprar). */
  shaded?: boolean
  /** En tienda: debajo del cursor. En partida: arriba (default). */
  tooltipSide?: 'above' | 'below'
}

export function JokerCard({
  joker,
  size = 168,
  className,
  onClick,
  disabled,
  selected,
  draggable: canDrag,
  onDragStart,
  onDragEnd,
  shaded,
  tooltipSide = 'above',
}: Props) {
  const [open, setOpen] = useState(false)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLButtonElement>(null)
  const height = Math.round(size * 1.4)

  // HTML5 DnD: listeners nativos (Framer Motion se apropia de onDragStart)
  useEffect(() => {
    const node = cardRef.current
    if (!node) return
    const enabled = Boolean(canDrag && !disabled)
    node.draggable = enabled
    if (!enabled) return

    const start = (e: DragEvent) => {
      setOpen(false)
      onDragStart?.(e)
    }
    const end = (e: DragEvent) => {
      onDragEnd?.(e)
    }
    node.addEventListener('dragstart', start)
    node.addEventListener('dragend', end)
    return () => {
      node.draggable = false
      node.removeEventListener('dragstart', start)
      node.removeEventListener('dragend', end)
    }
  }, [canDrag, disabled, onDragStart, onDragEnd])

  const rarityRing =
    joker.rarity === 'legendary'
      ? 'border-[var(--color-primary-container)] shadow-[0_0_0_1px_rgba(212,175,55,0.35)]'
      : joker.rarity === 'epic'
        ? 'border-[var(--color-primary)]'
        : 'border-[var(--color-outline-soft)]'

  return (
    <>
      <motion.button
        ref={cardRef}
        type="button"
        disabled={disabled}
        whileHover={disabled || shaded ? undefined : { y: -6, rotate: -1.5 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        onClick={onClick}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onMouseMove={(e) => setPointer({ x: e.clientX, y: e.clientY })}
        className={cn(
          'panel relative overflow-hidden p-1.5 transition disabled:opacity-50',
          rarityRing,
          selected && 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-surface)]',
          canDrag && !disabled && 'cursor-grab active:cursor-grabbing',
          shaded && 'opacity-45 grayscale-[0.35]',
          className,
        )}
        style={{ width: size, height }}
        aria-label={joker.name}
        aria-pressed={selected}
      >
        <img
          src={jokerArtUrl(joker.code)}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
          style={{ mixBlendMode: 'multiply' }}
        />
        {shaded ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_28%,transparent)]"
          />
        ) : null}
      </motion.button>

      {/* Tooltip: debajo del cursor solo en tienda; en partida va arriba */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: tooltipSide === 'below' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: tooltipSide === 'below' ? 2 : -2 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'pointer-events-none fixed z-[200] w-[min(92vw,320px)] min-w-[260px] -translate-x-1/2',
              tooltipSide === 'above' && '-translate-y-full',
            )}
            style={{
              left: pointer.x,
              top: tooltipSide === 'below' ? pointer.y + 18 : pointer.y - 14,
            }}
          >
            <div className="panel border-[var(--color-outline-soft)]/60 bg-[color-mix(in_srgb,#fff_92%,transparent)] p-4 shadow-[0_16px_40px_rgba(115,92,0,0.14)]">
              <p className="font-display text-base text-[var(--color-primary)]">{joker.name}</p>
              <p className="font-label mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {rarityLabel[joker.rarity] ?? joker.rarity} · {factionLabel[joker.faction] ?? joker.faction}
              </p>
              <p className="mt-2 text-sm leading-snug text-[var(--color-ink-muted)]">{joker.description}</p>
              <p className="font-label mt-3 text-[11px] uppercase tracking-wider text-[var(--color-primary)]">
                Coste: −{joker.cost_seconds}s
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
