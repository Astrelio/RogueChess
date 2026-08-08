import { Router } from 'express'
import { searchSpotifyTracks, spotifyConfigured } from '../spotify.js'
import { requireAuth } from '../middleware/auth.js'

export const spotifyRouter = Router()

spotifyRouter.get('/status', (_req, res) => {
  res.json({ configured: spotifyConfigured() })
})

spotifyRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    if (!spotifyConfigured()) {
      res.status(503).json({
        error: 'Spotify no configurado',
        hint: 'Añade SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en el entorno de la API',
      })
      return
    }

    const q = String(req.query.q ?? '').trim()
    if (q.length < 2) {
      res.status(400).json({ error: 'q debe tener al menos 2 caracteres' })
      return
    }
    if (q.length > 120) {
      res.status(400).json({ error: 'q demasiado largo' })
      return
    }

    const limit = Number(req.query.limit ?? 8)
    const tracks = await searchSpotifyTracks(q, Number.isFinite(limit) ? limit : 8)
    res.json({ tracks })
  } catch (err) {
    next(err)
  }
})
