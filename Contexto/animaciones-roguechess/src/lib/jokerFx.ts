import { Chess } from 'chess.js'
import type { PieceFlag } from '@/types/match'

/** Temas visuales alineados a facciones del Documento Maestro. */
export type JokerFxTheme = 'spectral' | 'antimatter' | 'tempus' | 'patronum'

/** Animación de casilla (cuando aplica). */
export type JokerFxKind =
  | 'swap'
  | 'vanish'
  | 'burn'
  | 'spectral'
  | 'fear'
  | 'tempus'
  | 'crystal'
  | 'trap'
  | 'patronum'
  | 'steal'
  | 'freeze'
  | 'haste'
  | 'ghost'
  | 'blur'

/**
 * Dónde vive el FX al castear — evita “todas las piezas” en passives.
 * - targets: solo casillas del payload
 * - boardCenter: ritual central (no piezas)
 * - clock*: HUD de reloj
 * - pieceBlur: difumina la pieza objetivo (y queda persistente vía flags)
 */
export type JokerFxStage =
  | 'targets'
  | 'boardCenter'
  | 'clockSteal'
  | 'clockFreeze'
  | 'clockHaste'
  | 'pieceBlur'
  | 'shield'

export type JokerFxSpec = {
  theme: JokerFxTheme
  kind: JokerFxKind
  stage: JokerFxStage
  durationMs: number
  burstCount: number
  label: string
}

const SPECS: Record<string, JokerFxSpec> = {
  // Espectral
  paso_fantasma: {
    theme: 'spectral',
    kind: 'ghost',
    stage: 'boardCenter',
    durationMs: 1100,
    burstCount: 0,
    label: 'Paso Fantasma',
  },
  imperius: {
    theme: 'spectral',
    kind: 'spectral',
    stage: 'targets',
    durationMs: 900,
    burstCount: 14,
    label: 'Imperius',
  },
  capa_invisibilidad: {
    theme: 'spectral',
    kind: 'blur',
    stage: 'pieceBlur',
    durationMs: 900,
    burstCount: 10,
    label: 'Capa',
  },
  morsmordre: {
    theme: 'spectral',
    kind: 'fear',
    stage: 'targets',
    durationMs: 850,
    burstCount: 12,
    label: 'Morsmordre',
  },
  expecto_patronum: {
    theme: 'patronum',
    kind: 'patronum',
    stage: 'shield',
    durationMs: 1200,
    burstCount: 0,
    label: 'Expecto Patronum',
  },
  // Antimateria
  bombarda: {
    theme: 'antimatter',
    kind: 'burn',
    stage: 'targets',
    durationMs: 1000,
    burstCount: 18,
    label: 'Bombarda',
  },
  aparicion: {
    theme: 'antimatter',
    kind: 'swap',
    stage: 'targets',
    durationMs: 820,
    burstCount: 10,
    label: 'Aparición',
  },
  pocion_multijugos: {
    theme: 'antimatter',
    kind: 'crystal',
    stage: 'targets',
    durationMs: 950,
    burstCount: 14,
    label: 'Multijugos',
  },
  defodio: {
    theme: 'antimatter',
    kind: 'trap',
    stage: 'targets',
    durationMs: 900,
    burstCount: 12,
    label: 'Defodio',
  },
  avada_kedavra: {
    theme: 'antimatter',
    kind: 'vanish',
    stage: 'targets',
    durationMs: 780,
    burstCount: 16,
    label: 'Avada Kedavra',
  },
  // Tempus — FX en reloj, no en piezas
  axio_tempus: {
    theme: 'tempus',
    kind: 'steal',
    stage: 'clockSteal',
    durationMs: 1400,
    burstCount: 0,
    label: 'Axio Tempus',
  },
  arresto_momentum: {
    theme: 'tempus',
    kind: 'haste',
    stage: 'clockHaste',
    durationMs: 1300,
    burstCount: 0,
    label: 'Arresto Momentum',
  },
  petrificus_totalus: {
    theme: 'tempus',
    kind: 'freeze',
    stage: 'clockFreeze',
    durationMs: 1200,
    burstCount: 0,
    label: 'Petrificus',
  },
  giratiempo: {
    theme: 'tempus',
    kind: 'tempus',
    stage: 'boardCenter',
    durationMs: 1100,
    burstCount: 0,
    label: 'Giratiempo',
  },
}

