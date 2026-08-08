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
    const result = rows[0] as { ok: boolean; message: string; developer_id: string | null; heart_count: number | null }
    if (!result.ok) {
      res.status(409).json(result)
      return
    }
    res.json(result)
  } catch (err) {
    next(err)
  }
})
