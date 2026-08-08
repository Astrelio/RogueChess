import { Chess, type PieceSymbol, type Square } from 'chess.js'
import {
  area3x3,
  backwardSquare,
  chebyshev,
  isAdjacent,
  isSquare,
  pathBetween,
  ringsFrom,
} from './board'
import { blockedSquares } from './dimensions'
import { cjs, colorInCheck } from './moves'
import { emptyOps, type Color, type EngineContext, type EngineOps, type JokerResult } from './types'

/** Códigos que aplica SQL (fn_consume_joker): el motor no toca tablero. */
export const PASSIVE_CODES = new Set([
  'paso_fantasma',
  'expecto_patronum',
  'axio_tempus',
  'petrificus_totalus',
  'arresto_momentum',
  'giratiempo',
])

/** Códigos cuyo efecto es instantáneo (el effect row de SQL se desactiva al aplicar). */
export const INSTANT_KINDS = ['aparicion', 'avada_kedavra', 'morsmordre', 'bombarda_burn']

function otherColor(c: Color): Color {
  return c === 'white' ? 'black' : 'white'
}

/** FEN tras ediciones put/remove, conservando turno y limpiando en passant. */
function editedFen(chess: Chess): string {
  const parts = chess.fen().split(' ')
  parts[3] = '-'
  return parts.join(' ')
}

function ok(ops: EngineOps, extra?: { fizzled?: boolean; newFen?: string }): JokerResult {
  return { ok: true, ...ops, ...extra }
}

function fail(error: string): JokerResult {
  return { ok: false, error }
}

/**
 * Aplica un comodín sobre el estado del match.
 * Los payloads llegan ya validados por Zod en la ruta (forma); aquí se valida
 * la semántica (pieza propia/enemiga, rey inmune, casillas, etc.).
 */
