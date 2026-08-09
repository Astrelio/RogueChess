import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MascotSpeech } from '@/components/onboarding/MascotSpeech'
import { getDimension } from '@/lib/dimensions'
import { easeOut } from '@/lib/motion'

type Stage =
  | 'welcome'
  | 'move'
  | 'jokers'
  | 'shop'
  | 'freeplay'
  | 'dimension'
  | 'close'
  | 'done'

/** Qué elemento (data-tutorial) debe mirar el jugador en cada paso. */
const STAGE_TARGET: Record<Stage, string | null> = {
  welcome: 'clock',
  move: 'board',
  jokers: 'jokers',
  shop: 'clock',
  freeplay: null,
  dimension: 'dimension',
  close: null,
  done: null,
}

type Props = {
  /** Visible solo con el tablero en juego. */
  open: boolean
  dark?: boolean
  /** El jugador ya realizó al menos una jugada. */
  moved?: boolean
  /** Comodines en la bandeja del jugador. */
  jokerCount?: number
  /** Dimensión actual del tablero (para anunciar el primer cambio). */
  dimensionId?: string
  /** Fase de tienda activa (la modal tapa al coach; se pausa el globo). */
  inShop?: boolean
  /** Tutorial terminado: el padre puede volver a la mascota normal. */
  onDone?: () => void
}

type Rect = { top: number; left: number; width: number; height: number }

/**
 * Guía reactiva para la partida tutorial (?tutorial=1): Bishop explica el
 * tablero y un foco resalta el elemento del que habla cada paso. El foco no
 * bloquea clicks (pointer-events: none), así que se puede seguir jugando.
 */
