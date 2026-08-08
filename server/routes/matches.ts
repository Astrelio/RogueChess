import { Router } from 'express'
import { z } from 'zod'
import { sql } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  applyJoker,
  applyPlayerMove,
  botInputFor,
  buildContext,
  listLegalMoves,
  type Color,
  type MoveInput,
} from '../engine/index.js'
import { getMaxPly, getPieceFlags, persistEngineOps } from '../engine/persist.js'

export const matchesRouter = Router()

type StateLike = {
  match: Record<string, unknown>
  players: Record<string, unknown>[]
  cells?: Record<string, unknown>[]
  effects?: Record<string, unknown>[]
}

/** Contexto del motor para un jugador (estado + flags + ply actuales). */
async function engineContextFor(
  matchId: string,
  state: Record<string, unknown>,
  moverColor: Color,
) {
  const [ply, flags] = await Promise.all([getMaxPly(matchId), getPieceFlags(matchId)])
  return buildContext({ state: state as unknown as StateLike, flags, ply, moverColor })
}

async function getState(matchId: string, firebaseUid?: string): Promise<Record<string, unknown> | null> {
  const rows = await sql`SELECT fn_get_match_state(${matchId}::uuid) AS state`
  const state = rows[0]?.state as Record<string, unknown>
  if (!state) return null

  const shop = (state.shop as Array<Record<string, unknown>>) || []
  const inventory = (state.inventory as Array<Record<string, unknown>>) || []
  const jokerIds = [
    ...new Set([
      ...shop.map((s) => s.joker_id as string),
      ...inventory.map((i) => i.joker_id as string),
    ].filter(Boolean)),
  ]

  let jokersById: Record<string, Record<string, unknown>> = {}
  if (jokerIds.length) {
    const rows = await sql`SELECT * FROM jokers WHERE id = ANY(${jokerIds}::uuid[])`
    jokersById = Object.fromEntries(
      (rows as Array<Record<string, unknown>>).map((j) => [j.id as string, j]),
    )
  }

  const enrichedShop = shop.map((s) => ({ ...s, joker: jokersById[s.joker_id as string] }))
  const enrichedInv = inventory.map((i) => ({ ...i, joker: jokersById[i.joker_id as string] }))

  let you: Record<string, unknown> | null = null
  if (firebaseUid) {
    const profile = await sql`SELECT id FROM profiles WHERE firebase_uid = ${firebaseUid} LIMIT 1`
    const pid = profile[0]?.id as string | undefined
    const players = (state.players as Array<Record<string, unknown>>) || []
    you = players.find((p) => p.profile_id === pid) ?? null
  }

  const players = (state.players as Array<Record<string, unknown>>) || []
  const profileIds = players.map((p) => p.profile_id as string)
  let profilesById: Record<string, Record<string, unknown>> = {}
  if (profileIds.length) {
    const rows = await sql`
      SELECT id, username, display_name FROM profiles WHERE id = ANY(${profileIds}::uuid[])
    `
    profilesById = Object.fromEntries(
      (rows as Array<Record<string, unknown>>).map((p) => [p.id as string, p]),
    )
  }
  const enrichedPlayers = players.map((p) => ({
    ...p,
    username: profilesById[p.profile_id as string]?.username,
    display_name: profilesById[p.profile_id as string]?.display_name,
  }))

  const flags = await getPieceFlags(matchId)

  return {
    ...state,
    players: enrichedPlayers,
    shop: enrichedShop,
    inventory: enrichedInv,
    flags,
    you,
  }
}

matchesRouter.post('/quick', requireAuth, async (req, res, next) => {
  try {
    // Partida vs bot inmediata (fallback / práctica)
    const rows = await sql`
      SELECT * FROM fn_create_match(
        ${req.user!.uid},
        'bot'::match_mode,
        300,
        'white'::player_color,
        NULL,
        TRUE,
        FALSE
      )
    `
    const match = rows[0]
    const state = await getState(match.id as string, req.user!.uid)
    res.json({ match, state })
  } catch (err) {
    next(err)
  }
})

