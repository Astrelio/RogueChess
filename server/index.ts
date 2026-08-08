import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { leaderboardRouter } from './routes/leaderboard.js'
import { profilesRouter } from './routes/profiles.js'
import { developersRouter } from './routes/developers.js'
import { matchesRouter } from './routes/matches.js'
import { requireAuth } from './middleware/auth.js'

const app = express()
const port = Number(process.env.PORT || 8787)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'roguechess-api', phase: 2 })
})

app.use('/api/auth', authRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/profiles', profilesRouter)
app.use('/api/developers', developersRouter)
app.use('/api/matches', matchesRouter)

app.post('/api/presence/heartbeat', requireAuth, async (req, res, next) => {
  try {
    const { sql } = await import('./db.js')
    const presence = (req.body?.presence as string) || 'online'
    const allowed = new Set(['online', 'away', 'playing', 'spectating', 'offline'])
    if (!allowed.has(presence)) {
      res.status(400).json({ error: 'invalid presence' })
      return
    }
    const rows = await sql`
      SELECT * FROM fn_set_presence(${req.user!.uid}, ${presence}::presence_status)
    `
    res.json({ profile: rows[0] })
  } catch (err) {
    next(err)
  }
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  const message = err instanceof Error ? err.message : 'internal error'
  res.status(500).json({ error: message })
})

app.listen(port, () => {
  console.log(`RogueChess API on http://localhost:${port}`)
})
