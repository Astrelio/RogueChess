import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js'
import { pathBetween, chebyshev, fileOf, rankOf, squareAt } from './board.js'
import {
  activeCellMap,
  blockedSquares,
  bloodChainViolation,
  checkMoveAgainstBoard,
  mirrorCommand,
} from './dimensions.js'
import { emptyOps, type Color, type EngineContext, type MoveResult } from './types.js'

const SLIDERS = new Set<PieceSymbol>(['q', 'r', 'b'])
/** Mercado negro: bonus fijo por captura (GDD: "hasta 15s"). */
const MERCADO_CAPTURE_BONUS_MS = 5000
/** Vida de una trampa Defodio en plies de match_moves (~1 turno rival). */
const TRAP_TTL_PLIES = 2

export function cjs(color: Color): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b'
}

function otherColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white'
}

/** Alinea el lado a mover del FEN con el turno autoritativo de la partida. */
export function fenWithSideToMove(fen: string, color: Color): string {
  const parts = fen.split(' ')
  if (parts.length < 2) return fen
  parts[1] = cjs(color)
  return parts.join(' ')
}

function fenWithTurn(fen: string, turn: Color): string {
  return fenWithSideToMove(fen, turn)
}

/** ¿El rey de `color` está en jaque en esta posición (ignorando de quién es el turno)? */
export function colorInCheck(fen: string, color: Color): boolean {
  try {
    return new Chess(fenWithTurn(fen, color)).isCheck()
  } catch {
    return false
  }
}

function stripCastling(castling: string, from: string): string {
  let out = castling
  if (from === 'e1') out = out.replace(/[KQ]/g, '')
  if (from === 'e8') out = out.replace(/[kq]/g, '')
  if (from === 'h1') out = out.replace('K', '')
  if (from === 'a1') out = out.replace('Q', '')
  if (from === 'h8') out = out.replace('k', '')
  if (from === 'a8') out = out.replace('q', '')
  return out === '' ? '-' : out
}

/**
 * Aplica un movimiento "forzado" (fuera de la legalidad chess.js, p.ej.
 * paso fantasma) y devuelve el FEN con el turno cambiado al rival.
 */
function forcedMoveFen(
  chess: Chess,
  from: string,
  to: string,
  mover: Color,
  promotion?: PieceSymbol,
): string {
  const piece = chess.get(from as Square)!
  chess.remove(from as Square)
  chess.remove(to as Square)
  chess.put({ type: promotion ?? piece.type, color: piece.color }, to as Square)

  const parts = chess.fen().split(' ')
  parts[1] = cjs(otherColor(mover))
  if (piece.type === 'k' || piece.type === 'r') {
    parts[2] = stripCastling(parts[2], from)
  }
  parts[3] = '-'
  parts[4] = '0'
  if (mover === 'black') parts[5] = String(Number(parts[5]) + 1)
  return parts.join(' ')
}

type GhostAttempt =
  | { ok: true; captured: boolean; fen: string }
  | { ok: false; reason: string }

/**
 * Paso fantasma: la pieza atraviesa piezas en su trayectoria.
 * Solo deslizantes (Q/R/B) y peones en avance recto. Las zonas muertas
 * siguen bloqueando; el destino debe estar vacío o tener pieza enemiga (no rey).
 */