/** Crea partida en waiting para reto Portal (el rival hace join). */
matchesRouter.post('/challenge', requireAuth, async (req, res, next) => {
  try {
    const timeControlS = z.number().int().min(60).max(1800).optional().parse(req.body?.timeControlS) ?? 300
    const rows = await sql`
      SELECT * FROM fn_create_match(
        ${req.user!.uid},
        'quick'::match_mode,
        ${timeControlS},
        'white'::player_color,
        NULL,
        TRUE,
        TRUE
      )
    `
    const match = rows[0]
    const state = await getState(match.id as string, req.user!.uid)
    res.json({ match, state })
  } catch (err) {
    next(err)
  }
})

/** Aceptar reto / unirse a partida waiting. */
matchesRouter.post('/:id/join', requireAuth, async (req, res, next) => {
  try {
    await sql`
      SELECT * FROM fn_join_match(${req.user!.uid}, ${req.params.id}::uuid, NULL, NULL)
    `
    const state = await getState(req.params.id, req.user!.uid)
    res.json({ state })
  } catch (err) {
    next(err)
  }
})

/** Entra a la cola PvP. Si hay alguien esperando, crea la partida al instante. */
matchesRouter.post('/queue', requireAuth, async (req, res, next) => {
  try {
    const timeControlS = z.number().int().min(60).max(1800).optional().parse(req.body?.timeControlS) ?? 300
    const rows = await sql`
      SELECT * FROM fn_enqueue_matchmaking(${req.user!.uid}, NULL, ${timeControlS})
    `
    const queue = rows[0] as Record<string, unknown>
    let state = null
    if (queue.status === 'matched' && queue.matched_match_id) {
      state = await getState(String(queue.matched_match_id), req.user!.uid)
    }
    res.json({ queue, state })
  } catch (err) {
    next(err)
  }
})

/** Estado de la cola del jugador (o última matched reciente). */
matchesRouter.get('/queue', requireAuth, async (req, res, next) => {
  try {
    const profile = await sql`
      SELECT id FROM profiles WHERE firebase_uid = ${req.user!.uid} LIMIT 1
    `
    const pid = profile[0]?.id as string | undefined
    if (!pid) {
      res.status(404).json({ error: 'profile not found' })
      return
    }
    const rows = await sql`
      SELECT * FROM matchmaking_queue
      WHERE profile_id = ${pid}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `
    const queue = (rows[0] as Record<string, unknown> | undefined) ?? null
    let state = null
    if (queue?.status === 'matched' && queue.matched_match_id) {
      state = await getState(String(queue.matched_match_id), req.user!.uid)
    }
    res.json({ queue, state })
  } catch (err) {
    next(err)
  }
})

