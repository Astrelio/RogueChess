import { motion } from 'framer-motion'
import { PixelEmoji } from '@/components/PixelEmoji'

/**
 * Indicador "en duelo": peones pixelados que chocan con impacto (más agresivo).
 */
export function DuelBadge() {
  return (
    <span
      className="relative inline-flex h-5 w-9 items-center justify-center align-middle"
      title="En duelo ahora"
      aria-label="En duelo ahora"
    >
      <motion.span
        className="absolute left-0 origin-bottom"
        animate={{
          x: [0, 7, 5, 7, 0],
          y: [0, 0, -1, 0, 0],
          rotate: [0, 28, 22, 28, 0],
          scale: [1, 1.05, 0.95, 1.05, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 0.85,
          times: [0, 0.35, 0.45, 0.55, 1],
          ease: 'easeInOut',
        }}
      >
        <PixelEmoji emoji="♟️" size={14} res={12} />
      </motion.span>
      <motion.span
        className="absolute right-0 origin-bottom -scale-x-100"
        animate={{
          x: [0, -7, -5, -7, 0],
          y: [0, 0, -1, 0, 0],
          rotate: [0, 28, 22, 28, 0],
          scale: [1, 1.05, 0.95, 1.05, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 0.85,
          times: [0, 0.35, 0.45, 0.55, 1],
          ease: 'easeInOut',
        }}
      >
        <PixelEmoji emoji="♟️" size={14} res={12} />
      </motion.span>
      <motion.span
        className="pointer-events-none absolute text-[10px] leading-none text-[var(--color-primary)]"
        animate={{
          opacity: [0, 0, 1, 0.6, 0],
          scale: [0.3, 0.3, 1.6, 1.1, 0.4],
          y: [0, 0, -2, -4, -6],
        }}
        transition={{
          repeat: Infinity,
          duration: 0.85,
          times: [0, 0.32, 0.42, 0.55, 0.75],
        }}
      >
        ✦
      </motion.span>
    </span>
  )
}

/**
 * Indicador "buscando partida": peón que se mueve / busca (más suave, no choque).
 */
export function SearchingBadge() {
  return (
    <span
      className="relative inline-flex h-5 w-8 items-center justify-center align-middle"
      title="Buscando partida"
      aria-label="Buscando partida"
    >
      <motion.span
        animate={{
          x: [-6, 6, -6],
          y: [0, -2, 0, -2, 0],
          rotate: [-8, 8, -8],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.6,
          ease: 'easeInOut',
        }}
      >
        <PixelEmoji emoji="♟️" size={14} res={12} />
      </motion.span>
      <motion.span
        className="font-label absolute -bottom-0.5 text-[7px] tracking-wider text-[var(--color-ink-muted)]"
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      >
        …
      </motion.span>
    </span>
  )
}