function tryGhostMove(
  ctx: EngineContext,
  fen: string,
  from: string,
  to: string,
  pieceType: PieceSymbol,
): GhostAttempt {
  const chess = new Chess(fen)
  const df = Math.abs(to.charCodeAt(0) - from.charCodeAt(0))
  const dr = Number(to[1]) - Number(from[1])

  if (SLIDERS.has(pieceType)) {
    const straight = df === 0 || dr === 0
    const diagonal = df === Math.abs(dr)
    if (pieceType === 'r' && !straight) return { ok: false, reason: 'Trayectoria inválida para torre' }
    if (pieceType === 'b' && !diagonal) return { ok: false, reason: 'Trayectoria inválida para alfil' }
    if (pieceType === 'q' && !straight && !diagonal) {
      return { ok: false, reason: 'Trayectoria inválida para dama' }
    }
    if (ctx.dimension === 'gravitacional' && chebyshev(from, to) > 3) {
      return { ok: false, reason: 'Dimensión gravitacional: máximo 3 casillas' }
    }
  } else if (pieceType === 'p') {
    const dir = ctx.moverColor === 'white' ? 1 : -1
    const startRank = ctx.moverColor === 'white' ? 2 : 7
    const okStep = df === 0 && (dr === dir || (dr === 2 * dir && Number(from[1]) === startRank))
    if (!okStep) return { ok: false, reason: 'Paso fantasma: el peón solo avanza recto' }
    if (chess.get(to as Square)) return { ok: false, reason: 'Paso fantasma: el peón no captura de frente' }
  } else {
    return { ok: false, reason: 'Paso fantasma solo aplica a dama, torre, alfil o peón' }
  }

  const blocked = blockedSquares(ctx)
  if (blocked.has(to)) return { ok: false, reason: 'La casilla destino está destruida' }
  for (const sq of pathBetween(from, to)) {
    if (blocked.has(sq)) return { ok: false, reason: 'La trayectoria cruza una zona muerta' }
    const inPath = chess.get(sq as Square)
    if (inPath?.type === 'k') return { ok: false, reason: 'No se puede atravesar un rey' }
  }

  const target = chess.get(to as Square)
  if (target) {
    if (target.color === cjs(ctx.moverColor)) return { ok: false, reason: 'Destino ocupado por tu pieza' }
    if (target.type === 'k') return { ok: false, reason: 'El rey no puede ser capturado así' }
  }
  if (target === null || target === undefined) {
    if (pieceType === 'p' && (to[1] === '1' || to[1] === '8')) {
      return { ok: false, reason: 'Paso fantasma no soporta coronación' }
    }
  }

  const nextFen = forcedMoveFen(chess, from, to, ctx.moverColor, undefined)
  if (colorInCheck(nextFen, ctx.moverColor)) {
    return { ok: false, reason: 'Ese movimiento dejaría a tu rey en jaque' }
  }
  return { ok: true, captured: Boolean(target), fen: nextFen }
}

/**
 * Peón bajo Espejo: `to` YA es el destino invertido.
 * GDD: avanzan hacia tu propio bando y coronan en tu fila de inicio.
 * Blancas → rank 1; negras → rank 8.
 */
function tryMirrorPawnMove(
  ctx: EngineContext,
  fen: string,
  from: string,
  to: string,
  promotion?: PieceSymbol,
): GhostAttempt {
  const chess = new Chess(fen)
  const df = fileOf(to) - fileOf(from)
  const dr = rankOf(to) - rankOf(from)
  const homeDir = ctx.moverColor === 'white' ? -1 : 1
  const doubleRank = ctx.moverColor === 'white' ? 7 : 2
  const promoRank = ctx.moverColor === 'white' ? 1 : 8

  const blocked = blockedSquares(ctx)
  if (blocked.has(to)) return { ok: false, reason: 'Espejo: la casilla destino está quemada o en ruina' }

  const target = chess.get(to as Square)
  const isPush = df === 0 && !target && (dr === homeDir || (dr === 2 * homeDir && Number(from[1]) === doubleRank))
  const isCapture =
    Math.abs(df) === 1 &&
    dr === homeDir &&
    target &&
    target.color !== cjs(ctx.moverColor) &&
    target.type !== 'k'

  if (!isPush && !isCapture) {
    return { ok: false, reason: 'Espejo: ese comando no produce un avance/captura de peón válida' }
  }

  if (isPush && Math.abs(dr) === 2) {
    const mid = squareAt(fileOf(from), rankOf(from) + homeDir)
    if (!mid || chess.get(mid as Square) || blocked.has(mid)) {
      return { ok: false, reason: 'Espejo: el doble paso está bloqueado' }
    }
  }

  let promo: PieceSymbol | undefined
  if (Number(to[1]) === promoRank) {
    promo = promotion ?? 'q'
  }

  const nextFen = forcedMoveFen(chess, from, to, ctx.moverColor, promo)
  if (colorInCheck(nextFen, ctx.moverColor)) {
    return { ok: false, reason: 'Espejo: ese movimiento dejaría a tu rey en jaque' }
  }
  return { ok: true, captured: Boolean(isCapture), fen: nextFen }
}

