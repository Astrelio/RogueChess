import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MascotSpeech } from '@/components/onboarding/MascotSpeech'
import { markLobbyTourSeen } from '@/lib/onboarding'
import { easeOut } from '@/lib/motion'

const MASCOT_SRC = '/mascot/Bishop.webp'

/** Evento para que el menú de usuario del Shell se abra/cierre durante el tour. */
export const TOUR_MENU_EVENT = 'rc-tour-menu'

type Step = {
  target: string
  label: string
  text: string
  /** El target vive dentro del menú de usuario: hay que abrirlo. */
  menu?: boolean
}

const STEPS: Step[] = [
  {
    target: '[data-tour="play"]',
    label: 'Jugar',
    text: 'Desde aquí empiezas: Partida rápida te empareja al instante y Personalizada te deja retar a un amigo con tu configuración.',
  },
  {
    target: '[data-tour="nav-ranking"]',
    label: 'Ranking',
    text: 'La clasificación global. Gana partidas para subir puestos y presumir de medalla.',
    menu: true,
  },
  {
    target: '[data-tour="nav-jokers"]',
    label: 'Comodines',
    text: 'La galería de cartas: revisa qué hace cada comodín antes de comprarlo en la tienda de la partida.',
    menu: true,
  },
  {
    target: '[data-tour="nav-profile"]',
    label: 'Tu perfil',
    text: 'Tu avatar abre el menú: perfil, estadísticas, y todo lo demás vive aquí.',
  },
  {
    target: '[data-tour="tutorial"]',
    label: 'Tutorial',
    text: '¿Primera vez? Este botón lanza una partida guiada contra un bot con consejos paso a paso.',
  },
]

type Rect = { top: number; left: number; width: number; height: number }

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/**
 * Tour de primer ingreso al lobby: máscara oscura + spotlight sobre cada
 * elemento clave, con la mascota Bishop explicando. Se muestra una sola vez.
 */
export function LobbyTour({ onDone }: { onDone: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const step = STEPS[stepIndex]

  const finish = useCallback(() => {
    window.dispatchEvent(new CustomEvent(TOUR_MENU_EVENT, { detail: false }))
    markLobbyTourSeen()
    onDone()
  }, [onDone])

  // Abrir/cerrar el menú según el paso y medir el target (con reintentos:
  // el menú anima su entrada y el nodo puede tardar unos frames).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(TOUR_MENU_EVENT, { detail: Boolean(step.menu) }))
    let raf = 0
    let tries = 0
    let settleTimer = 0
    function attempt() {
      const r = measure(step.target)
      if (r) {
        setRect(r)
        // Re-medir tras la animación del menú para afinar posición.
        if (step.menu) {
          settleTimer = window.setTimeout(() => {
            const again = measure(step.target)
            if (again) setRect(again)
          }, 220)
        }
        return
      }
      if (tries++ < 40) raf = requestAnimationFrame(attempt)
      else setRect(null)
    }
    setRect(null)
    raf = requestAnimationFrame(attempt)

    function onRelayout() {
      const r = measure(step.target)
      if (r) setRect(r)
    }
    window.addEventListener('resize', onRelayout)
    window.addEventListener('scroll', onRelayout, true)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(settleTimer)
      window.removeEventListener('resize', onRelayout)
      window.removeEventListener('scroll', onRelayout, true)
    }
  }, [step])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [finish])

  // Si el target de un paso no existe (layout móvil, etc.), saltarlo.
  useEffect(() => {
    if (rect) return
    const t = window.setTimeout(() => {
      if (!measure(step.target)) {
        if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1)
        else finish()
      }
    }, 900)
    return () => window.clearTimeout(t)
  }, [rect, step, stepIndex, finish])

  const isLast = stepIndex === STEPS.length - 1

  // Burbuja debajo del target si hay sitio; si no, encima.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const bubbleWidth = Math.min(320, vw - 24)
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const below = rect ? rect.top + rect.height + 220 < vh : true
  const bubbleLeft = rect
    ? Math.min(Math.max(rect.left + rect.width / 2 - bubbleWidth / 2, 12), vw - bubbleWidth - 12)
    : 12
  const bubbleTop = rect ? (below ? rect.top + rect.height + 16 : undefined) : undefined
  const bubbleBottom = rect && !below ? vh - rect.top + 16 : undefined

  // Portal a <body>: el tour debe pintar por encima del header (z-40) y del
  // menú de usuario (z-60), que viven en otro stacking context.
  return createPortal(
    <div className="fixed inset-0 z-[999]" role="dialog" aria-label="Tour de bienvenida">
      {/* Spotlight: el recorte se dibuja con un box-shadow gigante alrededor del target */}
      <AnimatePresence>
        {rect ? (
          <motion.div
            key="spot"
            className="rc-tour-spotlight pointer-events-none absolute rounded-md"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              top: rect.top - 4,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 8,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: easeOut }}
            style={{
              top: rect.top - 4,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 8,
            }}
          />
        ) : (
          <motion.div
            key="dim"
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Burbuja + controles junto al target */}
      <motion.div
        className="absolute flex flex-col gap-2"
        style={{ left: bubbleLeft, top: bubbleTop, bottom: bubbleBottom, width: bubbleWidth }}
        layout
        transition={{ duration: 0.3, ease: easeOut }}
      >
        <AnimatePresence mode="wait">
          <MascotSpeech key={stepIndex} label={`Bishop · ${step.label}`} tail="none">
            <p>{step.text}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-label text-[9px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                {stepIndex + 1} / {STEPS.length}
              </span>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost !px-2.5 !py-1 text-[10px]" onClick={finish}>
                  Saltar
                </button>
                <button
                  type="button"
                  className="btn-primary !px-3 !py-1 text-[10px]"
                  onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
                >
                  {isLast ? '¡A jugar!' : 'Siguiente'}
                </button>
              </div>
            </div>
          </MascotSpeech>
        </AnimatePresence>
      </motion.div>

      {/* Mascota acompañando, abajo a la izquierda */}
      <motion.img
        src={MASCOT_SRC}
        alt=""
        draggable={false}
        className="pointer-events-none absolute bottom-0 left-2 hidden max-h-[34dvh] w-auto select-none object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.4)] sm:block"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
      />
    </div>,
    document.body,
  )
}
