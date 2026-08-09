import { Router } from 'express'
import { z } from 'zod'
import { sql } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  applyJoker,
  applyPlayerMove,
  botInputFor,
  buildContext,
  JOKER_BUY_PRIORITY,
  listLegalMoves,
  pickBotMove,
  planBotJoker,
  type BotInvItem,
  type Color,
  type MoveInput,
  type PieceFlag,
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
  const spectators = (state.spectators as Array<Record<string, unknown>>) || []
  const profileIds = [
    ...new Set([
      ...players.map((p) => p.profile_id as string),
      ...spectators.map((s) => s.profile_id as string),
    ].filter(Boolean)),
  ]
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
  const enrichedSpectators = spectators.map((s) => ({
    ...s,
    username: profilesById[s.profile_id as string]?.username,
    display_name: profilesById[s.profile_id as string]?.display_name,
  }))

  const flags = await getPieceFlags(matchId)

  // Reacciones de espectador recientes: canal de entrega de respaldo vía el
  // polling del cliente (el WS de Portal a veces no entrega ephemerals).
  const recentEmojis = await sql`
    SELECT se.id, se.emoji, se.created_at, p.username, p.firebase_uid AS from_uid
    FROM spectator_emojis se
    JOIN profiles p ON p.id = se.from_profile_id
    WHERE se.match_id = ${matchId}::uuid
      AND se.created_at > now() - interval '20 seconds'
    ORDER BY se.created_at ASC
  `

  return {
    ...state,
    players: enrichedPlayers,
    spectators: enrichedSpectators,
    shop: enrichedShop,
    inventory: enrichedInv,
    flags,
    you,
    recent_emojis: recentEmojis,
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

const createRoomSchema = z.object({
  timeControlS: z.number().int().min(60).max(1800).optional().default(300),
  allowSpectators: z.boolean().optional().default(true),
  /** 'custom' genera invite_code; 'quick' queda sin código (legacy). */
  mode: z.enum(['custom', 'quick']).optional().default('custom'),
  /** Si se indica, marca match_invites.to_profile_id para la bandeja del rival. */
  inviteUsername: z.string().trim().min(2).max(32).optional(),
})

async function bindInviteToUsername(matchId: string, inviteUsername: string | undefined) {
  const username = inviteUsername?.replace(/^@/, '').trim()
  if (!username) return
  await sql`
    UPDATE match_invites mi
    SET to_profile_id = p.id
    FROM profiles p
    WHERE mi.match_id = ${matchId}::uuid
      AND lower(p.username) = lower(${username})
      AND mi.to_profile_id IS NULL
  `
}

/** Crea partida en waiting (reto Portal / sala personalizada). Mode custom → invite_code. */
matchesRouter.post('/challenge', requireAuth, async (req, res, next) => {
  try {
    const body = createRoomSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_create_match(
        ${req.user!.uid},
        ${body.mode}::match_mode,
        ${body.timeControlS},
        'white'::player_color,
        NULL,
        ${body.allowSpectators},
        TRUE
      )
    `
    const match = rows[0] as { id: string }
    await bindInviteToUsername(match.id, body.inviteUsername)
    const state = await getState(match.id, req.user!.uid)
    res.json({ match, state })
  } catch (err) {
    next(err)
  }
})

/** Alias explícito de sala personalizada (siempre mode=custom). */
matchesRouter.post('/custom', requireAuth, async (req, res, next) => {
  try {
    const body = createRoomSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_create_match(
        ${req.user!.uid},
        'custom'::match_mode,
        ${body.timeControlS},
        'white'::player_color,
        NULL,
        ${body.allowSpectators},
        TRUE
      )
    `
    const match = rows[0] as { id: string }
    await bindInviteToUsername(match.id, body.inviteUsername)
    const state = await getState(match.id, req.user!.uid)
    res.json({ match, state })
  } catch (err) {
    next(err)
  }
})

/** Invitaciones pendientes dirigidas a mí (bandeja; respaldo si Portal no empuja). */
matchesRouter.get('/invites/pending', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT
        mi.id AS invite_id,
        mi.match_id,
        mi.code AS invite_code,
        mi.created_at,
        mi.expires_at,
        m.status AS match_status,
        m.time_control_s,
        m.allow_spectators,
        pf.username AS from_username,
        pf.display_name AS from_display_name,
        pf.firebase_uid AS from_uid
      FROM match_invites mi
      JOIN matches m ON m.id = mi.match_id
      JOIN profiles pf ON pf.id = mi.from_profile_id
      JOIN profiles me ON me.firebase_uid = ${req.user!.uid}
      WHERE mi.to_profile_id = me.id
        AND mi.accepted = FALSE
        AND mi.expires_at > now()
        AND m.status = 'waiting'
      ORDER BY mi.created_at DESC
      LIMIT 20
    `
    res.json({ invites: rows })
  } catch (err) {
    next(err)
  }
})

const joinByCodeSchema = z.object({
  code: z.string().trim().min(3).max(16),
})

/** Unirse a sala personalizada por invite_code (ruta estática antes de /:id). */
matchesRouter.post('/join-by-code', requireAuth, async (req, res, next) => {
  try {
    const { code } = joinByCodeSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_join_match(${req.user!.uid}, NULL, ${code.toUpperCase()}, NULL)
    `
    const match = rows[0] as { id: string }
    const state = await getState(match.id, req.user!.uid)
    res.json({ match, state })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (/not found|invalid|expired|full|already/i.test(message)) {
      res.status(409).json({ error: message || 'No se pudo unir con ese código' })
      return
    }
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

    // Partida tutorial: regalar comodines de arranque al humano para que
    // pueda practicar la bandeja sin esperar a la primera tienda.
    if (req.body?.tutorial === true) {
      try {
        const mp = await sql`
          SELECT mp.id FROM match_players mp
          JOIN profiles p ON p.id = mp.profile_id
          WHERE mp.match_id = ${match.id}::uuid AND p.firebase_uid = ${req.user!.uid}
          LIMIT 1
        `
        const mpId = mp[0]?.id as string | undefined
        if (mpId) {
          await sql`
            INSERT INTO match_inventory (match_id, match_player_id, joker_id, acquired_cycle, slot_index, metadata)
            SELECT ${match.id}::uuid, ${mpId}::uuid, j.id, 0, seed.slot::smallint, '{"tutorial": true}'::jsonb
            FROM (VALUES ('axio_tempus', 0), ('avada_kedavra', 1)) AS seed(code, slot)
            JOIN jokers j ON j.code = seed.code
          `
        }
      } catch (err) {
        console.warn('tutorial joker seed failed', err)
      }
    }

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
    try {
      const afterStatus = (after?.match as { status?: string } | undefined)?.status
      if (afterStatus === 'shop') {
        after = await maybeBotBuyJokers(matchId, after!, req.user!.uid)
      }
      after = await maybeBotMove(matchId, after, req.user!.uid)
    } catch (botErr) {
      console.warn('maybeBotMove failed', botErr)
      after = (await getState(matchId, req.user!.uid)) ?? after
    }

    // If shop phase, keep as is — client shows shop
    res.json({ state: after, events: result.events })
  } catch (err) {
    next(err)
  }
})

