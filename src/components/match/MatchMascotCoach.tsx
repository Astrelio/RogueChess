import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getDimension, type DimensionTheme } from '@/lib/dimensions'
import { easeOut } from '@/lib/motion'

const TIPS: Record<DimensionTheme, string[]> = {
  primo: [
    'Tablero Primo: ajedrez clásico. Sin rarezas… todavía.',
    'Usa este tramo para colocar piezas y ganar tempo.',
    'El mercado llega después: cuida tu reloj.',
    'Primo es el respiro: coloca bien y guarda segundos para comprar.',
    'Cada pieza cuenta. El mercado no te las devuelve.',
  ],
  espejo: [
    'Espejo: lo que mueves se invierte… excepto el rey.',
    'Tu rey se mueve normal. El resto del ejército, al revés.',
    'Los peones caminan hacia tu propio bando, pero no entran en tu fila base.',
    'Antes de soltar una pieza (no el rey), mira el destino invertido.',
    'Si te mareas, es normal: el tablero también está del revés.',
  ],
  bluriel: [
    'Bluriel: tras mover, tus piezas se ven borrosas al rival.',
    'El jaque siempre se anuncia, aunque la pieza esté borrosa.',
    'Usa la niebla para esconder planes… no para olvidar el jaque.',
    'Si el rival no ve claro, tú sí: no pierdas el hilo.',
    'Niebla y misterio… pero el jaque sigue siendo jaque.',
  ],
  gravitacional: [
    'Gravedad: dama, torre y alfil solo llegan a 3 casillas.',
    'Más lejos no dan jaque ni clavan. Acerca las piezas.',
    'Si tu torre “casi” llega, no llega: son tres casillas.',
    'Las damas dramáticas sufren aquí. Corto y al pie.',
    'Movilidad corta: el centro cerca vale más que el alcance largo.',
  ],
  cadena_sangre: [
    'Cadena de Sangre: si puedes capturar, debes capturar.',
    'El rey puede escapar sin capturar. El resto, no.',
    'No cuentan las capturas que dejen a tu rey en jaque.',
    'Fuerza capturas y atrapa al rival en la cadena.',
    'Obligación de captura: planifica con eso en mente.',
  ],
  ruina: [
    'Ruina: cada captura deja una zona muerta.',
    'Nadie pisa ni atraviesa esa casilla… salvo el rey y el caballo.',
    'El rey es inmune: puede pisar zonas muertas para escapar.',
    'Captura con cabeza: cada bocado deja un cráter.',
    'El caballo es tu mejor amigo en este terreno roto.',
  ],
  mercado_negro: [
    'Mercado Negro: los monolitos regalan tiempo.',
    'Písalos o atraviésalos para sumar segundos.',
    'Capturar también suma reloj a tu favor.',
    'Si vas justo de tiempo, caza monolitos.',
    'El reloj es moneda: cada segundo cuenta en la tienda.',
  ],
  fragilidad: [
    'Fragilidad: dos amenazas sobre la misma pieza… y estalla.',
    'Al final del turno, esa pieza se destroza sola (el rey no).',
    'No apuntes con dos piezas a la vez… salvo que quieras drama.',
    'Dos miradas fijas y, al cerrar el turno, ¡crack!',
    'Presiona en pareja: la fragilidad castiga la sobreprotección fallida.',
  ],
}

type Props = {
  dimensionId: string
  /** Visible solo cuando el tablero está en juego (no durante reveal). */
  open: boolean
  dark?: boolean
  /** Oculta el tip en móvil mientras se apunta un comodín (evita solaparse con el banner). */
  aiming?: boolean
}

/**
 * Mascota Bishop Game + globo de tips. No pausa: rota frases durante la partida.
 */
export function MatchMascotCoach({ dimensionId, open, dark, aiming }: Props) {
  const dim = getDimension(dimensionId)
  const tips = TIPS[dim.id] ?? TIPS.primo
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    setTipIndex(0)
  }, [dim.id])

  useEffect(() => {
    if (!open || tips.length < 2) return
    const t = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length)
    }, 20000)
    return () => window.clearInterval(t)
  }, [open, tips, dim.id])

  const phrase = tips[tipIndex % tips.length] ?? dim.blurb

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bishop-coach"
          className="rc-match-mascot pointer-events-none fixed left-2 right-2 top-14 z-[2] flex max-w-none flex-col items-center gap-2 sm:absolute sm:bottom-1 sm:left-auto sm:right-0 sm:top-auto sm:max-w-[340px] sm:items-end lg:max-w-[360px]"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={{ duration: 0.4, ease: easeOut }}
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            {!aiming ? (
              <motion.div
                key={`${dim.id}-${tipIndex}`}
                className={`rc-mascot-bubble relative mb-1 w-full max-w-[min(92vw,320px)] rounded-2xl px-2.5 py-2 text-left text-[11px] leading-snug shadow-[0_10px_28px_rgba(0,0,0,0.22)] sm:max-w-[250px] sm:px-3 sm:py-2.5 sm:text-[12px] ${
                  dark
                    ? 'bg-[color-mix(in_srgb,#1a1520_92%,transparent)] text-[#f0e8dc] ring-1 ring-white/10'
                    : 'bg-[color-mix(in_srgb,#fffdf8_94%,transparent)] text-[var(--color-ink)] ring-1 ring-black/8'
                }`}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.35, ease: easeOut }}
              >
                <p className="font-label mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--color-primary)]">
                  Bishop · {dim.title}
                </p>
                <p>{phrase}</p>
                <span
                  className={`absolute -bottom-1.5 right-8 hidden h-3 w-3 rotate-45 sm:block ${
                    dark ? 'bg-[#1a1520]' : 'bg-[#fffdf8]'
                  }`}
                  aria-hidden
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <img
            src="/mascot/bishop-game.webp"
            alt=""
            className="rc-match-mascot-img hidden max-h-[min(52dvh,440px)] w-auto max-w-[280px] object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.32)] sm:block lg:max-h-[480px] lg:max-w-[300px]"
            draggable={false}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