matchesRouter.post('/queue/cancel', requireAuth, async (req, res, next) => {
  try {
    try {
      await sql`SELECT fn_cancel_matchmaking(${req.user!.uid})`
    } catch {
      // Fallback si el patch aún no está aplicado
      const profile = await sql`
        SELECT id FROM profiles WHERE firebase_uid = ${req.user!.uid} LIMIT 1
      `
      const pid = profile[0]?.id as string | undefined
      if (pid) {
        await sql`
          UPDATE matchmaking_queue SET status = 'cancelled'
          WHERE profile_id = ${pid}::uuid AND status = 'queued'
        `
      }
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/**
 * Tras esperar sin rival humano: cancela cola y crea bot.
 */
matchesRouter.post('/queue/bot', requireAuth, async (req, res, next) => {
  try {
    try {
      await sql`SELECT fn_cancel_matchmaking(${req.user!.uid})`
    } catch {
      const profile = await sql`
        SELECT id FROM profiles WHERE firebase_uid = ${req.user!.uid} LIMIT 1
      `
      const pid = profile[0]?.id as string | undefined
      if (pid) {
        await sql`
          UPDATE matchmaking_queue SET status = 'cancelled'
          WHERE profile_id = ${pid}::uuid AND status = 'queued'
        `
      }
    }
    const rows = await sql`
      SELECT * FROM fn_create_match(
        ${req.user!.uid},
        'bot'::match_mode,
        300,
        'white'::player_color,
        NULL,
        TRUE,
        FALSE
      )
    `
    const match = rows[0]
    const state = await getState(match.id as string, req.user!.uid)
    res.json({ match, state, vsBot: true })
  } catch (err) {
    next(err)
  }
})

matchesRouter.get('/catalog/jokers', async (_req, res, next) => {
  try {
    const rows = await sql`SELECT * FROM v_jokers_catalog ORDER BY faction, rarity, name`
    res.json({ jokers: rows })
  } catch (err) {
    next(err)
  }
})

matchesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const state = await getState(req.params.id, req.user!.uid)
    if (!state) {
      res.status(404).json({ error: 'match not found' })
      return
    }
    res.json({ state })
  } catch (err) {
    next(err)
  }
})

const moveSchema = z.object({
  from: z.string().length(2),
  to: z.string().length(2),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
  timeSpentMs: z.number().int().min(0).optional(),
})

matchesRouter.post('/:id/move', requireAuth, async (req, res, next) => {
  try {
    const body = moveSchema.parse(req.body ?? {})
    const matchId = req.params.id
    const moveInput: MoveInput = {
      from: body.from,
      to: body.to,
      promotion: body.promotion,
    }
    const timeSpentMs = body.timeSpentMs ?? 0

    const state = await getState(matchId, req.user!.uid)
    if (!state) {
      res.status(404).json({ error: 'match not found' })
      return
    }

    const match = state.match as Record<string, unknown>
    if (match.status !== 'active') {
      res.status(409).json({ error: 'match not in action phase' })
      return
    }

    const you = state.you as Record<string, unknown> | null
    if (!you || you.is_bot) {
      res.status(403).json({ error: 'not your match seat' })
      return
    }
    if (match.turn_color !== you.color) {
      res.status(409).json({ error: 'not your turn' })
      return
    }

    const ctx = await engineContextFor(matchId, state, you.color as Color)
    const result = applyPlayerMove(ctx, moveInput)
    if (result.ok === false) {
      res.status(400).json({ error: result.error })
      return
    }

    // El uci refleja el destino efectivo (espejo puede invertir el input)
    const effFrom = result.uci.slice(0, 2)
    const effTo = result.uci.slice(2, 4)

    await sql`
      SELECT * FROM fn_record_chess_move(
        ${req.user!.uid},
        ${matchId}::uuid,
        ${effFrom},
        ${effTo},
        ${result.san},
        ${result.uci},
        ${result.fenAfter},
        ${result.isCapture},
        ${result.isCheck},
        ${result.isMate},
        ${timeSpentMs},
        ${JSON.stringify({ events: result.events, ghost: result.ghostUsed })}::jsonb
      )
    `
    await persistEngineOps(matchId, result, { updateFen: false, cycleIndex: ctx.cycleIndex })

    // Bot reply if match still active and it's bot's turn
    let after = await getState(matchId, req.user!.uid)
    after = await maybeBotMove(matchId, after, req.user!.uid)

    // If shop phase, keep as is — client shows shop
    res.json({ state: after, events: result.events })
  } catch (err) {
    next(err)
  }
})

async function maybeBotMove(
  matchId: string,
  state: Record<string, unknown> | null,
  humanUid: string,
): Promise<Record<string, unknown> | null> {
  if (!state) return state
  const match = state.match as Record<string, unknown>
  if (match.status !== 'active') return state

  const players = (state.players as Array<Record<string, unknown>>) || []
  const bot = players.find((p) => p.is_bot)
  if (!bot) return state
  if (match.turn_color !== bot.color) return state

  // El bot pasa por el mismo motor que el humano (dimensiones incluidas).
  // En Espejo usa skipMirror: elige destinos legales reales (si no, se trababa).
  const ctx = await engineContextFor(matchId, state, bot.color as Color)
  const legal = listLegalMoves(ctx)
  if (!legal.length) return state

  const captures = legal.filter((m) => m.captured)
  const pool = [...(captures.length ? captures : legal)]
  // Mezcla y prueba hasta encontrar una jugada que el motor acepte
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }

  let result: ReturnType<typeof applyPlayerMove> | null = null
  for (const pick of pool) {
    const attempt = applyPlayerMove(ctx, botInputFor(ctx, pick))
    if (attempt.ok) {
      result = attempt
      break
    }
  }
  if (!result || !result.ok) return state

  // Bot firebase uid is system:roguebot — fn_record expects firebase_uid of the mover
  const botProfile = await sql`SELECT firebase_uid FROM profiles WHERE id = ${bot.profile_id}::uuid`
  const botUid = botProfile[0]?.firebase_uid as string

  await sql`
    SELECT * FROM fn_record_chess_move(
      ${botUid},
      ${matchId}::uuid,
      ${result.uci.slice(0, 2)},
      ${result.uci.slice(2, 4)},
      ${result.san},
      ${result.uci},
      ${result.fenAfter},
      ${result.isCapture},
      ${result.isCheck},
      ${result.isMate},
      ${800 + Math.floor(Math.random() * 1200)},
      ${JSON.stringify({ bot: true, events: result.events })}::jsonb
    )
  `
  await persistEngineOps(matchId, result, { updateFen: false, cycleIndex: ctx.cycleIndex })

  return getState(matchId, humanUid)
}