export function applyJoker(
  ctx: EngineContext,
  code: string,
  payload: Record<string, unknown>,
): JokerResult {
  const ops = emptyOps()
  if (PASSIVE_CODES.has(code)) {
    ops.events.push(`Comodín ${code}: efecto aplicado (reloj/flags por servidor)`)
    return ok(ops)
  }

  let chess: Chess
  try {
    chess = new Chess(ctx.fen)
  } catch {
    return fail('FEN de partida inválido')
  }
  const me = cjs(ctx.moverColor)

  switch (code) {
    case 'aparicion': {
      const a = payload.a as string
      const b = payload.b as string
      if (a === b) return fail('Aparición: elige dos casillas distintas')
      const pa = chess.get(a as Square)
      const pb = chess.get(b as Square)
      if (!pa || pa.color !== me || !pb || pb.color !== me) {
        return fail('Aparición: ambas casillas deben tener piezas tuyas')
      }
      const backRank = (sq: string) => sq[1] === '1' || sq[1] === '8'
      if ((pa.type === 'p' && backRank(b)) || (pb.type === 'p' && backRank(a))) {
        return fail('Aparición: un peón no puede aparecer en la última fila')
      }
      chess.remove(a as Square)
      chess.remove(b as Square)
      chess.put({ type: pb.type, color: pb.color }, a as Square)
      chess.put({ type: pa.type, color: pa.color }, b as Square)
      const fen = editedFen(chess)
      if (colorInCheck(fen, ctx.moverColor)) {
        return fail('Aparición: el intercambio dejaría a tu rey en jaque')
      }
      // Los marcadores viajan con las piezas
      for (const f of ctx.flags) {
        if (f.square === a) ops.flagOps.push({ op: 'move', pieceUid: f.piece_uid, square: b })
        else if (f.square === b) ops.flagOps.push({ op: 'move', pieceUid: f.piece_uid, square: a })
      }
      ops.events.push(`Aparición: ${a} ↔ ${b}`)
      return ok(ops, { newFen: fen })
    }

    case 'avada_kedavra': {
      const square = payload.square as string
      const target = chess.get(square as Square)
      if (!target || target.color === me) return fail('Avada Kedavra: apunta a una pieza enemiga')
      if (target.type === 'k') return fail('El rey es inmune a los comodines')
      const wasPawn = ctx.flags.some(
        (f) => f.square === square && f.color === otherColor(ctx.moverColor) && f.was_pawn,
      )
      if (target.type !== 'p' && !wasPawn) {
        return fail('Avada Kedavra solo asesina peones o piezas que fueron peón')
      }
      chess.remove(square as Square)
      for (const f of ctx.flags) {
        if (f.square === square) ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
      }
      ops.events.push(`Avada Kedavra: la pieza en ${square} muere`)
      return ok(ops, { newFen: editedFen(chess) })
    }

    case 'morsmordre': {
      const square = payload.square as string
      const target = chess.get(square as Square)
      if (!target || target.color === me) return fail('Morsmordre: apunta a una pieza enemiga')
      if (target.type === 'k') return fail('El rey es inmune al miedo')

      // Debe estar adyacente a una pieza tuya
      let adjacent = false
      for (const row of chess.board()) {
        for (const p of row) {
          if (p && p.color === me && isAdjacent(p.square, square)) adjacent = true
        }
      }
      if (!adjacent) return fail('Morsmordre: la pieza enemiga debe estar adyacente a una tuya')

      // Expecto Patronum anula el miedo en TODO el tablero (GDD)
      const expecto =
        ctx.expectoPatronumActive ||
        ctx.effects.some((e) => e.is_active && e.kind === 'expecto_patronum')
      if (expecto) {
        ops.events.push('Morsmordre: Expecto Patronum protege el tablero — el hechizo se disipa')
        return ok(ops, { fizzled: true })
      }

      const targetColor = otherColor(ctx.moverColor)
      const back = backwardSquare(square, targetColor)
      if (!back || (target.type === 'p' && (back[1] === '1' || back[1] === '8'))) {
        ops.events.push('Morsmordre: el borde del tablero bloquea el retroceso — falla')
        return ok(ops, { fizzled: true })
      }
      const occupant = chess.get(back as Square)
      if (occupant && occupant.color !== me) {
        ops.events.push('Morsmordre: una pieza de su propio equipo bloquea — falla')
        return ok(ops, { fizzled: true })
      }
      if (occupant && occupant.color === me) {
        if (occupant.type === 'k') {
          ops.events.push('Morsmordre: tu rey bloquea el retroceso — falla')
          return ok(ops, { fizzled: true })
        }
        chess.remove(back as Square)
        for (const f of ctx.flags) {
          if (f.square === back) ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
        }
        ops.events.push(`Morsmordre: tu pieza en ${back} es aplastada`)
      }
      chess.remove(square as Square)
      chess.put({ type: target.type, color: target.color }, back as Square)
      for (const f of ctx.flags) {
        if (f.square === square) ops.flagOps.push({ op: 'move', pieceUid: f.piece_uid, square: back })
      }
      ops.events.push(`Morsmordre: la pieza en ${square} retrocede a ${back}`)
      return ok(ops, { newFen: editedFen(chess) })
    }

    case 'bombarda': {
      const square = payload.square as string
      const pawn = chess.get(square as Square)
      if (!pawn || pawn.color !== me || pawn.type !== 'p') {
        return fail('Bombarda: elige uno de tus peones para sacrificar')
      }

      const zone = area3x3(square)
      const zoneSet = new Set(zone)
      const alreadyBlocked = blockedSquares(ctx)

      // 1) Sacrificio + snapshot de TODO lo que hay en la zona (excepto el peón)
      chess.remove(square as Square)
      for (const f of ctx.flags) {
        if (f.square === square) ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
      }

      type Displaced = {
        from: string
        type: PieceSymbol
        color: 'w' | 'b'
      }
      const displaced: Displaced[] = []
      for (const sq of zone) {
        if (sq === square) continue
        const piece = chess.get(sq as Square)
        if (!piece) continue
        displaced.push({ from: sq, type: piece.type, color: piece.color })
        chess.remove(sq as Square)
      }

      // 2) Reubicar: reyes primero (inmunes a muerte; deben salir de la zona),
      //    luego el resto. Así un peón no "roba" la casilla segura del rey.
      displaced.sort((a, b) => {
        const rank = (t: string) => (t === 'k' ? 0 : t === 'q' ? 1 : 2)
        return rank(a.type) - rank(b.type) || a.from.localeCompare(b.from)
      })

      const reserved = new Set<string>()
      const blast = square

      function findSafe(from: string, type: PieceSymbol, color: 'w' | 'b'): string | null {
        const isPawn = type === 'p'
        // Preferir alejarse del centro de la explosión
        const candidates = ringsFrom(from).slice().sort((a, b) => {
          const da = chebyshev(blast, a) - chebyshev(blast, b)
          if (da !== 0) return da
          return chebyshev(from, a) - chebyshev(from, b) || a.localeCompare(b)
        })
        for (const cand of candidates) {
          if (zoneSet.has(cand)) continue
          if (alreadyBlocked.has(cand)) continue
          if (reserved.has(cand)) continue
          if (chess.get(cand as Square)) continue
          if (isPawn && (cand[1] === '1' || cand[1] === '8')) continue
          // El rey no puede aterrizar en jaque
          if (type === 'k') {
            chess.put({ type, color }, cand as Square)
            const fenTry = editedFen(chess)
            const kingColor = color === 'w' ? 'white' : 'black'
            const inCheck = colorInCheck(fenTry, kingColor)
            chess.remove(cand as Square)
            if (inCheck) continue
          }
          return cand
        }
        return null
      }

      for (const d of displaced) {
        const safe = findSafe(d.from, d.type, d.color)
        if (!safe) {
          // Sin refugio: la pieza regresa a su casilla (no se quema esa casilla luego)
          chess.put({ type: d.type, color: d.color }, d.from as Square)
          ops.events.push(
            `Bombarda: ${d.from} no tenía casilla segura — la pieza aguanta y esa casilla no se quema`,
          )
          continue
        }
        chess.put({ type: d.type, color: d.color }, safe as Square)
        reserved.add(safe)
        for (const f of ctx.flags) {
          if (f.square === d.from) ops.flagOps.push({ op: 'move', pieceUid: f.piece_uid, square: safe })
        }
        ops.events.push(`Bombarda: la pieza de ${d.from} es empujada a ${safe}`)
      }

      // 3) Quemar solo casillas de la zona que quedaron vacías
      //    (nunca dejar una pieza atrapada sobre casilla quemada: no se puede
      //    capturar ahí y al salir la trayectoria cruza otras quemadas).
      let burned = 0
      for (const sq of zone) {
        if (chess.get(sq as Square)) continue
        ops.cellOps.push({
          op: 'insert',
          square: sq,
          effect: 'burned',
          expiresCycle: ctx.cycleIndex + 1,
          payload: { source: 'bombarda' },
        })
        burned++
      }

      const fen = editedFen(chess)
      if (colorInCheck(fen, ctx.moverColor)) {
        return fail('Bombarda: la explosión dejaría a tu rey en jaque')
      }

      ops.events.push(`Bombarda: explosión en ${square} — ${burned} casillas quemadas este ciclo`)
      return ok(ops, { newFen: fen })
    }

    case 'defodio': {
      const square = payload.square as string
      if (chess.get(square as Square)) return fail('Defodio: la casilla debe estar vacía')
      if (ctx.cells.some((c) => c.is_active && c.square === square)) {
        return fail('Defodio: la casilla ya tiene una anomalía')
      }
      ops.cellOps.push({
        op: 'insert',
        square,
        effect: 'trap_defodio',
        ownerPlayerId: ctx.moverPlayerId,
        payload: { created_ply: ctx.ply },
      })
      ops.events.push(`Defodio: trampa oculta en ${square} (1 turno)`)
      return ok(ops)
    }

    case 'imperius': {
      const from = payload.from as string
      const to = payload.to as string
      const piece = chess.get(from as Square)
      if (!piece || piece.color === me) return fail('Imperius: apunta a una pieza enemiga')
      if (piece.type === 'k') return fail('El rey es inmune al control mental')
      const dest = chess.get(to as Square)
      if (dest?.type === 'k') return fail('Imperius: no puedes capturar un rey')

      const geo = imperiusGeometry(ctx, chess, from, to, piece.type, otherColor(ctx.moverColor))
      if (!geo.ok) return fail(`Imperius: ${geo.reason}`)

      if (dest) {
        chess.remove(to as Square)
        for (const f of ctx.flags) {
          if (f.square === to) ops.flagOps.push({ op: 'remove', pieceUid: f.piece_uid })
        }
        ops.events.push(`Imperius: la pieza controlada captura en ${to} (fuego amigo permitido)`)
      }
      chess.remove(from as Square)
      chess.put({ type: piece.type, color: piece.color }, to as Square)
      for (const f of ctx.flags) {
        if (f.square === from) ops.flagOps.push({ op: 'move', pieceUid: f.piece_uid, square: to })
      }
      const fen = editedFen(chess)
      if (colorInCheck(fen, ctx.moverColor)) {
        return fail('Imperius: esa jugada dejaría a tu propio rey en jaque')
      }
      ops.events.push(`Imperius: controlas la pieza enemiga ${from} → ${to}`)
      return ok(ops, { newFen: fen })
    }

    case 'capa_invisibilidad': {
      const square = payload.square as string
      const piece = chess.get(square as Square)
      if (!piece || piece.color !== me) return fail('Capa: elige una pieza tuya')
      ops.flagOps.push({
        op: 'upsert',
        pieceUid: `inv:${square}:${ctx.ply}`,
        color: ctx.moverColor,
        kind: piece.type,
        square,
        isInvisible: true,
      })
      ops.events.push(`Capa de invisibilidad: la pieza en ${square} desaparece de la vista rival`)
      return ok(ops)
    }

    case 'pocion_multijugos': {
      const square = payload.square as string
      const piece = chess.get(square as Square)
      if (!piece || piece.color !== me || piece.type !== 'p') {
        return fail('Poción multijugos: elige uno de tus peones')
      }
      chess.remove(square as Square)
      chess.put({ type: 'q', color: me }, square as Square)
      const fullmove = Number(ctx.fen.split(' ')[5] || 1)
      ops.flagOps.push({
        op: 'upsert',
        pieceUid: `mj:${square}:${ctx.ply}`,
        color: ctx.moverColor,
        kind: 'q',
        square,
        wasPawn: true,
        multijugosQueen: true,
        multijugosDiesPly: ctx.ply + 2,
        payload: { created_fullmove: fullmove },
      })
      ops.events.push(`Poción multijugos: el peón de ${square} es Reina por 1 turno`)
      return ok(ops, { newFen: editedFen(chess) })
    }

    default:
      return fail(`Comodín desconocido: ${code}`)
  }
}