export function TutorialCoach({
  open,
  dark,
  moved,
  jokerCount = 0,
  dimensionId,
  inShop,
  onDone,
}: Props) {
  const [stage, setStage] = useState<Stage>('welcome')
  const [rect, setRect] = useState<Rect | null>(null)
  const dimAnnouncedRef = useRef<string | null>(null)
  const shopVisitedRef = useRef(false)

  const visible = open && !inShop && stage !== 'done'
  const target = STAGE_TARGET[stage]

  // Medir el elemento a enfocar; re-medir en resize y periódicamente
  // (el tablero cambia de tamaño con el viewport y los paneles animan).
  useEffect(() => {
    if (!visible || !target) {
      setRect(null)
      return
    }
    function measure() {
      const el = document.querySelector(`[data-tutorial="${target}"]`)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) {
        setRect(null)
        return
      }
      setRect((prev) =>
        prev &&
        Math.abs(prev.top - r.top) < 1 &&
        Math.abs(prev.left - r.left) < 1 &&
        Math.abs(prev.width - r.width) < 1 &&
        Math.abs(prev.height - r.height) < 1
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      )
    }
    measure()
    const interval = window.setInterval(measure, 450)
    window.addEventListener('resize', measure)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('resize', measure)
    }
  }, [visible, target])

  // Paso «mover»: avanza solo en cuanto el jugador hace su primera jugada.
  useEffect(() => {
    if (stage === 'move' && moved) {
      const t = window.setTimeout(() => setStage('jokers'), 600)
      return () => window.clearTimeout(t)
    }
  }, [stage, moved])

  // Registrar que ya pasó por la tienda (para reforzarlo al volver al tablero).
  useEffect(() => {
    if (inShop) shopVisitedRef.current = true
  }, [inShop])

  // Primer cambio de dimensión: interrumpe el freeplay y la presenta.
  useEffect(() => {
    if (!dimensionId || dimensionId === 'primo') return
    if (dimAnnouncedRef.current === dimensionId) return
    if (stage === 'freeplay' || stage === 'shop') {
      dimAnnouncedRef.current = dimensionId
      setStage('dimension')
    }
  }, [dimensionId, stage])

  useEffect(() => {
    if (stage === 'done') onDone?.()
  }, [stage, onDone])

  if (stage === 'done') return null

  const dim = getDimension(dimensionId)

  const content: Record<Exclude<Stage, 'done'>, { label: string; text: string; cta?: string; next: Stage }> = {
    welcome: {
      label: 'Bienvenida',
      text: '¡Bienvenido a tu partida tutorial! Juegas con blancas contra un bot, sin presión. Este es tu reloj: aquí el tiempo también es tu moneda.',
      next: 'move',
    },
    move: {
      label: 'Mover piezas',
      text: 'Te toca: arrastra una pieza o haz click en origen y destino. Los puntos sobre el tablero marcan los movimientos legales. ¡Prueba con un peón!',
      cta: moved ? 'Entendido' : 'Ya sé mover',
      next: 'jokers',
    },
    jokers: {
      label: 'Comodines',
      text:
        jokerCount > 0
          ? `¡Regalo de bienvenida! Tienes ${jokerCount === 1 ? 'un comodín' : `${jokerCount} comodines`} en la bandeja inferior. Pasa el cursor por encima de cada carta para leer qué hace. Luego haz click para activarla.`
          : 'Tus comodines viven en la bandeja inferior. Pasa el cursor por encima de cada carta para leer qué hace; haz click para activarla (algunas piden elegir casillas).',
      next: 'shop',
    },
    shop: {
      label: 'Tienda',
      text: 'Cuando termine esta fase se abre la tienda: podrás gastar segundos de este reloj para comprar más comodines. Compra con cabeza, el reloj no vuelve.',
      next: 'freeplay',
    },
    freeplay: {
      label: 'Tu turno',
      text: shopVisitedRef.current
        ? 'Sigue jugando y prueba tus comodines. Cuando cambie la dimensión te aviso por aquí.'
        : 'Sigue jugando con calma. Te aviso cuando pase algo nuevo: la tienda o un cambio de dimensión.',
      cta: '',
      next: 'freeplay',
    },
    dimension: {
      label: dim.title,
      text: `¡La grieta se abrió! Ahora juegas en ${dim.title}: ${dim.blurb} El panel de la izquierda siempre describe la dimensión activa.`,
      next: 'close',
    },
    close: {
      label: 'Listo',
      text: '¡Eso es todo! Ya conoces tablero, comodines, tienda y dimensiones. Cuando quieras salir, usa el logo RogueChess o el botón de arriba.',
      cta: '¡A jugar!',
      next: 'done',
    },
  }

  const step = content[stage]
  const showButton = step.cta !== ''

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="tutorial-coach"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: easeOut }}
        >
          {/* Foco sobre el elemento del paso: nunca bloquea clicks */}
          <AnimatePresence>
            {rect ? (
              <motion.div
                key={`spot-${target}`}
                className="rc-tutorial-spotlight pointer-events-none fixed z-[80] rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: easeOut }}
                style={{
                  top: rect.top - 10,
                  left: rect.left - 10,
                  width: rect.width + 20,
                  height: rect.height + 20,
                }}
              />
            ) : null}
          </AnimatePresence>

          {/* Mascota + globo, fijos abajo a la derecha, por encima del foco */}
          <div className="rc-match-mascot pointer-events-none fixed bottom-1 right-2 z-[85] hidden max-w-[340px] flex-col items-end gap-2 sm:flex lg:max-w-[360px]">
            <div className="pointer-events-auto mb-1 max-w-[270px]">
              <AnimatePresence mode="wait">
                <MascotSpeech key={stage} label={`Tutorial · ${step.label}`} dark={dark}>
                  <p>{step.text}</p>
                  {showButton ? (
                    <div className="mt-2.5 flex items-center justify-end">
                      <button
                        type="button"
                        className="btn-primary !px-3 !py-1 text-[10px]"
                        onClick={() => setStage(step.next)}
                      >
                        {step.cta ?? 'Entendido'}
                      </button>
                    </div>
                  ) : null}
                </MascotSpeech>
              </AnimatePresence>
            </div>

            <img
              src="/mascot/bishop-game.webp"
              alt=""
              className="rc-match-mascot-img max-h-[min(52dvh,440px)] w-auto max-w-[280px] object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.32)] lg:max-h-[480px] lg:max-w-[300px]"
              draggable={false}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