matchesRouter.post('/:id/shop/close', requireAuth, async (req, res, next) => {
  try {
    await sql`SELECT * FROM fn_player_ready_shop(${req.user!.uid}, ${req.params.id}::uuid)`
    let state = await getState(req.params.id, req.user!.uid)
    // Si ya salió de shop (ambos listos / timeout), el bot puede mover
    const match = state?.match as { status?: string } | undefined
    if (match?.status === 'active') {
      state = await maybeBotMove(req.params.id, state!, req.user!.uid)
    }
    res.json({ state })
  } catch (err) {
    next(err)
  }
})

/** Fuerza cierre de tienda si ya pasó el minuto. */
matchesRouter.post('/:id/shop/timeout', requireAuth, async (req, res, next) => {
  try {
    await sql`SELECT * FROM fn_force_close_shop_if_due(${req.params.id}::uuid)`
    let state = await getState(req.params.id, req.user!.uid)
    const match = state?.match as { status?: string } | undefined
    if (match?.status === 'active') {
      state = await maybeBotMove(req.params.id, state!, req.user!.uid)
    }
    res.json({ state })
  } catch (err) {
    next(err)
  }
})

matchesRouter.post('/:id/shop/buy', requireAuth, async (req, res, next) => {
  try {
    const offerId = z.string().uuid().parse(req.body?.offerId)
    await sql`SELECT * FROM fn_buy_joker(${req.user!.uid}, ${req.params.id}::uuid, ${offerId}::uuid)`
    const state = await getState(req.params.id, req.user!.uid)
    res.json({ state })
  } catch (err) {
    next(err)
  }
})

matchesRouter.post('/:id/shop/sell', requireAuth, async (req, res, next) => {
  try {
    const inventoryId = z.string().uuid().parse(req.body?.inventoryId)
    await sql`SELECT * FROM fn_sell_joker(${req.user!.uid}, ${req.params.id}::uuid, ${inventoryId}::uuid)`
    const state = await getState(req.params.id, req.user!.uid)
    res.json({ state })
  } catch (err) {
    next(err)
  }
})

const sqSchema = z.string().regex(/^[a-h][1-8]$/, 'casilla inválida (a1..h8)')

/** Payload requerido por código de comodín. */
const jokerPayloadSchemas: Record<string, z.ZodTypeAny> = {
  aparicion: z.object({ a: sqSchema, b: sqSchema }),
  imperius: z.object({ from: sqSchema, to: sqSchema }),
  avada_kedavra: z.object({ square: sqSchema }),
  morsmordre: z.object({ square: sqSchema }),
  bombarda: z.object({ square: sqSchema }),
  defodio: z.object({ square: sqSchema }),
  capa_invisibilidad: z.object({ square: sqSchema }),
  pocion_multijugos: z.object({ square: sqSchema }),
}

