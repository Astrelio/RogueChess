import { useEffect, useRef, useState } from 'react'
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from '@floating-ui/react'
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
}

export function JokerCard({ joker, size = 140, className, onClick, disabled, selected }: Props) {
  const [open, setOpen] = useState(false)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLButtonElement>(null)

  const { refs, floatingStyles, update } = useFloating({
    open,
    placement: 'top',
    middleware: [offset(14), flip(), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  })

  useEffect(() => {
    if (!open) return
    const el = document.createElement('div')
    el.style.position = 'fixed'
    el.style.left = `${pointer.x}px`
    el.style.top = `${pointer.y}px`
    el.style.width = '1px'
    el.style.height = '1px'
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)
    refs.setReference(el)
    void update()
    return () => {
      el.remove()
    }
  }, [open, pointer.x, pointer.y, refs, update])

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
        whileHover={{ y: -4, rotate: -1.5 }}
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onMouseMove={(e) => setPointer({ x: e.clientX, y: e.clientY })}
        className={cn(
          'panel relative aspect-square overflow-hidden p-2 transition disabled:opacity-50',
          rarityRing,
          selected && 'ring-2 ring-[var(--color-primary)]',
          className,
        )}
        style={{ width: size, height: size }}
        aria-label={joker.name}
      >
        <img
          src={jokerArtUrl(joker.code)}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
          style={{ mixBlendMode: 'multiply' }}
        />
      </motion.button>

      <AnimatePresence>
        {open ? (
          <div ref={refs.setFloating} style={floatingStyles} className="pointer-events-none z-[200]">
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="panel max-w-[260px] border-[var(--color-outline-soft)]/60 bg-[color-mix(in_srgb,#fff_88%,transparent)] p-3 shadow-[0_16px_40px_rgba(115,92,0,0.12)]"
            >
              <p className="font-display text-base text-[var(--color-primary)]">{joker.name}</p>
              <p className="font-label mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {rarityLabel[joker.rarity] ?? joker.rarity} · {factionLabel[joker.faction] ?? joker.faction}
              </p>
              <p className="mt-2 text-sm leading-snug text-[var(--color-ink-muted)]">{joker.description}</p>
              <p className="font-label mt-3 text-[11px] uppercase tracking-wider text-[var(--color-primary)]">
                Coste: −{joker.cost_seconds}s
              </p>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
