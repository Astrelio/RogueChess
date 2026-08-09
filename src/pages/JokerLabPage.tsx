import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { JokerClockFx, type ClockFxEvent } from '@/components/match/JokerClockFx'
import { JokerFxOverlay } from '@/components/match/JokerFxOverlay'
import { PageTransition } from '@/components/PageTransition'
import { jokerArtUrl } from '@/lib/jokerArt'
import {
  area3x3,
  getJokerFxSpec,
  listJokerFxCodes,
  type JokerFxKind,
} from '@/lib/jokerFx'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

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
    // Solo jokers con casillas tienen preview aim coherente
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
    <PageTransition className="relative z-[1] mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 overflow-auto px-4 py-6 sm:px-6">
      <div>
        <p className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
          Laboratorio · comodines
        </p>
        <h1 className="font-display mt-2 text-3xl text-[var(--color-ink)]">FX de comodines</h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">
          Reproducí cada animación del pack (cast, aim, ritual, reloj) sin partida. Si algo falla
          visualmente, anotalo y lo editamos.
        </p>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          <Link to="/lab" className="text-[var(--color-primary)] hover:underline">
            ← Dimensiones
          </Link>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="rc-board-stage relative w-[min(100%,420px)]">
            <JokerClockFx event={clockFx} />
            <Chessboard
              options={{
                id: 'lab-joker-board',
                position: START_FEN,
                boardOrientation: orientation,
                allowDragging: false,
                squareStyles,
                boardStyle: {
                  borderRadius: '4px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                },
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
          <div className="flex items-center gap-3 border border-[var(--color-outline-soft)]/40 bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] p-3">
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
          <ul className="grid max-h-[min(58vh,520px)] gap-1 overflow-auto sm:grid-cols-1">
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
                    className={`flex w-full items-center gap-2 border px-2 py-2 text-left transition ${
                      active
                        ? 'border-[var(--color-primary)]/50 bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]'
                        : 'border-transparent hover:border-[var(--color-outline-soft)]/40'
                    }`}
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
    </PageTransition>
  )
}