/** code → effect_kind (espejo del CASE en fn_consume_joker). */
const codeToKind: Record<string, string> = {
  paso_fantasma: 'ghost_step',
  imperius: 'imperius',
  capa_invisibilidad: 'invisibility',
  morsmordre: 'morsmordre',
  expecto_patronum: 'expecto_patronum',
  bombarda: 'bombarda_burn',
  aparicion: 'aparicion',
  pocion_multijugos: 'multijugos',
  defodio: 'defodio_trap',
  avada_kedavra: 'avada_kedavra',
  axio_tempus: 'axio_tempus',
  arresto_momentum: 'arresto_momentum',
  petrificus_totalus: 'petrificus_totalus',
  giratiempo: 'giratiempo',
}

/**
 * Efectos cuyo estado ya quedó aplicado (FEN/celdas/flags/reloj): el effect
 * row que inserta fn_consume_joker se desactiva de inmediato. Persisten:
 * ghost_step (se consume al mover), invisibility y expecto_patronum.
 */
const INSTANT_EFFECT_KINDS = [
  'aparicion',
  'avada_kedavra',
  'morsmordre',
  'bombarda_burn',
  'defodio_trap',
  'imperius',
  'multijugos',
  'axio_tempus',
  'arresto_momentum',
  'petrificus_totalus',
  'giratiempo',
]

matchesRouter.post('/:id/joker/use', requireAuth, async (req, res, next) => {
  try {
    const matchId = req.params.id
    const inventoryId = z.string().uuid().parse(req.body?.inventoryId)
    const rawPayload = (req.body?.payload ?? {}) as Record<string, unknown>

    const invRows = await sql`
      SELECT mi.id, j.code
      FROM match_inventory mi
      JOIN jokers j ON j.id = mi.joker_id
      WHERE mi.id = ${inventoryId}::uuid AND mi.status = 'owned'
      LIMIT 1
    `
    if (!invRows.length) {
      res.status(404).json({ error: 'joker not in inventory' })
      return
    }
    const code = invRows[0].code as string

    const schema = jokerPayloadSchemas[code]
    let payload: Record<string, unknown> = {}
    if (schema) {
      const parsed = schema.safeParse(rawPayload)
      if (!parsed.success) {
        const fields = Object.keys((schema as z.ZodObject<z.ZodRawShape>).shape).join(', ')
        res.status(400).json({
          error: `El comodín ${code} necesita objetivo: { ${fields} } (casillas a1..h8)`,
        })
        return
      }
      payload = parsed.data as Record<string, unknown>
    }

    const state = await getState(matchId, req.user!.uid)
    if (!state) {
      res.status(404).json({ error: 'match not found' })
      return
    }
    const match = state.match as Record<string, unknown>
    if (match.status !== 'active') {
      res.status(409).json({ error: 'los comodines se usan en la fase de acción' })
      return
    }
    const you = state.you as Record<string, unknown> | null
    if (!you || you.is_bot) {
      res.status(403).json({ error: 'not your match seat' })
      return
    }
    if (match.turn_color !== you.color) {
      res.status(409).json({ error: 'no es tu turno — los comodines solo en tu turno' })
      return
    }

    const ctx = await engineContextFor(matchId, state, you.color as Color)
    const result = applyJoker(ctx, code, payload)
    if (result.ok === false) {
      res.status(400).json({ error: result.error })
      return
    }

    // 1) SQL: marca consumed, inserta effect row y aplica efectos de reloj (Tempus)
    await sql`
      SELECT * FROM fn_consume_joker(
        ${req.user!.uid},
        ${matchId}::uuid,
        ${inventoryId}::uuid,
        ${JSON.stringify({ ...payload, events: result.events })}::jsonb
      )
    `

    // 2) Motor: FEN / celdas / flags / relojes calculados
    await persistEngineOps(matchId, result, { updateFen: true, cycleIndex: ctx.cycleIndex })

    // 3) Efectos instantáneos: no dejar el row activo colgando
    const kind = codeToKind[code]
    if (kind && INSTANT_EFFECT_KINDS.includes(kind)) {
      await sql`
        UPDATE match_effects SET is_active = FALSE
        WHERE match_id = ${matchId}::uuid AND kind = ${kind}::effect_kind AND is_active
      `
    }

    const after = await getState(matchId, req.user!.uid)
    res.json({ state: after, events: result.events, fizzled: result.fizzled ?? false })
  } catch (err) {
    next(err)
  }
})

