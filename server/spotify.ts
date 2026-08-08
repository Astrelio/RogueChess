/** Cliente Spotify (Client Credentials) para búsqueda en partida. */

type TokenCache = {
  accessToken: string
  expiresAt: number
}

let cache: TokenCache | null = null

export function spotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
}

export async function getSpotifyAppToken(): Promise<string> {
  if (!spotifyConfigured()) {
    throw new Error('Spotify no configurado (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET)')
  }

  const now = Date.now()
  if (cache && cache.expiresAt > now + 30_000) {
    return cache.accessToken
  }

  const id = process.env.SPOTIFY_CLIENT_ID!
  const secret = process.env.SPOTIFY_CLIENT_SECRET!
  const basic = Buffer.from(`${id}:${secret}`).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify token failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return cache.accessToken
}

export type SpotifyTrackHit = {
  id: string
  name: string
  artists: string
  album: string
  imageUrl: string | null
  uri: string
  externalUrl: string
  durationMs: number
}

export async function searchSpotifyTracks(query: string, limit = 8): Promise<SpotifyTrackHit[]> {
  const token = await getSpotifyAppToken()
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'track')
  url.searchParams.set('limit', String(Math.min(20, Math.max(1, limit))))
  url.searchParams.set('market', 'ES')

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify search failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    tracks?: {
      items?: Array<{
        id: string
        name: string
        uri: string
        duration_ms: number
        external_urls?: { spotify?: string }
        artists?: Array<{ name: string }>
        album?: {
          name?: string
          images?: Array<{ url: string }>
        }
      }>
    }
  }

  return (data.tracks?.items ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(', '),
    album: t.album?.name ?? '',
    imageUrl: t.album?.images?.[t.album.images.length > 1 ? 1 : 0]?.url ?? t.album?.images?.[0]?.url ?? null,
    uri: t.uri,
    externalUrl: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
    durationMs: t.duration_ms,
  }))
}