export type MoveInput = {
  from: string
  to: string
  promotion?: string
  /**
   * Si true, no se aplica la inversión de Espejo (el destino ya es el
   * casillero real). Usado por el bot, que elige jugadas legales de chess.js.
   */
  skipMirror?: boolean
}

/**
 * Valida y aplica una jugada con dimensión + efectos activos.
 * Devuelve FEN final (incluye muertes por trampa/fragilidad/multijugos) y
 * las operaciones a persistir (celdas, flags, relojes, efectos consumidos).
 */
export function applyPlayerMove(ctx: EngineContext, input: MoveInput): MoveResult {
  const ops = emptyOps()
  let chess: Chess
  // Autoridad del turno = matches.turn_color (Giratiempo puede desincronizar el FEN)
  const syncedFen = fenWithSideToMove(ctx.fen, ctx.turnColor)
  try {
    chess = new Chess(syncedFen)
  } catch {
    return { ok: false, error: 'FEN de partida inválido' }
  }

  // 0) Poción multijugos: la reina falsa del mover colapsa al iniciar su turno
  const currentFullmove = Number(ctx.fen.split(' ')[5] || 1)
  for (const f of ctx.flags) {
    if (!f.multijugos_queen || f.color !== ctx.moverColor || !f.square) continue
    const created = Number(f.payload?.created_fullmove ?? NaN)
    if (Number.isNaN(created) || currentFullmove <= created) continue
    const piece = chess.get(f.square as Square)
    if (piece && piece.type === 'q' && piece.color === cjs(ctx.moverColor)) {
      chess.remove(f.square as Square)
      ops.events.push(`Poción multijugos: la reina en ${f.square} colapsa y muere`)
    }
    ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
  }

  const from = input.from
  let to = input.to
  const movingPiece = chess.get(from as Square)
  if (!movingPiece || movingPiece.color !== cjs(ctx.moverColor)) {
    return { ok: false, error: 'No tienes una pieza en esa casilla' }
  }

  // Dimensión espejo: el comando del humano se invierte (el bot ya elige destino real)
  if (ctx.dimension === 'espejo' && !input.skipMirror) {
    const mirrored = mirrorCommand(from, to)
    if (!mirrored || mirrored === from) {
      return { ok: false, error: 'Espejo: el movimiento invertido sale del tablero' }
    }
    to = mirrored
  }

  const legalMoves = chess.moves({ verbose: true }) as Move[]
  const promo = (input.promotion ?? undefined) as PieceSymbol | undefined
  const chosen =
    legalMoves.find(
      (m) => m.from === from && m.to === to && (!promo || m.promotion === promo),
    ) ?? legalMoves.find((m) => m.from === from && m.to === to)

  let san: string
  let uci: string
  let isCapture = false
  let ghostUsed = false

  if (chosen) {
    const boardCheck = checkMoveAgainstBoard(ctx, chosen)
    if (!boardCheck.ok) return { ok: false, error: boardCheck.reason }
    const blood = bloodChainViolation(ctx, chosen, legalMoves)
    if (!blood.ok) return { ok: false, error: blood.reason }

    const made = chess.move({
      from: chosen.from,
      to: chosen.to,
      promotion: chosen.promotion ?? promo ?? 'q',
    })
    san = made.san
    uci = made.from + made.to + (made.promotion ?? '')
    isCapture = Boolean(made.captured)

    if (made.promotion) {
      ops.flagOps.push({
        op: 'upsert',
        pieceUid: `wp:${to}:${ctx.ply + 1}`,
        color: ctx.moverColor,
        kind: made.promotion,
        square: to,
        wasPawn: true,
      })
      ops.events.push(`Coronación en ${to}: marcada como ex-peón (Avada Kedavra aplica)`)
    }
  } else if (ctx.dimension === 'espejo' && movingPiece.type === 'p' && !input.skipMirror) {
    // Peón hacia el propio bando (chess.js no lo permite: movimiento forzado)
    const attempt = tryMirrorPawnMove(ctx, chess.fen(), from, to, promo)
    if (attempt.ok === false) return { ok: false, error: attempt.reason }
    chess = new Chess(attempt.fen)
    const afterPiece = chess.get(to as Square)
    const didPromo = Boolean(afterPiece && afterPiece.type !== 'p')
    san = didPromo ? `${to}=${afterPiece!.type.toUpperCase()}✦` : `${from}-${to}✦`
    uci = from + to + (didPromo ? afterPiece!.type : '')
    isCapture = attempt.captured
    if (didPromo) {
      ops.flagOps.push({
        op: 'upsert',
        pieceUid: `wp:${to}:${ctx.ply + 1}`,
        color: ctx.moverColor,
        kind: afterPiece!.type,
        square: to,
        wasPawn: true,
      })
      ops.events.push(`Espejo: peón corona en tu fila de inicio (${to})`)
    } else {
      ops.events.push('Espejo: el peón avanza hacia tu propio bando')
    }
  } else {
    // ¿Paso fantasma activo?
    const ghost = ctx.effects.find(
      (e) => e.is_active && e.kind === 'ghost_step' && e.applied_by === ctx.moverPlayerId,
    )
    if (!ghost) {
      const why =
        ctx.dimension === 'espejo'
          ? `Espejo: tu jugada se invierte hacia ${to} y ahí es ilegal`
          : 'Movimiento ilegal'
      return { ok: false, error: why }
    }
    const attempt = tryGhostMove(ctx, chess.fen(), from, to, movingPiece.type)
    if (attempt.ok === false) return { ok: false, error: attempt.reason }
    chess = new Chess(attempt.fen)
    san = `${movingPiece.type.toUpperCase()}${from}-${to}†`
    uci = from + to
    isCapture = attempt.captured
    ghostUsed = true
    ops.effectOps.push({ op: 'deactivate', id: ghost.id })
    ops.events.push('Paso fantasma: la pieza atravesó la trayectoria ocupada')
  }

  // Tracking de flags: la pieza movida arrastra sus marcadores
  for (const f of ctx.flags) {
    if (!f.square) continue
    if (f.square === from && f.color === ctx.moverColor) {
      // Capa: al atacar (capturar) la pieza deja de ser invisible
      if (isCapture && f.is_invisible) {
        ops.flagOps.push({
          op: 'upsert',
          pieceUid: f.piece_uid,
          color: f.color,
          kind: f.kind,
          square: to,
          wasPawn: f.was_pawn,
          isInvisible: false,
          multijugosQueen: f.multijugos_queen,
          multijugosDiesPly: f.multijugos_dies_ply,
          payload: f.payload,
        })
        ops.events.push(`Capa de invisibilidad: la pieza en ${to} se revela al atacar`)
      } else {
        ops.flagOps.push({ op: 'move', pieceUid: f.piece_uid, square: to })
      }
    } else if (f.square === to && f.color !== ctx.moverColor && isCapture) {
      ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
    }
  }

  const cellMap = activeCellMap(ctx)

  // Trampa Defodio en la casilla de aterrizaje
  const trap = cellMap.get(to)
  if (trap?.effect === 'trap_defodio' && trap.owner_player_id !== ctx.moverPlayerId) {
    const createdPly = Number(trap.payload?.created_ply ?? 0)
    ops.cellOps.push({ op: 'deactivate', id: trap.id })
    if (ctx.ply - createdPly <= TRAP_TTL_PLIES) {
      const victim = chess.get(to as Square)
      if (victim && victim.type !== 'k') {
        chess.remove(to as Square)
        // La pieza que cayó venía de `from`; sus flags (ya movidos a `to`) mueren con ella
        for (const f of ctx.flags) {
          if (f.square === from && f.color === ctx.moverColor) {
            ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
          }
        }
        ops.events.push(`Defodio: tu pieza cayó en la trampa de ${to} y fue destruida`)
      } else {
        ops.events.push('Defodio: el rey es inmune a la trampa (se consumió sin efecto)')
      }
    }
  }

  // Trampas caducadas (1 turno de vida)
  for (const c of ctx.cells) {
    if (
      c.is_active &&
      c.effect === 'trap_defodio' &&
      c.id !== trap?.id &&
      ctx.ply - Number(c.payload?.created_ply ?? 0) > TRAP_TTL_PLIES
    ) {
      ops.cellOps.push({ op: 'deactivate', id: c.id })
    }
  }

  // Monolitos: aterrizar o atravesar absorbe el tiempo
  const passSquares =
    movingPiece.type === 'n' ? [to] : [to, ...pathBetween(from, to)]
  for (const sq of passSquares) {
    const cell = cellMap.get(sq)
    if (cell?.effect !== 'monolith') continue
    const min = cell.time_bonus_min_s ?? 40
    const max = cell.time_bonus_max_s ?? 60
    const bonusMs = (min + Math.floor(Math.random() * (max - min + 1))) * 1000
    ops.clockOps.push({ color: ctx.moverColor, deltaMs: bonusMs, reason: 'monolith' })
    ops.cellOps.push({ op: 'deactivate', id: cell.id })
    ops.events.push(`Monolito de tiempo en ${sq}: +${bonusMs / 1000}s a tu reloj`)
  }

  // Mercado negro: bonus por captura
  if (ctx.dimension === 'mercado_negro' && isCapture) {
    ops.clockOps.push({
      color: ctx.moverColor,
      deltaMs: MERCADO_CAPTURE_BONUS_MS,
      reason: 'mercado_capture',
    })
    ops.events.push(`Mercado negro: captura +${MERCADO_CAPTURE_BONUS_MS / 1000}s`)
  }

  // Fragilidad: al final del turno, pieza (no rey) amenazada por 2+ enemigos estalla
  if (ctx.dimension === 'fragilidad') {
    const doomed: { square: string; color: Color }[] = []
    for (const row of chess.board()) {
      for (const cellPiece of row) {
        if (!cellPiece || cellPiece.type === 'k') continue
        const enemy = cellPiece.color === 'w' ? 'b' : 'w'
        const attackers = chess.attackers(cellPiece.square as Square, enemy)
        if (attackers.length >= 2) {
          doomed.push({
            square: cellPiece.square,
            color: cellPiece.color === 'w' ? 'white' : 'black',
          })
        }
      }
    }
    for (const d of doomed) {
      chess.remove(d.square as Square)
      ops.events.push(`Fragilidad: la pieza en ${d.square} cristaliza y estalla`)
      for (const f of ctx.flags) {
        if (f.square === d.square) ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
      }
    }
  }

  const fenRaw = chess.fen()
  let isCheck = false
  let isMate = false
  try {
    const post = new Chess(fenRaw)
    isCheck = post.isCheck()
    isMate = post.isCheckmate()
  } catch {
    /* posición exótica tras remociones: sin jaque computable */
  }

  // Giratiempo: si queda un movimiento extra, el FEN debe seguir en nuestro turno
  // (chess.js ya lo pasó al rival).
  const keepTurn =
    ctx.giratiempoActive &&
    !isCheck &&
    !isMate &&
    ctx.giratiempoMovesLeft - 1 > 0 &&
    ctx.giratiempoCaptures + (isCapture ? 1 : 0) <= 1

  const fenAfter = keepTurn ? fenWithSideToMove(fenRaw, ctx.moverColor) : fenRaw
  if (keepTurn) {
    ops.events.push('Giratiempo: puedes mover otra vez')
  }

  return {
    ok: true,
    fenAfter,
    san,
    uci,
    isCapture,
    isCheck,
    isMate,
    ghostUsed,
    ...ops,
  }
}

/** Jugadas legales bajo dimensión (para el bot y validaciones globales). */
export function listLegalMoves(ctx: EngineContext): Move[] {
  const chess = new Chess(fenWithSideToMove(ctx.fen, ctx.turnColor))
  const all = (chess.moves({ verbose: true }) as Move[]).filter(
    (m) => checkMoveAgainstBoard(ctx, m).ok,
  )
  if (ctx.dimension === 'cadena_sangre') {
    const captures = all.filter((m) => m.captured)
    if (captures.length) return captures
  }
  return all
}

/**
 * Input del bot: destino ya es legal (chess.js). No pasar por Espejo otra vez.
 */
export function botInputFor(_ctx: EngineContext, move: Move): MoveInput {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    skipMirror: true,
  }
}
