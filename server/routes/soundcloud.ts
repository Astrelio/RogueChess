import { Router } from 'express'

/**
 * Metadatos de pistas de SoundCloud vía su oEmbed público (sin API key).
 * La reproducción la hace el widget embebido oficial en el frontend.
 */
export const soundcloudRouter = Router()

const ALLOWED_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
])

soundcloudRouter.get('/resolve', async (req, res, next) => {
  try {
    const raw = String(req.query.url ?? '').trim()
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      res.status(400).json({ error: 'url inválida' })
      return
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      res.status(400).json({ error: 'Solo se aceptan enlaces de soundcloud.com' })
      return
    }

    // Enlaces cortos on.soundcloud.com → seguir la redirección a la URL canónica
    let trackUrl = parsed.toString()
    if (parsed.hostname === 'on.soundcloud.com') {
      const followed = await fetch(trackUrl, { redirect: 'follow' })
      const finalUrl = new URL(followed.url)
      if (!finalUrl.hostname.endsWith('soundcloud.com')) {
        res.status(400).json({ error: 'El enlace corto no apunta a SoundCloud' })
        return
      }
      trackUrl = finalUrl.toString()
    }

    const oembed = new URL('https://soundcloud.com/oembed')
    oembed.searchParams.set('format', 'json')
    oembed.searchParams.set('url', trackUrl)
    const r = await fetch(oembed)
    if (!r.ok) {
      res.status(404).json({ error: 'SoundCloud no encontró esa pista' })
      return
    }
    const data = (await r.json()) as {
      title?: string
      author_name?: string
      thumbnail_url?: string
    }
    res.json({
      url: trackUrl,
      title: data.title ?? 'Pista de SoundCloud',
      author: data.author_name ?? '',
      thumbnail: data.thumbnail_url ?? null,
    })
  } catch (err) {
    next(err)
  }
})
