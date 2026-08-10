import type { CSSProperties } from 'react'
import { Chess, type Square } from 'chess.js'
import { applyGhostMoveFen } from '@/lib/ghostMove'
import { applyMirrorPawnFen, mirrorCommand } from '@/lib/mirrorMove'
import type { BoardCell, PieceFlag } from '@/types/match'

export type IndicatorKind =
  | 'move'
  | 'capture'
  | 'blood_capture'
  | 'joker_hostile'
  | 'joker_ally'
  | 'joker_empty'
  | 'invisible'
  | 'selected'

function pathBetween(a: string, b: string): string[] {
  const df = b.charCodeAt(0) - a.charCodeAt(0)
  const dr = Number(b[1]) - Number(a[1])
  const straight = df === 0 || dr === 0
  const diagonal = Math.abs(df) === Math.abs(dr)
  if (!straight && !diagonal) return []
  const steps = Math.max(Math.abs(df), Math.abs(dr))
  if (steps <= 1) return []
  const sf = Math.sign(df)
  const sr = Math.sign(dr)
  const out: string[] = []
  for (let i = 1; i < steps; i++) {
    const file = a.charCodeAt(0) - 97 + sf * i
    const rank = Number(a[1]) - 1 + sr * i
    if (file < 0 || file > 7 || rank < 0 || rank > 7) break
    out.push(String.fromCharCode(97 + file) + String(rank + 1))
  }
  return out
}

function chebyshev(a: string, b: string) {
  return Math.max(
    Math.abs(b.charCodeAt(0) - a.charCodeAt(0)),
    Math.abs(Number(b[1]) - Number(a[1])),
  )
}

function isAdjacent(a: string, b: string) {
  return chebyshev(a, b) === 1
}

function allSquares(): string[] {
  const out: string[] = []
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) out.push(String.fromCharCode(97 + f) + r)
  }
  return out
}

export function blockedFromCells(cells: BoardCell[] | undefined): Set<string> {
  const set = new Set<string>()
  for (const c of cells ?? []) {
    if (c.is_active === false) continue
    if (c.effect === 'burned' || c.effect === 'ruined') set.add(String(c.square).trim())
  }
  return set
}

/** Solo ruina corta trayectoria; Bombarda (burned) se atraviesa. */
export function pathBlockedFromCells(cells: BoardCell[] | undefined): Set<string> {
  const set = new Set<string>()
  for (const c of cells ?? []) {
    if (c.is_active === false) continue
    if (c.effect === 'ruined') set.add(String(c.square).trim())
  }
  return set
}

function destOk(
  from: string,
  to: string,
  pieceType: string,
  landing: Set<string>,
  pathBlock: Set<string>,
  gravity: boolean,
): boolean {
  if (landing.has(to)) return false
  if (pieceType !== 'n') {
    for (const sq of pathBetween(from, to)) {
      if (pathBlock.has(sq)) return false
    }
  }
  if (gravity && (pieceType === 'q' || pieceType === 'r' || pieceType === 'b')) {
    if (chebyshev(from, to) > 3) return false
  }
  return true
}

export type LegalMovesOpts = {
  fen: string
  from: string
  color: 'white' | 'black'
  dimension: string
  /** No aterrizar (quemadas + ruina). */
  blocked: Set<string>
  /** Corta trayectoria (solo ruina). */
  pathBlocked?: Set<string>
  ghostActive?: boolean
  giratiempoBlockCaptures?: boolean
}

/**
 * Destinos a resaltar en el tablero (casillas de interacción).
 * En Espejo son las intenciones (donde soltar), no el aterrizaje efectivo.
 */
