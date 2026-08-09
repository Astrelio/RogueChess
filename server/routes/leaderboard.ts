import { Router } from 'express'
import { sql } from '../db.js'

export const leaderboardRouter = Router()

leaderboardRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const rows = await sql`SELECT * FROM fn_get_leaderboard(${limit}, ${offset})`

    // "En duelo" solo si la partida está viva de verdad:
    // - status de combate (no waiting)
    // - updated_at reciente (cada jugada/tienda lo toca) → descarta abandonadas
    // - ambos asientos ocupados
    // - al menos un jugador con last_seen reciente (sigue en la app)
    const live = (await sql`
      SELECT m.white_id, m.black_id
      FROM matches m
      WHERE m.status IN ('active', 'shop', 'dimension_reveal')
        AND m.white_id IS NOT NULL
        AND m.black_id IS NOT NULL
        AND m.updated_at > now() - interval '3 minutes'
        AND EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id IN (m.white_id, m.black_id)
            AND p.last_seen_at > now() - interval '90 seconds'
        )
    `) as Array<{ white_id: string | null; black_id: string | null }>
    const inMatch = new Set<string>()
    for (const m of live) {
      if (m.white_id) inMatch.add(m.white_id)
      if (m.black_id) inMatch.add(m.black_id)
    }

    // Buscando partida: cola abierta y no expirada
    const searchingRows = (await sql`
      SELECT profile_id FROM matchmaking_queue
      WHERE status = 'queued' AND expires_at > now()
    `) as Array<{ profile_id: string }>
    const searching = new Set(searchingRows.map((r) => r.profile_id))

    const entries = (rows as Array<{ id: string }>).map((r) => ({
      ...r,
      is_in_match: inMatch.has(r.id),
      // Prioridad: en partida gana sobre buscando
      is_searching: !inMatch.has(r.id) && searching.has(r.id),
    }))
    res.json({ entries })
  } catch (err) {
    next(err)
  }
})
