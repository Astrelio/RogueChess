import { defaultPieces, type PieceRenderObject } from 'react-chessboard'

const BLACK = ['bP', 'bR', 'bN', 'bB', 'bQ', 'bK'] as const
const WHITE = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK'] as const

type DimPieceOpts = {
  /** Color enemigo a difuminar (niebla Bluriel en tu turno). */
  fogEnemy?: 'w' | 'b'
}

/**
 * En dimensiones oscuras, resalta piezas negras.
 * En Bluriel, difumina las piezas del enemigo mientras es tu turno.
 */
export function piecesForDimension(
  dark: boolean,
  opts?: DimPieceOpts,
): PieceRenderObject | undefined {
  if (!dark && !opts?.fogEnemy) return undefined
  const pieces: PieceRenderObject = { ...defaultPieces }
  if (dark) {
    for (const key of BLACK) {
      const base = defaultPieces[key]
      const isPawn = key === 'bP'
      pieces[key] = (props) =>
        base({
          ...props,
          fill: isPawn ? '#141414' : props?.fill,
          svgStyle: {
            ...props?.svgStyle,
            filter: isPawn
              ? 'drop-shadow(0 0 2px rgba(255,255,255,0.95)) drop-shadow(0 0 7px rgba(255,255,255,0.45))'
              : 'drop-shadow(0 0 1.5px rgba(255,255,255,0.55)) drop-shadow(0 0 4px rgba(255,255,255,0.25))',
          },
        })
    }
  }
  if (opts?.fogEnemy) {
    const keys = opts.fogEnemy === 'b' ? BLACK : WHITE
    for (const key of keys) {
      const base = pieces[key] ?? defaultPieces[key]
      pieces[key] = (props) =>
        base({
          ...props,
          svgStyle: {
            ...props?.svgStyle,
            filter: [
              props?.svgStyle?.filter,
              'blur(2.4px) saturate(0.55) opacity(0.52)',
            ]
              .filter(Boolean)
              .join(' '),
          },
        })
    }
  }
  return pieces
}
