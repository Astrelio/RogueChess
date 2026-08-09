import { Router } from 'express'
import { z } from 'zod'
import { sql } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const developersRouter = Router()

developersRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await sql`SELECT * FROM v_developers_public`
    res.json({ developers: rows })
  } catch (err) {
    next(err)
  }
})

const heartSchema = z.object({
  slug: z.string().min(2).max(40),
})

developersRouter.post('/heart', requireAuth, async (req, res, next) => {
  try {
    const body = heartSchema.parse(req.body ?? {})
    const rows = await sql`
      SELECT * FROM fn_give_developer_heart(${req.user!.uid}, ${body.slug})
    `
    const result = rows[0] as {
      ok: boolean
      message: string
      liked_developer_id?: string | null
      developer_id?: string | null
      hearts?: number | null
      heart_count?: number | null
    }
    if (!result.ok) {
      res.status(409).json({
        ok: false,
        message: result.message,
        heart_count: result.hearts ?? result.heart_count ?? null,
      })
      return
    }
    res.json({
      ok: true,
      message: result.message,
      heart_count: result.hearts ?? result.heart_count ?? null,
    })
  } catch (err) {
    next(err)
  }
})
