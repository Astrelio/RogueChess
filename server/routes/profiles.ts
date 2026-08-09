import { Router } from 'express'
import { z } from 'zod'
import { sql } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const profilesRouter = Router()

profilesRouter.get('/:username', async (req, res, next) => {
  try {
    const rows = await sql`SELECT * FROM fn_get_profile_by_username(${req.params.username})`
    const profile = rows[0] as { id: string; presence?: string } | undefined
    if (!profile) {
      res.status(404).json({ error: 'not found' })
      return
    }

    // Partida en vivo para el botón "Espectar". No dependemos de presence
    // (el heartbeat la puede pisar con 'online'): v_match_live es la autoridad.
    const live = await sql`
      SELECT id, allow_spectators FROM v_match_live
      WHERE (white_id = ${profile.id}::uuid OR black_id = ${profile.id}::uuid)
        AND status IN ('active', 'shop', 'dimension_reveal')
      ORDER BY created_at DESC
      LIMIT 1
    `
    const liveMatch = (live[0] as Record<string, unknown>) ?? null

    res.json({ profile, liveMatch })
  } catch (err) {
    next(err)
  }
})

const moodSchema = z.object({
  moodText: z.string().max(80).nullable().optional(),
  moodEmoji: z.string().max(16).nullable().optional(),
})

profilesRouter.patch('/me/mood', requireAuth, async (req, res, next) => {
  try {
    const body = moodSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_set_mood(
        ${req.user!.uid},
        ${body.moodText ?? null},
        ${body.moodEmoji ?? null}
      )
    `
    res.json({ profile: rows[0] })
  } catch (err) {
    next(err)
  }
})

const updateSchema = z.object({
  displayName: z.string().min(1).max(48).optional(),
  username: z.string().min(3).max(24).optional(),
  bio: z.string().max(280).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
})

profilesRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_update_profile(
        ${req.user!.uid},
        ${body.displayName ?? null},
        ${body.username ?? null},
        ${body.bio ?? null},
        ${body.avatarUrl ?? null}
      )
    `
    res.json({ profile: rows[0] })
  } catch (err) {
    next(err)
  }
})

const likeSchema = z.object({
  toUsername: z.string().min(3).max(24),
})

profilesRouter.post('/super-like', requireAuth, async (req, res, next) => {
  try {
    const body = likeSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_give_super_like(${req.user!.uid}, ${body.toUsername})
    `
    const result = rows[0] as {
      ok: boolean
      message: string
      liked_profile_id?: string | null
      to_profile_id?: string | null
      popularity?: number | null
      popularity_score?: number | null
    }
    if (!result.ok) {
      res.status(409).json({
        ok: false,
        message: result.message,
        popularity_score: result.popularity ?? result.popularity_score ?? null,
      })
      return
    }
    res.json({
      ok: true,
      message: result.message,
      popularity_score: result.popularity ?? result.popularity_score ?? null,
    })
  } catch (err) {
    next(err)
  }
})
