import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { DimensionEnv } from '@/components/match/DimensionEnv'
import { JokerClockFx, type ClockFxEvent } from '@/components/match/JokerClockFx'
import { JokerFxOverlay } from '@/components/match/JokerFxOverlay'
import { PageTransition } from '@/components/PageTransition'
import { piecesForDimension } from '@/lib/dimPieces'
import { getDimension, isDarkDimension } from '@/lib/dimensions'
import { jokerArtUrl } from '@/lib/jokerArt'
import {
  area3x3,
  getJokerFxSpec,
  listJokerFxCodes,
  type JokerFxKind,
} from '@/lib/jokerFx'
import { cn } from '@/lib/utils'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const LAB_DIM = 'primo' as const

/** Casillas demo al castear en lab (sin partida real). */
function demoCastSquares(code: string): string[] {
  const spec = getJokerFxSpec(code)
  if (
    spec.stage === 'boardCenter' ||
    spec.stage === 'shield' ||
    spec.stage === 'clockSteal' ||
    spec.stage === 'clockFreeze' ||
    spec.stage === 'clockHaste'
  ) {
    return []
  }
  if (code === 'bombarda') return area3x3('e4')
  if (code === 'aparicion') return ['b1', 'b8']
  if (code === 'capa_invisibilidad') return ['e2']
  if (code === 'avada_kedavra' || code === 'morsmordre') return ['d7']
  if (code === 'defodio') return ['c4']
  if (code === 'imperius') return ['d5']
  if (code === 'pocion_multijugos') return ['e2']
  return ['e4']
}

/**
 * Laboratorio de FX de comodines — reproducir cast / aim / reloj sin partida.
 * Ruta: /lab/jokers
 */
