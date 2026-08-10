import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { DimensionEnv } from '@/components/match/DimensionEnv'
import { DimensionReveal } from '@/components/match/DimensionReveal'
import { PageTransition } from '@/components/PageTransition'
import { MONOLITH_HOURGLASS_BG, RUINED_DEBRIS_BG } from '@/lib/boardDecor'
import { piecesForDimension } from '@/lib/dimPieces'
import {
  getDimension,
  isDarkDimension,
  listDimensions,
  normalizeDimensionId,
  type DimensionTheme,
} from '@/lib/dimensions'
import { cn } from '@/lib/utils'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/**
 * Laboratorio visual de dimensiones (solo testeo de atmósfera / reveal / tablero).
 * Índice: /lab · Detalle: /lab/:dimensionId
 */
export function DimensionLabPage() {
  const { dimensionId } = useParams()

  if (!dimensionId) {
    return <LabIndex />
  }

  const id = normalizeDimensionId(dimensionId)
  // Alias (sangre, mercado, …) → id canónico
  if (dimensionId !== id) {
    return <Navigate to={`/lab/${id}`} replace />
  }

  return <LabDetail theme={id} />
}

function LabIndex() {
  const dims = listDimensions()
  return (
    <PageTransition className="relative z-[1] mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
      <p className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
        Laboratorio · solo testeo
      </p>
      <h1 className="font-display mt-2 text-2xl text-[var(--color-ink)] sm:text-3xl">Dimensiones</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
        Entra a cada una para ver atmósfera, tablero y el reveal de la grieta.
      </p>
      <ul className="mt-6 grid gap-2 sm:mt-8 sm:grid-cols-2">
        <li className="sm:col-span-2">
          <Link
            to="/lab/jokers"
            className="block border border-[var(--color-primary)]/35 bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] px-4 py-3 transition hover:border-[var(--color-primary)]/60"
          >
            <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">
              Comodines · FX
            </p>
            <p className="font-display mt-1 text-lg text-[var(--color-ink)]">
              Laboratorio de animaciones
            </p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Reproduce cast, aim, rituales y FX de reloj de cada comodín.
            </p>
          </Link>
          <Link
            to="/comodines"
            className="mt-2 block border border-[var(--color-outline-soft)]/50 bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] px-4 py-3 transition hover:border-[var(--color-primary)]/40"
          >
            <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
              Galería
            </p>
            <p className="font-display mt-1 text-lg text-[var(--color-ink)]">Ver todas las cartas</p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Ilustraciones grandes y ficha al tocar o pasar el cursor.
            </p>
          </Link>
        </li>
        {dims.map((d) => (
          <li key={d.id}>
            <Link
              to={`/lab/${d.id}`}
              className="block border border-[var(--color-outline-soft)]/50 bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] px-4 py-3 transition hover:border-[var(--color-primary)]/40"
            >
              <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                {d.eyebrow}
              </p>
              <p className="font-display mt-1 text-lg text-[var(--color-ink)]">{d.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--color-ink-muted)]">{d.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-[var(--color-ink-muted)]">
        Ruta: <code className="text-[var(--color-primary)]">/lab</code> ·{' '}
        <code className="text-[var(--color-primary)]">/lab/cadena_sangre</code>
      </p>
    </PageTransition>
  )
}

function LabDetail({ theme }: { theme: DimensionTheme }) {
  const info = getDimension(theme)
  const dark = isDarkDimension(theme)
  const dimPieces = useMemo(() => piecesForDimension(dark), [dark])
  const [revealId, setRevealId] = useState<string | null>(null)
  const [intensity, setIntensity] = useState(0.75)

  const demoSquares = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}
    if (theme === 'mercado_negro') {
      for (const sq of ['c4', 'f5', 'd3', 'e6']) {
        styles[sq] = {
          backgroundColor: 'rgba(212, 175, 55, 0.22)',
          backgroundImage: MONOLITH_HOURGLASS_BG,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: '42%',
          boxShadow: 'inset 0 0 0 2px rgba(212, 175, 55, 0.5)',
          animationName: 'rc-monolith-bob',
          animationDuration: '2.4s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }
      }
    }
    if (theme === 'ruina') {
      for (const sq of ['c5', 'e4', 'f6', 'b3']) {
        styles[sq] = {
          backgroundColor: 'rgba(40, 36, 30, 0.55)',
          backgroundImage: RUINED_DEBRIS_BG,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 'inset 0 0 0 2px rgba(30, 26, 22, 0.55)',
        }
      }
    }
    return styles
  }, [theme])

  const siblings = listDimensions()
  const idx = siblings.findIndex((d) => d.id === theme)
  const prev = siblings[(idx - 1 + siblings.length) % siblings.length]
  const next = siblings[(idx + 1) % siblings.length]

  return (
    <PageTransition
      className={cn(
        'rc-match-dim relative flex min-h-0 flex-1 flex-col overflow-hidden',
        `rc-match-dim--${theme}`,
      )}
    >
      <DimensionEnv theme={theme} persistent intensity={intensity} />

      <DimensionReveal dimensionId={revealId} onDismiss={() => setRevealId(null)} />

      <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-[max(0.75rem,var(--rc-safe-bottom))] pt-3 sm:px-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/lab"
              className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)] hover:opacity-80"
            >
              ← Lab
            </Link>
            <p className="font-label mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">
              {info.eyebrow}
            </p>
            <h1 className="font-display mt-1 text-2xl text-[var(--color-ink)] sm:text-3xl">
              {info.title}
            </h1>
            <p className="mt-2 max-w-md text-sm text-[var(--color-ink-muted)]">{info.blurb}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/lab/${prev.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">
              ← {prev.title.replace(/^Dimensión\s+/i, '').replace(/^Tablero\s+/i, '')}
            </Link>
            <Link to={`/lab/${next.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">
              {next.title.replace(/^Dimensión\s+/i, '').replace(/^Tablero\s+/i, '')} →
            </Link>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary !px-3 !py-1.5 text-xs"
            onClick={() => setRevealId(theme)}
          >
            Replay reveal
          </button>
          <label className="font-label flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
            Intensidad
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.05}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-28"
            />
            <span className="tabular-nums">{intensity.toFixed(2)}</span>
          </label>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-2">
          <div className={cn('rc-board-stage w-[min(100%,420px)]', `rc-board-stage--${theme}`)}>
            <Chessboard
              options={{
                id: `lab-board-${theme}`,
                position: START_FEN,
                allowDragging: false,
                pieces: dimPieces,
                squareStyles: demoSquares,
                boardStyle: {
                  borderRadius: '4px',
                  boxShadow: info.board.frame
                    ? `0 0 0 1px ${info.board.frame}, 0 18px 50px rgba(0,0,0,0.35)`
                    : '0 12px 40px rgba(0,0,0,0.2)',
                },
                lightSquareStyle: { backgroundColor: info.board.light },
                darkSquareStyle: { backgroundColor: info.board.dark },
              }}
            />
          </div>

          <p className="font-label text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
            light {info.board.light} · dark {info.board.dark}
            {theme === 'mercado_negro' ? ' · monolitos = reloj de arena' : ''}
            {theme === 'ruina' ? ' · casillas con escombros (demo)' : ''}
          </p>
        </div>
      </div>
    </PageTransition>
  )
}
