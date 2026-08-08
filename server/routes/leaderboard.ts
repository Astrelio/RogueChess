import { Router } from 'express'
import { sql } from '../db.js'

export const leaderboardRouter = Router()

leaderboardRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const rows = await sql`SELECT * FROM fn_get_leaderboard(${limit}, ${offset})`
    res.json({ entries: rows })
  } catch (err) {
    next(err)
  }
})
