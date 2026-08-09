import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { jokerArtUrl } from '@/lib/jokerArt'
import { getJokerFxSpec, type JokerFxTheme } from '@/lib/jokerFx'
import { easeOut } from '@/lib/motion'

type Props = {
  open: boolean
  code: string
  name: string
}

const VEIL: Record<JokerFxTheme, string> = {
  spectral: 'rgba(123,107,181,0.28)',
  antimatter: 'rgba(196,90,50,0.28)',
  tempus: 'rgba(42,143,158,0.32)',
  patronum: 'rgba(200,220,255,0.3)',
}

const BORDER: Record<JokerFxTheme, string> = {
  spectral: 'rgba(180,160,230,0.55)',
  antimatter: 'rgba(255,140,80,0.55)',
  tempus: 'rgba(80,210,220,0.6)',
  patronum: 'rgba(230,240,255,0.65)',
}

/**
 * Destello de carta al castear cualquier comodín (junto a partículas / ritual / reloj).
 */
export function InstantJokerFx({ open, code, name }: Props) {
  const theme = getJokerFxSpec(code).theme
  const veil = VEIL[theme]
  const border = BORDER[theme]
  const isTempus = theme === 'tempus'
  const cardW = isTempus ? 104 : 92
  const cardH = Math.round(cardW * 1.4)
  const dur = isTempus ? 1.15 : 0.95

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key={`jfx-card-${code}`}
          className="pointer-events-none fixed inset-0 z-[125] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-live="polite"
        >
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 55% 45% at 50% 48%, ${veil}, transparent 70%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.55, 0] }}
            transition={{ duration: dur, times: [0, 0.18, 0.55, 1], ease: easeOut }}
          />

          <div className="relative flex flex-col items-center gap-3">
            <motion.div
              className="relative overflow-hidden rounded-sm shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
              style={{
                width: cardW,
                height: cardH,
                border: `1px solid ${border}`,
                background: 'rgba(12, 10, 8, 0.92)',
              }}
              initial={{ opacity: 0, scale: 0.72, y: 18, rotate: -5 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.72, 1.08, 1, 0.94],
                y: [18, 0, 0, -10],
                rotate: [-5, 0, 0, 3],
              }}
              transition={{ duration: dur, times: [0, 0.2, 0.62, 1], ease: easeOut }}
            >
              <img
                src={jokerArtUrl(code)}
                alt=""
                className="h-full w-full object-contain"
                draggable={false}
              />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    theme === 'tempus'
                      ? 'linear-gradient(115deg, transparent 28%, rgba(160,240,255,0.55) 50%, transparent 72%)'
                      : 'linear-gradient(115deg, transparent 30%, rgba(255,224,136,0.5) 50%, transparent 70%)',
                }}
                initial={{ x: '-120%' }}
                animate={{ x: '140%' }}
                transition={{ duration: 0.55, delay: 0.1, ease: easeOut }}
              />
            </motion.div>

            <motion.p
              className="font-display text-2xl drop-shadow-sm sm:text-3xl"
              style={{
                color:
                  theme === 'tempus'
                    ? '#9eecf2'
                    : theme === 'antimatter'
                      ? '#ffb080'
                      : theme === 'patronum'
                        ? '#e8f0ff'
                        : '#d4c4ff',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6] }}
              transition={{ duration: dur, times: [0, 0.18, 0.62, 1], ease: easeOut }}
            >
              {name}
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