export function legalInteractionSquares(opts: LegalMovesOpts): {
  moves: string[]
  captures: string[]
} {
  const {
    fen,
    from,
    color,
    dimension,
    blocked,
    pathBlocked = new Set(),
    ghostActive,
    giratiempoBlockCaptures,
  } = opts
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return { moves: [], captures: [] }
  }
  const piece = chess.get(from as Square)
  if (!piece) return { moves: [], captures: [] }
  const me = color === 'white' ? 'w' : 'b'
  if (piece.color !== me) return { moves: [], captures: [] }

  const gravity = dimension === 'gravitacional'
  const mirror = dimension === 'espejo'
  const isKing = piece.type === 'k'

  type Cand = { interact: string; effective: string; capture: boolean }
  const cands: Cand[] = []

  const legal = chess.moves({ square: from as Square, verbose: true }) as Array<{
    from: string
    to: string
    captured?: string
  }>

  for (const m of legal) {
    // Rey: sin filtros dimensionales ni inversión espejo
    if (!isKing && !destOk(m.from, m.to, piece.type, blocked, pathBlocked, gravity)) continue
    if (m.captured === 'k') continue
    const interact = mirror && !isKing ? mirrorCommand(m.from, m.to) : m.to
    if (!interact || interact === m.from) continue
    cands.push({
      interact,
      effective: m.to,
      capture: Boolean(m.captured),
    })
  }

  // Peones espejo (hacia el propio bando) que chess.js no lista
  if (mirror && piece.type === 'p') {
    for (const sq of allSquares()) {
      if (sq === from) continue
      const fen2 = applyMirrorPawnFen(fen, from, sq, color, blocked, pathBlocked)
      if (!fen2) continue
      cands.push({
        interact: sq,
        effective: sq,
        capture: Boolean(chess.get(sq as Square)),
      })
    }
  }

  if (ghostActive) {
    for (const sq of allSquares()) {
      if (sq === from) continue
      const fen2 = applyGhostMoveFen(fen, from, sq, color, blocked, gravity, pathBlocked)
      if (!fen2) continue
      const target = chess.get(sq as Square)
      if (target?.type === 'k') continue
      const capture = Boolean(target)
      const interact = mirror ? mirrorCommand(from, sq) : sq
      if (!interact || interact === from) continue
      cands.push({ interact, effective: sq, capture })
    }
  }

  // Dedup por casilla de interacción
  const bySq = new Map<string, Cand>()
  for (const c of cands) {
    const prev = bySq.get(c.interact)
    if (!prev || (c.capture && !prev.capture)) bySq.set(c.interact, c)
  }
  let list = [...bySq.values()]

  if (giratiempoBlockCaptures) {
    list = list.filter((c) => !c.capture)
  }

  if (dimension === 'cadena_sangre' && !isKing) {
    const anyCap = list.some((c) => c.capture)
    if (anyCap) list = list.filter((c) => c.capture)
  }

  return {
    moves: list.filter((c) => !c.capture).map((c) => c.interact),
    captures: list.filter((c) => c.capture).map((c) => c.interact),
  }
}

export type JokerHighlightOpts = {
  code: string
  fen: string
  color: 'white' | 'black'
  dimension?: string
  flags: PieceFlag[] | undefined
  cells: BoardCell[] | undefined
  selected: string[]
  slotIndex: number
}

/** Casillas válidas para el slot actual del comodín en apuntado. */
export function jokerTargetSquares(opts: JokerHighlightOpts): {
  hostile: string[]
  ally: string[]
  empty: string[]
} {
  const { code, fen, color, dimension, flags, cells, selected, slotIndex } = opts
  const empty = { hostile: [] as string[], ally: [] as string[], empty: [] as string[] }
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return empty
  }
  const me = color === 'white' ? 'w' : 'b'
  const them = color === 'white' ? 'b' : 'w'
  const gravity = dimension === 'gravitacional'
  const blocked = blockedFromCells(cells)
  const pathBlocked = pathBlockedFromCells(cells)
  const anomaly = new Set(
    (cells ?? [])
      .filter((c) => c.is_active !== false && c.effect !== 'none')
      .map((c) => String(c.square).trim()),
  )

  const own: string[] = []
  const enemy: string[] = []
  const vacant: string[] = []
  for (const sq of allSquares()) {
    const p = chess.get(sq as Square)
    if (!p) vacant.push(sq)
    else if (p.color === me) own.push(sq)
    else enemy.push(sq)
  }

  switch (code) {
    case 'avada_kedavra': {
      const hostile = enemy.filter((sq) => {
        const p = chess.get(sq as Square)!
        if (p.type === 'k') return false
        if (p.type === 'p') return true
        return (flags ?? []).some(
          (f) => f.square === sq && f.color !== color && f.was_pawn,
        )
      })
      return { ...empty, hostile }
    }
    case 'morsmordre': {
      const hostile = enemy.filter((sq) => {
        const p = chess.get(sq as Square)!
        if (p.type === 'k') return false
        return own.some((o) => isAdjacent(o, sq))
      })
      return { ...empty, hostile }
    }
    case 'bombarda':
    case 'pocion_multijugos': {
      const ally = own.filter((sq) => chess.get(sq as Square)?.type === 'p')
      return { ...empty, ally }
    }
    case 'capa_invisibilidad':
      return { ...empty, ally: own }
    case 'aparicion': {
      if (slotIndex === 0) return { ...empty, ally: own }
      const first = selected[0]
      return { ...empty, ally: own.filter((sq) => sq !== first) }
    }
    case 'defodio': {
      return {
        ...empty,
        empty: vacant.filter((sq) => !anomaly.has(sq) && !blocked.has(sq)),
      }
    }
    case 'imperius': {
      if (slotIndex === 0) {
        return {
          ...empty,
          hostile: enemy.filter((sq) => chess.get(sq as Square)?.type !== 'k'),
        }
      }
      const from = selected[0]
      if (!from) return empty
      const piece = chess.get(from as Square)
      if (!piece || piece.color === me) return empty
      const dests: string[] = []
      for (const to of allSquares()) {
        if (to === from) continue
        if (!imperiusGeoOk(chess, from, to, piece.type, them, blocked, pathBlocked, gravity)) continue
        dests.push(to)
      }
      // Destinos: vacíos o piezas (fuego amigo) — marcar capturas como hostile, resto empty/ally
      const hostile: string[] = []
      const emptySq: string[] = []
      const ally: string[] = []
      for (const to of dests) {
        const occ = chess.get(to as Square)
        if (!occ) emptySq.push(to)
        else if (occ.color === me) ally.push(to)
        else hostile.push(to)
      }
      return { hostile, ally, empty: emptySq }
    }
    default:
      return empty
  }
}

