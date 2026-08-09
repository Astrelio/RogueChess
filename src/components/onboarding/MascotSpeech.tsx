import { motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'

type Props = {
  /** Eyebrow del globo, ej. «Bishop · Tour». */
  label: string
  children: React.ReactNode
  dark?: boolean
  className?: string
  /** Posición de la flecha del globo. */
  tail?: 'right' | 'left' | 'none'
}

/**
 * Globo de diálogo de la mascota Bishop, reutilizable fuera de la partida
 * (mismo estilo que MatchMascotCoach).
 */
export function MascotSpeech({ label, children, dark, className, tail = 'right' }: Props) {
  return (
    <motion.div
      className={`rc-mascot-bubble relative rounded-2xl px-3.5 py-3 text-left text-[12.5px] leading-snug shadow-[0_10px_28px_rgba(0,0,0,0.22)] ${
        dark
          ? 'bg-[color-mix(in_srgb,#1a1520_94%,transparent)] text-[#f0e8dc] ring-1 ring-white/10'
          : 'bg-[color-mix(in_srgb,#fffdf8_96%,transparent)] text-[var(--color-ink)] ring-1 ring-black/8'
      } ${className ?? ''}`}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.3, ease: easeOut }}
    >
      <p className="font-label mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--color-primary)]">
        {label}
      </p>
      <div>{children}</div>
      {tail !== 'none' ? (
        <span
          className={`absolute -bottom-1.5 h-3 w-3 rotate-45 ${tail === 'right' ? 'right-8' : 'left-8'} ${
            dark ? 'bg-[#1a1520]' : 'bg-[#fffdf8]'
          }`}
          aria-hidden
        />
      ) : null}
    </motion.div>
  )
}