export function JokerLabPage() {
  const codes = useMemo(() => listJokerFxCodes(), [])
  const [selected, setSelected] = useState(codes[0] ?? 'bombarda')
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [aimPreview, setAimPreview] = useState(false)
  const [boardFx, setBoardFx] = useState<{
    squares: string[]
    kind: JokerFxKind
    durationMs: number
  } | null>(null)
  const [burst, setBurst] = useState<{ squares: string[]; code: string; at: number } | null>(
    null,
  )
  const [clockFx, setClockFx] = useState<ClockFxEvent | null>(null)
  const timers = useRef<{ board?: number; burst?: number; clock?: number }>({})

  const spec = getJokerFxSpec(selected)
  const dimMeta = getDimension(LAB_DIM)
  const dark = isDarkDimension(LAB_DIM)
  const dimPieces = useMemo(() => piecesForDimension(dark), [dark])

  const clearTimers = () => {
    if (timers.current.board != null) window.clearTimeout(timers.current.board)
    if (timers.current.burst != null) window.clearTimeout(timers.current.burst)
    if (timers.current.clock != null) window.clearTimeout(timers.current.clock)
    timers.current = {}
  }

  const play = useCallback(() => {
    clearTimers()
    setAimPreview(false)
    const castSquares = demoCastSquares(selected)
    const s = getJokerFxSpec(selected)

    if (s.stage === 'clockSteal' || s.stage === 'clockFreeze' || s.stage === 'clockHaste') {
      setBoardFx(null)
      setBurst(null)
      setClockFx({ code: selected, at: Date.now(), youSide: 'bottom' })
      timers.current.clock = window.setTimeout(() => setClockFx(null), s.durationMs + 200)
      return
    }

    if (s.stage === 'boardCenter' || s.stage === 'shield') {
      setBoardFx(null)
      setClockFx(null)
      setBurst({ squares: [], code: selected, at: Date.now() })
      timers.current.burst = window.setTimeout(() => setBurst(null), s.durationMs + 80)
      return
    }

    setClockFx(null)
    if (castSquares.length) {
      setBoardFx({ squares: castSquares, kind: s.kind, durationMs: s.durationMs })
      timers.current.board = window.setTimeout(() => setBoardFx(null), s.durationMs + 40)
    } else {
      setBoardFx(null)
    }
    setBurst({ squares: castSquares, code: selected, at: Date.now() })
    timers.current.burst = window.setTimeout(() => setBurst(null), s.durationMs + 80)
  }, [selected])

  const aim = useMemo(() => {
    if (!aimPreview) return null
    if (
      spec.stage === 'boardCenter' ||
      spec.stage === 'shield' ||
      spec.stage === 'clockSteal' ||
      spec.stage === 'clockFreeze' ||
      spec.stage === 'clockHaste'
    ) {
      return null
    }
    const squares = demoCastSquares(selected)
    if (!squares.length) return null
    return { squares, theme: spec.theme, code: selected }
  }, [aimPreview, selected, spec.stage, spec.theme])

  const squareStyles = useMemo(() => {
    if (!boardFx) return undefined
    const styles: Record<string, React.CSSProperties> = {}
    for (const sq of boardFx.squares) {
      styles[sq] = {
        animationName: `rc-joker-${boardFx.kind}`,
        animationDuration: `${Math.max(0.45, boardFx.durationMs / 1000)}s`,
        animationTimingFunction: 'ease-out',
        animationFillMode: 'both',
        animationIterationCount: 1,
      }
    }
    return styles
  }, [boardFx])

  return (
    <PageTransition
      className={cn(
        'rc-match-dim relative flex min-h-0 flex-1 flex-col overflow-hidden',
        `rc-match-dim--${LAB_DIM}`,
      )}
    >
      <DimensionEnv theme={LAB_DIM} persistent intensity={0.55} />

      <div className="relative z-[1] mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-auto px-3 pb-[max(1rem,var(--rc-safe-bottom))] pt-4 sm:gap-4 sm:px-6 sm:py-6">
        <header>
          <Link
            to="/lab"
            className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)] hover:opacity-80"
          >
            ← Lab
          </Link>
          <p className="font-label mt-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
            Laboratorio · comodines
          </p>
          <h1 className="font-display mt-2 text-2xl text-[var(--color-ink)] sm:text-3xl">FX de comodines</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">
            Reproduce cada animación (cast, aim, ritual, reloj) sin partida. Misma atmósfera y
            tablero que en juego.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-6">
          <div className="flex flex-col items-center gap-3">
            <div className={cn('rc-board-stage relative w-[min(100%,420px,calc(100dvh-280px))] sm:w-[min(100%,420px)]', `rc-board-stage--${LAB_DIM}`)}>
              <JokerClockFx event={clockFx} />
              <Chessboard
                options={{
                  id: 'lab-joker-board',
                  position: START_FEN,
                  boardOrientation: orientation,
                  allowDragging: false,
                  pieces: dimPieces,
                  squareStyles,
                  boardStyle: {
                    borderRadius: '4px',
                    boxShadow: dimMeta.board.frame
                      ? `0 0 0 1px ${dimMeta.board.frame}, 0 18px 50px rgba(0,0,0,0.35)`
                      : '0 12px 40px rgba(0,0,0,0.2)',
                  },
                  lightSquareStyle: { backgroundColor: dimMeta.board.light },
                  darkSquareStyle: { backgroundColor: dimMeta.board.dark },
                }}
              />
              <JokerFxOverlay orientation={orientation} aim={aim} burst={burst} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" className="btn-primary !px-4 !py-2 text-sm" onClick={play}>
                Reproducir cast
              </button>
              <button
                type="button"
                className="btn-ghost !px-3 !py-2 text-sm"
                disabled={
                  spec.stage === 'boardCenter' ||
                  spec.stage === 'shield' ||
                  spec.stage.startsWith('clock')
                }
                onClick={() => setAimPreview((v) => !v)}
              >
                {aimPreview ? 'Ocultar aim' : 'Preview aim'}
              </button>
              <button
                type="button"
                className="btn-ghost !px-3 !py-2 text-sm"
                onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              >
                Girar tablero
              </button>
            </div>
            <p className="font-label text-center text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              stage · {spec.stage} · kind · {spec.kind} · {spec.durationMs}ms
            </p>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex items-center gap-3 border border-[var(--color-outline-soft)]/40 bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] p-3">
              <img
                src={jokerArtUrl(selected)}
                alt=""
                className="h-16 w-12 object-contain bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)]"
                draggable={false}
              />
              <div className="min-w-0">
                <p className="font-display text-lg text-[var(--color-ink)]">{spec.label}</p>
                <p className="truncate font-label text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                  {selected} · {spec.theme}
                </p>
              </div>
            </div>
            <ul className="grid max-h-[min(42vh,420px)] gap-1 overflow-auto sm:max-h-[min(58vh,520px)] sm:grid-cols-1">
              {codes.map((code) => {
                const s = getJokerFxSpec(code)
                const active = code === selected
                return (
                  <li key={code}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(code)
                        setAimPreview(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 border px-2 py-2 text-left transition',
                        active
                          ? 'border-[var(--color-primary)]/50 bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]'
                          : 'border-transparent hover:border-[var(--color-outline-soft)]/40',
                      )}
                    >
                      <img
                        src={jokerArtUrl(code)}
                        alt=""
                        className="h-10 w-7 shrink-0 object-contain bg-[color-mix(in_srgb,var(--color-ink)_8%,transparent)]"
                        draggable={false}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-[var(--color-ink)]">
                          {s.label}
                        </span>
                        <span className="font-label text-[9px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                          {s.stage}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