matchesRouter.post('/:id/timeout', requireAuth, async (req, res, next) => {
  try {
    const matchId = req.params.id
    const state = await getState(matchId, req.user!.uid)
    if (!state) {
      res.status(404).json({ error: 'match not found' })
      return
    }
    const you = state.you as Record<string, unknown> | null
    if (!you) {
      res.status(403).json({ error: 'not in match' })
      return
    }

    const matchRows = await sql`
      SELECT * FROM matches WHERE id = ${matchId}::uuid LIMIT 1
    `
    const m = matchRows[0] as Record<string, unknown> | undefined
    if (!m) {
      res.status(404).json({ error: 'match not found' })
      return
    }
    if (m.status === 'finished') {
      res.json({ state: await getState(matchId, req.user!.uid) })
      return
    }
    if (m.status !== 'active') {
      res.status(409).json({ error: 'el reloj no corre fuera de la fase de acción' })
      return
    }

    const running = m.clock_running_for as 'white' | 'black' | null
    if (!running) {
      res.status(409).json({ error: 'el reloj está en pausa' })
      return
    }

    const players = await sql`
      SELECT id, color, arresto_pending, time_ms, profile_id
      FROM match_players WHERE match_id = ${matchId}::uuid
    `
    const flagged = players.find((p) => p.color === running) as
      | { id: string; color: string; arresto_pending: boolean; time_ms: number; profile_id: string }
      | undefined
    if (!flagged) {
      res.status(500).json({ error: 'jugador del reloj no encontrado' })
      return
    }

    const updatedAt = m.clock_updated_at ? new Date(String(m.clock_updated_at)).getTime() : null
    const elapsed =
      updatedAt != null && Number.isFinite(updatedAt)
        ? Math.max(0, Date.now() - updatedAt)
        : 0
    const rate = flagged.arresto_pending ? 2 : 1
    const spend = elapsed * rate

    const stored =
      running === 'white' ? Number(m.white_time_ms) : Number(m.black_time_ms)
    const remaining = Math.max(0, stored - spend)

    // Actualizar relojes al instante del claim
    if (running === 'white') {
      await sql`
        UPDATE matches SET
          white_time_ms = ${remaining},
          clock_updated_at = now()
        WHERE id = ${matchId}::uuid
      `
    } else {
      await sql`
        UPDATE matches SET
          black_time_ms = ${remaining},
          clock_updated_at = now()
        WHERE id = ${matchId}::uuid
      `
    }
    await sql`
      UPDATE match_players SET time_ms = ${remaining}
      WHERE id = ${flagged.id}::uuid
    `
    if (flagged.arresto_pending && spend > 0) {
      await sql`
        UPDATE match_players SET arresto_pending = FALSE WHERE id = ${flagged.id}::uuid
      `
    }

    if (remaining > 0) {
      res.status(409).json({
        error: 'aún queda tiempo en el reloj',
        remainingMs: remaining,
        state: await getState(matchId, req.user!.uid),
      })
      return
    }

    const winnerId =
      running === 'white' ? (m.black_id as string) : (m.white_id as string)

    await sql`
      SELECT * FROM fn_finish_match(
        ${matchId}::uuid,
        'timeout'::match_result,
        ${winnerId}::uuid
      )
    `

    const after = await getState(matchId, req.user!.uid)
    res.json({ state: after })
  } catch (err) {
    next(err)
  }
})

matchesRouter.post('/:id/resign', requireAuth, async (req, res, next) => {
  try {
    await sql`SELECT * FROM fn_resign(${req.user!.uid}, ${req.params.id}::uuid)`
    const state = await getState(req.params.id, req.user!.uid)
    res.json({ state })
  } catch (err) {
    next(err)
  }
})