function imperiusGeoOk(
  chess: Chess,
  from: string,
  to: string,
  type: string,
  pieceColor: 'w' | 'b',
  landing: Set<string>,
  pathBlock: Set<string>,
  gravity: boolean,
): boolean {
  const df = to.charCodeAt(0) - from.charCodeAt(0)
  const dr = Number(to[1]) - Number(from[1])
  const adf = Math.abs(df)
  const adr = Math.abs(dr)
  const straight = df === 0 || dr === 0
  const diagonal = adf === adr
  const occupiedDest = Boolean(chess.get(to as Square))
  const dest = chess.get(to as Square)
  if (dest?.type === 'k') return false

  switch (type) {
    case 'n':
      if (!((adf === 1 && adr === 2) || (adf === 2 && adr === 1))) return false
      break
    case 'r':
      if (!straight) return false
      break
    case 'b':
      if (!diagonal) return false
      break
    case 'q':
      if (!straight && !diagonal) return false
      break
    case 'p': {
      const dir = pieceColor === 'w' ? 1 : -1
      const startRank = pieceColor === 'w' ? 2 : 7
      const push =
        df === 0 &&
        (dr === dir || (dr === 2 * dir && Number(from[1]) === startRank)) &&
        !occupiedDest
      const capture = adf === 1 && dr === dir && occupiedDest
      if (!push && !capture) return false
      if (to[1] === '1' || to[1] === '8') return false
      break
    }
    default:
      return false
  }

  if (landing.has(to)) return false
  if (type !== 'n') {
    for (const sq of pathBetween(from, to)) {
      if (chess.get(sq as Square)) return false
      if (pathBlock.has(sq)) return false
    }
  }
  if (gravity && (type === 'q' || type === 'r' || type === 'b') && chebyshev(from, to) > 3) {
    return false
  }
  return true
}

export function ownInvisibleSquares(
  flags: PieceFlag[] | undefined,
  color: 'white' | 'black' | undefined,
): string[] {
  if (!flags?.length || !color) return []
  return flags
    .filter((f) => f.is_invisible && f.color === color && f.square)
    .map((f) => f.square!)
}

/** Estilos CSS para indicadores (animación vía keyframes globales). */
export function indicatorStyle(kind: IndicatorKind): CSSProperties {
  const base: CSSProperties = {
    animationDuration: '0.95s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  }
  switch (kind) {
    case 'move':
      return {
        ...base,
        animationName: 'rc-move-blink',
        backgroundColor: 'rgba(61, 107, 79, 0.18)',
        boxShadow: 'inset 0 0 0 1px rgba(61, 107, 79, 0.3)',
      }
    case 'capture':
      return {
        ...base,
        animationName: 'rc-capture-blink',
        backgroundColor: 'rgba(186, 26, 26, 0.18)',
        boxShadow: 'inset 0 0 0 1px rgba(186, 26, 26, 0.32)',
      }
    case 'blood_capture':
      // Ámbar: contraste en casillas rojas de Cadena de Sangre
      return {
        ...base,
        animationName: 'rc-blood-capture-blink',
        backgroundColor: 'rgba(255, 196, 64, 0.42)',
        boxShadow: 'inset 0 0 0 2px rgba(255, 210, 90, 0.85)',
      }
    case 'joker_hostile':
      return {
        ...base,
        animationName: 'rc-joker-hostile-blink',
        backgroundColor: 'rgba(186, 26, 26, 0.24)',
        boxShadow: 'inset 0 0 0 2px rgba(186, 26, 26, 0.4)',
      }
    case 'joker_ally':
      return {
        ...base,
        animationName: 'rc-joker-ally-blink',
        backgroundColor: 'rgba(212, 175, 55, 0.22)',
        boxShadow: 'inset 0 0 0 2px rgba(212, 175, 55, 0.38)',
      }
    case 'joker_empty':
      return {
        ...base,
        animationName: 'rc-joker-empty-blink',
        backgroundColor: 'rgba(65, 91, 164, 0.16)',
        boxShadow: 'inset 0 0 0 1px rgba(65, 91, 164, 0.32)',
      }
    case 'invisible':
      return {
        ...base,
        animationName: 'rc-invisible-blink',
        backgroundColor: 'rgba(90, 40, 120, 0.12)',
        boxShadow: 'inset 0 0 0 1px rgba(120, 70, 160, 0.32)',
      }
    case 'selected':
      return {
        backgroundColor: 'rgba(212, 175, 55, 0.28)',
        boxShadow: 'inset 0 0 0 2px rgba(115, 92, 0, 0.55)',
      }
  }
}
