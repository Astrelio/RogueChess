import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { factionLabel, jokerArtUrl, rarityLabel } from '@/lib/jokerArt'
import type { Joker } from '@/types/match'

type Props = {
  joker: Joker
  size?: number
  /** Ancho CSS fluido (p.ej. 'var(--rc-joker-inv)'). Tiene prioridad sobre `size`; alto = ratio 1.4. */
  cssWidth?: string
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
  /** Tooltip oscuro (dimensiones oscuras). */
  darkTooltip?: boolean
}

export function JokerCard({
  joker,
  size = 168,
  cssWidth,
  className,
  onClick,
  disabled,
  selected,
  draggable: canDrag,
  onDragStart,
  onDragEnd,
  shaded,
  tooltipSide = 'above',
  darkTooltip,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLButtonElement>(null)
  const lastPointerType = useRef<string>('mouse')
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

  // Si se deshabilita (p.ej. al castear), cerrar tooltip
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  // Touch sin onClick (galería): tap abre tooltip; cerrar al tocar fuera.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (cardRef.current && e.target instanceof Node && cardRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

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
        onPointerDown={(e) => {
          lastPointerType.current = e.pointerType
        }}
        onClick={(e) => {
          if (onClick) {
            onClick()
            return
          }
          // Sin acción propia (galería) y en touch: tap alterna el tooltip
          if (lastPointerType.current !== 'touch') return
          setPointer({ x: e.clientX, y: e.clientY })
          setOpen((v) => !v)
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'touch') return
          setOpen(true)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'touch') return
          setOpen(false)
        }}
        onMouseMove={(e) => setPointer({ x: e.clientX, y: e.clientY })}
        className={cn(
          'relative overflow-hidden border bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition disabled:opacity-50',
          rarityRing,
          selected && 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-white',
          canDrag && !disabled && 'cursor-grab active:cursor-grabbing',
          shaded && 'opacity-45 grayscale-[0.35]',
          className,
        )}
        style={cssWidth ? { width: cssWidth, aspectRatio: '1 / 1.4' } : { width: size, height }}
        aria-label={joker.name}
        aria-pressed={selected}
      >
        <img
          src={jokerArtUrl(joker.code)}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
        />
        {shaded ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_28%,transparent)]"
          />
        ) : null}
      </motion.button>

      {/* Portal: fixed no se rompe si un padre tiene transform (exit inventario) */}
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {open && !disabled ? (
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
                    // Clampear al viewport: en móvil el tap puede caer pegado al borde
                    left: Math.min(Math.max(pointer.x, 150), Math.max(window.innerWidth - 150, 150)),
                    top: tooltipSide === 'below' ? pointer.y + 18 : pointer.y - 14,
                  }}
                >
                  <div
                    className={cn(
                      'border p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-md',
                      darkTooltip
                        ? 'border-white/15 bg-[color-mix(in_srgb,#12100e_92%,transparent)] text-white'
                        : 'border-[var(--color-outline-soft)]/60 bg-[color-mix(in_srgb,#fff_92%,transparent)]',
                    )}
                  >
                    <p
                      className={cn(
                        'font-display text-base',
                        darkTooltip ? 'text-white' : 'text-[var(--color-primary)]',
                      )}
                    >
                      {joker.name}
                    </p>
                    <p
                      className={cn(
                        'font-label mt-1 text-[10px] uppercase tracking-[0.14em]',
                        darkTooltip ? 'text-white/65' : 'text-[var(--color-ink-muted)]',
                      )}
                    >
                      {rarityLabel[joker.rarity] ?? joker.rarity} ·{' '}
                      {factionLabel[joker.faction] ?? joker.faction}
                    </p>
                    <p
                      className={cn(
                        'mt-2 text-sm leading-snug',
                        darkTooltip ? 'text-white/80' : 'text-[var(--color-ink-muted)]',
                      )}
                    >
                      {joker.description}
                    </p>
                    <p
                      className={cn(
                        'font-label mt-3 text-[11px] uppercase tracking-wider',
                        darkTooltip ? 'text-white' : 'text-[var(--color-primary)]',
                      )}
                    >
                      Coste: −{joker.cost_seconds}s
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  )
}