export function getJokerFxSpec(code: string): JokerFxSpec {
  return (
    SPECS[code] ?? {
      theme: 'spectral',
      kind: 'spectral',
      stage: 'targets',
      durationMs: 700,
      burstCount: 10,
      label: code,
    }
  )
}

export function area3x3(center: string): string[] {
  const file = center.charCodeAt(0) - 97
  const rank = Number(center[1]) - 1
  const out: string[] = []
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const f = file + df
      const r = rank + dr
      if (f < 0 || f > 7 || r < 0 || r > 7) continue
      out.push(String.fromCharCode(97 + f) + String(r + 1))
    }
  }
  return out
}

function isAdjacent(a: string, b: string): boolean {
  const df = Math.abs(a.charCodeAt(0) - b.charCodeAt(0))
  const dr = Math.abs(Number(a[1]) - Number(b[1]))
  return df <= 1 && dr <= 1 && !(df === 0 && dr === 0)
}

/** Casillas elegibles para apuntar (partículas en piezas / casillas válidas). */
export function getJokerAimSquares(opts: {
  code: string
  fen: string
  youColor: 'white' | 'black'
  flags?: PieceFlag[]
  slotIndex: number
}): string[] {
  const { code, fen, youColor, flags = [], slotIndex } = opts
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return []
  }
  const me = youColor === 'white' ? 'w' : 'b'
  const enemy = me === 'w' ? 'b' : 'w'
  const board = chess.board()
  const squares: string[] = []

  const every = (
    pred: (sq: string, piece: { type: string; color: string } | null) => boolean,
  ) => {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = String.fromCharCode(97 + f) + String(8 - r)
        const piece = board[r]?.[f] ?? null
        if (pred(sq, piece ? { type: piece.type, color: piece.color } : null)) {
          squares.push(sq)
        }
      }
    }
  }

  switch (code) {
    case 'aparicion':
    case 'capa_invisibilidad':
      every((_sq, p) => Boolean(p && p.color === me))
      break
    case 'bombarda':
    case 'pocion_multijugos':
      every((_sq, p) => Boolean(p && p.color === me && p.type === 'p'))
      break
    case 'imperius':
      if (slotIndex === 0) {
        every((_sq, p) => Boolean(p && p.color === enemy && p.type !== 'k'))
      }
      break
    case 'avada_kedavra':
      every((sq, p) => {
        if (!p || p.color !== enemy || p.type === 'k') return false
        if (p.type === 'p') return true
        return flags.some((f) => f.square === sq && f.was_pawn && f.color !== youColor)
      })
      break
    case 'morsmordre': {
      const own: string[] = []
      every((sq, p) => {
        if (p?.color === me) own.push(sq)
        return false
      })
      every((sq, p) => {
        if (!p || p.color !== enemy || p.type === 'k') return false
        return own.some((o) => isAdjacent(o, sq))
      })
      break
    }
    case 'defodio':
      every((_sq, p) => p == null)
      break
    default:
      break
  }

  return squares
}

/**
 * Casillas de burst al castear.
 * Passives / reloj → [] (el FX va a stage boardCenter/clock*).
 */
export function getJokerCastSquares(
  code: string,
  payload: Record<string, unknown>,
): string[] {
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

  if (code === 'bombarda' && typeof payload.square === 'string') {
    return area3x3(payload.square)
  }

  const picked = [
    payload.square,
    payload.a,
    payload.b,
    payload.from,
    payload.to,
  ].filter((s): s is string => typeof s === 'string')

  return [...new Set(picked)]
}

export function squareToGrid(
  square: string,
  orientation: 'white' | 'black',
): { col: number; row: number } {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  if (orientation === 'white') {
    return { col: file, row: 7 - rank }
  }
  return { col: 7 - file, row: rank }
}

/** Casillas con capa activa (blur persistente para el dueño). */
export function invisibleSquaresForViewer(
  flags: PieceFlag[] | undefined,
  viewerColor: 'white' | 'black' | undefined,
): string[] {
  if (!flags?.length || !viewerColor) return []
  return flags
    .filter((f) => f.is_invisible && f.square && f.color === viewerColor)
    .map((f) => f.square!)
}