type Geo = { ok: true } | { ok: false; reason: string }

/**
 * Validación geométrica para Imperius: la pieza controlada se mueve según su
 * patrón (con fuego amigo permitido) y respetando dimensión + zonas muertas.
 */
function imperiusGeometry(
  ctx: EngineContext,
  chess: Chess,
  from: string,
  to: string,
  type: string,
  pieceColor: Color,
): Geo {
  if (from === to) return { ok: false, reason: 'origen y destino iguales' }
  const df = to.charCodeAt(0) - from.charCodeAt(0)
  const dr = Number(to[1]) - Number(from[1])
  const adf = Math.abs(df)
  const adr = Math.abs(dr)
  const straight = df === 0 || dr === 0
  const diagonal = adf === adr
  const occupiedDest = Boolean(chess.get(to as Square))

  switch (type) {
    case 'n':
      if (!((adf === 1 && adr === 2) || (adf === 2 && adr === 1))) {
        return { ok: false, reason: 'movimiento inválido de caballo' }
      }
      break
    case 'r':
      if (!straight) return { ok: false, reason: 'la torre se mueve en línea recta' }
      break
    case 'b':
      if (!diagonal) return { ok: false, reason: 'el alfil se mueve en diagonal' }
      break
    case 'q':
      if (!straight && !diagonal) return { ok: false, reason: 'movimiento inválido de dama' }
      break
    case 'p': {
      const dir = pieceColor === 'white' ? 1 : -1
      const startRank = pieceColor === 'white' ? 2 : 7
      const push = df === 0 && (dr === dir || (dr === 2 * dir && Number(from[1]) === startRank)) && !occupiedDest
      const capture = adf === 1 && dr === dir && occupiedDest
      if (!push && !capture) return { ok: false, reason: 'movimiento inválido de peón' }
      if (to[1] === '1' || to[1] === '8') return { ok: false, reason: 'sin coronación bajo Imperius' }
      break
    }
    default:
      return { ok: false, reason: 'pieza no controlable' }
  }

  const blocked = blockedSquares(ctx)
  if (blocked.has(to)) return { ok: false, reason: 'la casilla destino está destruida' }
  if (type !== 'n') {
    for (const sq of pathBetween(from, to)) {
      if (chess.get(sq as Square)) return { ok: false, reason: 'trayectoria bloqueada' }
      if (blocked.has(sq)) return { ok: false, reason: 'la trayectoria cruza una zona muerta' }
    }
  }
  if (ctx.dimension === 'gravitacional' && ['q', 'r', 'b'].includes(type) && chebyshev(from, to) > 3) {
    return { ok: false, reason: 'gravitacional limita a 3 casillas' }
  }
  return { ok: true }
}

/** Esquemas de payload requeridos por código (se valida con Zod en la ruta). */
export function requiredPayloadShape(code: string): string[] {
  switch (code) {
    case 'aparicion':
      return ['a', 'b']
    case 'imperius':
      return ['from', 'to']
    case 'avada_kedavra':
    case 'morsmordre':
    case 'bombarda':
    case 'defodio':
    case 'capa_invisibilidad':
    case 'pocion_multijugos':
      return ['square']
    default:
      return []
  }
}

export { isSquare }
