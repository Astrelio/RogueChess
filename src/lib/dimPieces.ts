import { defaultPieces, type PieceRenderObject } from 'react-chessboard'

const BLACK = ['bP', 'bR', 'bN', 'bB', 'bQ', 'bK'] as const

/**
 * En dimensiones oscuras, resalta piezas negras (sobre todo peones)
 * con un halo claro para que no se pierdan en el tablero.
 */
export function piecesForDimension(dark: boolean): PieceRenderObject | undefined {
  if (!dark) return undefined
  const pieces: PieceRenderObject = { ...defaultPieces }
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
  return pieces
}