const codeToKindEarly: Record<string, string> = {
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

const INSTANT_EFFECT_KINDS_BOT = [
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

async function maybeBotMove(
  matchId: string,
  state: Record<string, unknown> | null,
  humanUid: string,
  depth = 0,
): Promise<Record<string, unknown> | null> {
  if (!state || depth > 2) return state
  const match = state.match as Record<string, unknown>
  if (match.status === 'shop' || match.phase === 'shop') {
    return maybeBotBuyJokers(matchId, state, humanUid)
  }
  if (match.status !== 'active') return state

  const players = (state.players as Array<Record<string, unknown>>) || []
  const bot = players.find((p) => p.is_bot)
  if (!bot) return state
  if (match.turn_color !== bot.color) return state

  const botProfile = await sql`SELECT firebase_uid FROM profiles WHERE id = ${bot.profile_id}::uuid`
  const botUid = botProfile[0]?.firebase_uid as string | undefined
  if (!botUid) return state

  let ctx = await engineContextFor(matchId, state, bot.color as Color)
  const flags = await getPieceFlags(matchId)

  const invRows = await sql`
    SELECT mi.id, j.code, mi.match_player_id
    FROM match_inventory mi
    JOIN jokers j ON j.id = mi.joker_id
    WHERE mi.match_player_id = ${bot.id}::uuid AND mi.status = 'owned'
  `
  const inventory = invRows as BotInvItem[]

  const human = players.find((p) => !p.is_bot)
  const clocks = {
    botMs: Number(bot.color === 'white' ? match.white_time_ms : match.black_time_ms) || 0,
    humanMs:
      Number(
        human
          ? human.color === 'white'
            ? match.white_time_ms
            : match.black_time_ms
          : 0,
      ) || 0,
  }

  const plan = planBotJoker(ctx, inventory, flags as PieceFlag[], clocks)
  if (plan) {
    const jokerResult = applyJoker(ctx, plan.code, plan.payload)
    if (jokerResult.ok) {
      try {
        await sql`
          SELECT * FROM fn_consume_joker(
            ${botUid},
            ${matchId}::uuid,
            ${plan.inventoryId}::uuid,
            ${JSON.stringify({ ...plan.payload, events: jokerResult.events, bot: true })}::jsonb
          )
        `
        await persistEngineOps(matchId, jokerResult, {
          updateFen: true,
          cycleIndex: ctx.cycleIndex,
        })
        const kind = codeToKindEarly[plan.code]
        if (kind && INSTANT_EFFECT_KINDS_BOT.includes(kind)) {
          await sql`
            UPDATE match_effects SET is_active = FALSE
            WHERE match_id = ${matchId}::uuid AND kind = ${kind}::effect_kind AND is_active
          `
        }
        state = (await getState(matchId, humanUid)) ?? state
        ctx = await engineContextFor(matchId, state, bot.color as Color)
      } catch (err) {
        console.warn('bot joker failed', plan.code, err)
      }
    }
  }

  const pick = pickBotMove(ctx, { depth: 3, timeMs: 850 })
  if (!pick) return state

  let result = applyPlayerMove(ctx, botInputFor(ctx, pick))
  if (!result.ok) {
    for (const m of listLegalMoves(ctx)) {
      const attempt = applyPlayerMove(ctx, botInputFor(ctx, m))
      if (attempt.ok) {
        result = attempt
        break
      }
    }
  }
  if (!result.ok) return state

  await recordBotMove(matchId, botUid, result, ctx.cycleIndex)
  let after = await getState(matchId, humanUid)

  const afterMatch = after?.match as Record<string, unknown> | undefined
  if (afterMatch?.status === 'shop' || afterMatch?.phase === 'shop') {
    after = await maybeBotBuyJokers(matchId, after!, humanUid)
  }

  return maybeBotMove(matchId, after, humanUid, depth + 1)
}

async function recordBotMove(
  matchId: string,
  botUid: string,
  result: Extract<ReturnType<typeof applyPlayerMove>, { ok: true }>,
  cycleIndex: number,
) {
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
      ${600 + Math.floor(Math.random() * 900)},
      ${JSON.stringify({ bot: true, events: result.events })}::jsonb
    )
  `
  await persistEngineOps(matchId, result, { updateFen: false, cycleIndex })
}

/** Compra agresiva en tienda: llena slots con los mejores comodines asequibles. */
async function maybeBotBuyJokers(
  matchId: string,
  state: Record<string, unknown>,
  humanUid: string,
): Promise<Record<string, unknown>> {
  const players = (state.players as Array<Record<string, unknown>>) || []
  const bot = players.find((p) => p.is_bot)
  if (!bot) return state
  const match = state.match as Record<string, unknown>
  if (match.status !== 'shop' && match.phase !== 'shop') return state

  const botProfile = await sql`SELECT firebase_uid FROM profiles WHERE id = ${bot.profile_id}::uuid`
  const botUid = botProfile[0]?.firebase_uid as string | undefined
  if (!botUid) return state

  const owned = await sql`
    SELECT count(*)::int AS n FROM match_inventory
    WHERE match_player_id = ${bot.id}::uuid AND status = 'owned'
  `
  const ownedN = Number(owned[0]?.n ?? 0)
  const slots = Number(bot.inventory_slots ?? 3)
  let free = Math.max(0, slots - ownedN)
  if (free <= 0) return state

  const cycle = Number(match.cycle_index ?? 0)
  const offers = await sql`
    SELECT so.id, so.cost_seconds, j.code
    FROM shop_offers so
    JOIN jokers j ON j.id = so.joker_id
    WHERE so.match_id = ${matchId}::uuid
      AND so.match_player_id = ${bot.id}::uuid
      AND so.cycle_index = ${cycle}
      AND so.purchased = FALSE
      AND so.expired = FALSE
  `

  const ranked = [...(offers as Array<{ id: string; cost_seconds: number; code: string }>)].sort(
    (a, b) => (JOKER_BUY_PRIORITY[b.code] ?? 0) - (JOKER_BUY_PRIORITY[a.code] ?? 0),
  )

  let timeMs = Number(bot.time_ms ?? 0)
  for (const offer of ranked) {
    if (free <= 0) break
    const costMs = Number(offer.cost_seconds) * 1000
    if (timeMs - costMs < 25_000) continue
    try {
      await sql`SELECT * FROM fn_buy_joker(${botUid}, ${matchId}::uuid, ${offer.id}::uuid)`
      timeMs -= costMs
      free--
    } catch (err) {
      console.warn('bot buy failed', offer.code, err)
    }
  }

  return (await getState(matchId, humanUid)) ?? state
}

matchesRouter.post('/:id/shop/close', requireAuth, async (req, res, next) => {
  try {
    await sql`SELECT * FROM fn_player_ready_shop(${req.user!.uid}, ${req.params.id}::uuid)`
    let state = await getState(req.params.id, req.user!.uid)
    // Si ya salió de shop (ambos listos / timeout), el bot puede mover
    const match = state?.match as { status?: string } | undefined
    if (match?.status === 'active') {
      try {
        state = await maybeBotMove(req.params.id, state!, req.user!.uid)
      } catch (botErr) {
        console.warn('maybeBotMove after shop close failed', botErr)
        state = (await getState(req.params.id, req.user!.uid)) ?? state
      }
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
      try {
        state = await maybeBotMove(req.params.id, state!, req.user!.uid)
      } catch (botErr) {
        console.warn('maybeBotMove after shop timeout failed', botErr)
        state = (await getState(req.params.id, req.user!.uid)) ?? state
      }
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

/** Unirse como espectador (Neon = autoridad; idempotente por ON CONFLICT). */
matchesRouter.post('/:id/spectate', requireAuth, async (req, res, next) => {
  try {
    await sql`SELECT * FROM fn_join_spectate(${req.user!.uid}, ${req.params.id}::uuid)`
    const state = await getState(req.params.id, req.user!.uid)
    res.json({ state })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('match not found')) {
      res.status(404).json({ error: 'match not found' })
      return
    }
    if (
      message.includes('spectators disabled') ||
      message.includes('players cannot spectate') ||
      message.includes('spectator cap reached')
    ) {
      res.status(409).json({ error: message })
      return
    }
    next(err)
  }
})

const spectatorEmojiSchema = z.object({
  emoji: z.string().trim().min(1).max(8),
})

/** Emoji de espectador. Neon valida pertenencia + cooldown; el fan-out en vivo lo hace el cliente vía Portal. */
matchesRouter.post('/:id/spectator-emoji', requireAuth, async (req, res, next) => {
  try {
    const body = spectatorEmojiSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_send_spectator_emoji(${req.user!.uid}, ${req.params.id}::uuid, ${body.emoji})
    `
    res.json({ ok: true, emoji: rows[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('not spectating')) {
      res.status(403).json({ error: 'not spectating' })
      return
    }
    if (message.includes('emoji cooldown')) {
      res.status(429).json({ error: 'emoji cooldown' })
      return
    }
    next(err)
  }
})
