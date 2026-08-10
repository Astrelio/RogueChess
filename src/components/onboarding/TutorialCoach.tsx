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
  | 'avada'
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
  avada: 'board',
  shop: 'clock',
  freeplay: null,
  dimension: 'dimension',
  close: null,
  done: null,
}

/** Pasos que avanzan con un toque (salvo excepciones abajo). */
const TAP_ADVANCE: ReadonlySet<Stage> = new Set([
  'welcome',
  'jokers',
  'avada',
  'shop',
  'dimension',
  'close',
])

type Props = {
  open: boolean
  dark?: boolean
  moved?: boolean
  jokerCount?: number
  dimensionId?: string
  inShop?: boolean
  /** Código del comodín en modo apuntado (p. ej. avada_kedavra). */
  aimingJokerCode?: string | null
  onDone?: () => void
}

type Rect = { top: number; left: number; width: number; height: number }

/**
 * Guía reactiva del tutorial: tips por toque, y si eliges Avada se inserta
 * un paso de cómo usarlo antes del tip de la tienda/reloj.
 */
export function TutorialCoach({
  open,
  dark,
  moved,
  jokerCount = 0,
  dimensionId,
  inShop,
  aimingJokerCode,
  onDone,
}: Props) {
  const [stage, setStage] = useState<Stage>('welcome')
  const [rect, setRect] = useState<Rect | null>(null)
  const dimAnnouncedRef = useRef<string | null>(null)
  const shopVisitedRef = useRef(false)
  const stageReadyAtRef = useRef(0)
  const sawAvadaAimRef = useRef(false)

  const visible = open && !inShop && stage !== 'done'
  const target = STAGE_TARGET[stage]
  const tapAdvance = TAP_ADVANCE.has(stage)

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

  useEffect(() => {
    stageReadyAtRef.current = performance.now() + 380
  }, [stage])

  useEffect(() => {
    if (stage === 'move' && moved) {
      const t = window.setTimeout(() => setStage('jokers'), 600)
      return () => window.clearTimeout(t)
    }
  }, [stage, moved])

  useEffect(() => {
    if (inShop) shopVisitedRef.current = true
  }, [inShop])

  // Click en Avada durante el tip de comodines → guía de uso (no tip del reloj).
  useEffect(() => {
    if (stage === 'jokers' && aimingJokerCode === 'avada_kedavra') {
      sawAvadaAimRef.current = true
      setStage('avada')
    }
  }, [stage, aimingJokerCode])

  // Tras usar (o cancelar) Avada en su paso → tip de tienda.
  useEffect(() => {
    if (stage !== 'avada') return
    if (aimingJokerCode === 'avada_kedavra') {
      sawAvadaAimRef.current = true
      return
    }
    if (sawAvadaAimRef.current && !aimingJokerCode) {
      const t = window.setTimeout(() => setStage('shop'), 450)
      return () => window.clearTimeout(t)
    }
  }, [stage, aimingJokerCode])

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

  const nextFor = (s: Stage): Stage | null => {
    switch (s) {
      case 'welcome':
        return 'move'
      case 'jokers':
        return 'shop'
      case 'avada':
        return 'shop'
      case 'shop':
        return 'freeplay'
      case 'dimension':
        return 'close'
      case 'close':
        return 'done'
      default:
        return null
    }
  }

  useEffect(() => {
    if (!visible || !tapAdvance) return
    function onPointerDown(e: PointerEvent) {
      if (performance.now() < stageReadyAtRef.current) return
      const el = e.target instanceof Element ? e.target : null

      // En comodines: click en la bandeja = interactuar, no saltar al tip del reloj.
      if (stage === 'jokers' && el?.closest('[data-tutorial="jokers"]')) return

      // En Avada: clicks en el tablero son para apuntar peones.
      if (stage === 'avada' && el?.closest('[data-tutorial="board"]')) return
      if (stage === 'avada' && aimingJokerCode === 'avada_kedavra') return

      const next = nextFor(stage)
      if (next) setStage(next)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [visible, tapAdvance, stage, aimingJokerCode])

  if (stage === 'done') return null

  const dim = getDimension(dimensionId)

  const content: Record<Exclude<Stage, 'done'>, { label: string; text: string; hint?: string }> = {
    welcome: {
      label: 'Bienvenida',
      text: '¡Bienvenido a tu partida tutorial! Juegas con blancas contra un bot, sin presión. Este es tu reloj: aquí el tiempo también es tu moneda.',
      hint: 'Toca para continuar',
    },
    move: {
      label: 'Mover piezas',
      text: 'Te toca: arrastra una pieza o haz click en origen y destino. Los puntos sobre el tablero marcan los movimientos legales. ¡Prueba con un peón!',
    },
    jokers: {
      label: 'Comodines',
      text:
        jokerCount > 0
          ? `¡Regalo de bienvenida! Tienes ${jokerCount === 1 ? 'un comodín' : `${jokerCount} comodines`} en la bandeja inferior. Pasa el cursor por encima para leer qué hace cada carta. Prueba a hacer click en Avada Kedavra.`
          : 'Tus comodines viven en la bandeja inferior. Pasa el cursor por encima de cada carta para leer qué hace; haz click para activarla.',
      hint: 'Toca fuera de las cartas para seguir · o elige Avada',
    },
    avada: {
      label: 'Avada Kedavra',
      text: 'Con Avada apuntas una casilla: elige un peón enemigo (las casillas válidas brillan). El rey es inmune — no sirve contra él. Cuando elijas la víctima, el hechizo se lanza solo.',
      hint: aimingJokerCode === 'avada_kedavra' ? 'Elige un peón en el tablero' : 'Toca para continuar',
    },
    shop: {
      label: 'Tienda',
      text: 'Cuando termine esta fase se abre la tienda: podrás gastar segundos de este reloj para comprar más comodines. Compra con cabeza, el reloj no vuelve.',
      hint: 'Toca para continuar',
    },
    freeplay: {
      label: 'Tu turno',
      text: shopVisitedRef.current
        ? 'Sigue jugando y prueba tus comodines. Cuando cambie la dimensión te aviso por aquí.'
        : 'Sigue jugando con calma. Te aviso cuando pase algo nuevo: la tienda o un cambio de dimensión.',
    },
    dimension: {
      label: dim.title,
      text: `¡La grieta se abrió! Ahora juegas en ${dim.title}: ${dim.blurb} El panel de la izquierda siempre describe la dimensión activa.`,
      hint: 'Toca para continuar',
    },
    close: {
      label: 'Listo',
      text: '¡Eso es todo! Ya conoces tablero, comodines, tienda y dimensiones. Cuando quieras salir, usa el logo RogueChess o el botón de arriba.',
      hint: 'Toca para cerrar la guía',
    },
  }

  const step = content[stage]

  // Padding del foco: el reloj es un chip pequeño → menos aire.
  const pad = target === 'clock' ? 6 : 10

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
          <AnimatePresence>
            {rect ? (
              <motion.div
                key={`spot-${target}`}
                className="rc-tutorial-spotlight pointer-events-none fixed z-[80] rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: easeOut }}
                style={{
                  top: rect.top - pad,
                  left: rect.left - pad,
                  width: rect.width + pad * 2,
                  height: rect.height + pad * 2,
                }}
              />
            ) : null}
          </AnimatePresence>

          {/*
            Móvil: strip arriba. sm+: mascota abajo-derecha.
            Con aim activo el banner de apuntado manda → ocultamos el globo en móvil
            para no apilar overlays encima del tablero.
          */}
          <div
            className={`rc-match-mascot pointer-events-none fixed left-2 right-2 z-[85] flex max-w-none flex-col items-center gap-2 sm:bottom-1 sm:left-auto sm:right-2 sm:top-auto sm:max-w-[340px] sm:items-end lg:max-w-[360px] ${
              aimingJokerCode ? 'top-auto bottom-[max(5.5rem,var(--rc-safe-bottom))] sm:bottom-1' : 'top-14'
            }`}
          >
            <div
              className={`pointer-events-none mb-1 w-full max-w-[min(92vw,320px)] sm:max-w-[270px] ${
                aimingJokerCode ? 'hidden sm:block' : ''
              }`}
            >
              <AnimatePresence mode="wait">
                <MascotSpeech
                  key={stage}
                  label={`Tutorial · ${step.label}`}
                  dark={dark}
                  tail={aimingJokerCode ? 'right' : 'none'}
                  className="w-full"
                >
                  <p>{step.text}</p>
                  {step.hint ? (
                    <p className="font-label mt-2.5 text-[9px] uppercase tracking-[0.16em] opacity-55">
                      {step.hint}
                    </p>
                  ) : null}
                </MascotSpeech>
              </AnimatePresence>
            </div>

            <img
              src="/mascot/bishop-game.webp"
              alt=""
              className="rc-match-mascot-img hidden max-h-[min(52dvh,440px)] w-auto max-w-[280px] object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.32)] sm:block lg:max-h-[480px] lg:max-w-[300px]"
              draggable={false}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
