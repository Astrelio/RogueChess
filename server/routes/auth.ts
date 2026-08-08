import { Router } from 'express'
import { z } from 'zod'
import { sql } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

const syncSchema = z.object({
  displayName: z.string().max(48).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  usernameHint: z.string().max(24).optional(),
})

authRouter.post('/sync', requireAuth, async (req, res, next) => {
  try {
    const body = syncSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_upsert_profile(
        ${req.user!.uid},
        ${req.user!.email ?? null},
        ${body.displayName ?? null},
        ${body.avatarUrl ?? null},
        ${body.usernameHint ?? null}
      )
    `
    res.json({ profile: rows[0] })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`SELECT * FROM fn_get_profile_by_firebase(${req.user!.uid})`
    if (!rows[0]) {
      res.status(404).json({ error: 'profile not found — call /api/auth/sync first' })
      return
    }
    res.json({ profile: rows[0] })
  } catch (err) {
    next(err)
  }
})
