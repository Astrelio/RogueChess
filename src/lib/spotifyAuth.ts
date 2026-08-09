/**
 * OAuth de Spotify (Authorization Code + PKCE) para el Web Playback SDK.
 * Sin client secret: todo ocurre en el navegador con la cuenta del jugador.
 */

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
const STORAGE_KEY = 'rc-spotify-auth'
const VERIFIER_KEY = 'rc-spotify-pkce'
const RETURN_KEY = 'rc-spotify-return'

export const SPOTIFY_SCOPES =
  'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state'

type StoredAuth = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export function spotifyAuthConfigured(): boolean {
  return Boolean(CLIENT_ID)
}

export function spotifyConnected(): boolean {
  return loadAuth() !== null
}

function redirectUri(): string {
  return `${window.location.origin}/spotify-callback`
}

function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    if (!parsed.accessToken || !parsed.refreshToken) return null
    return parsed
  } catch {
    return null
  }
}

function saveAuth(auth: StoredAuth | null) {
  try {
    if (!auth) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  } catch {
    /* quota */
  }
}

export function disconnectSpotify() {
  saveAuth(null)
}

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/**
 * Inicia el login. Spotify no acepta redirect URIs con `localhost`, así que si
 * estamos en localhost saltamos primero al mismo sitio vía 127.0.0.1 con un
 * flag para retomar la conexión automáticamente.
 */
export async function beginSpotifyLogin(returnTo: string): Promise<void> {
  if (!CLIENT_ID) throw new Error('Falta VITE_SPOTIFY_CLIENT_ID en .env.local')

  if (window.location.hostname === 'localhost') {
    const u = new URL(window.location.href)
    u.hostname = '127.0.0.1'
    u.searchParams.set('spotify_connect', '1')
    window.location.href = u.toString()
    return
  }

  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge = await pkceChallenge(verifier)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(RETURN_KEY, returnTo)

  const url = new URL('https://accounts.spotify.com/authorize')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('scope', SPOTIFY_SCOPES)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', challenge)
  window.location.href = url.toString()
}

/** Intercambia el code del callback por tokens. Devuelve la ruta de retorno. */
export async function completeSpotifyLogin(code: string): Promise<string> {
  if (!CLIENT_ID) throw new Error('Falta VITE_SPOTIFY_CLIENT_ID en .env.local')
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('Sesión de conexión caducada — vuelve a intentarlo')

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Spotify rechazó la conexión (${res.status}): ${text.slice(0, 160)}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  saveAuth({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  })
  sessionStorage.removeItem(VERIFIER_KEY)
  const returnTo = sessionStorage.getItem(RETURN_KEY) ?? '/'
  sessionStorage.removeItem(RETURN_KEY)
  return returnTo
}

/** Token vigente de la cuenta conectada; refresca si caducó. Null si no hay conexión. */
export async function getSpotifyAccessToken(): Promise<string | null> {
  const auth = loadAuth()
  if (!auth || !CLIENT_ID) return null
  if (auth.expiresAt > Date.now() + 60_000) return auth.accessToken

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: auth.refreshToken,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    saveAuth(null)
    return null
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }
  const next: StoredAuth = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? auth.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  saveAuth(next)
  return next.accessToken
}
