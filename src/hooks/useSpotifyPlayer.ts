import { useCallback, useEffect, useRef, useState } from 'react'
import { disconnectSpotify, getSpotifyAccessToken } from '@/lib/spotifyAuth'

/** Tipos mínimos del Web Playback SDK (no hay @types oficiales). */
type SdkPlayerState = {
  paused: boolean
  position: number
  duration: number
  track_window?: {
    current_track?: {
      uri: string
      name: string
      artists?: Array<{ name: string }>
      album?: { images?: Array<{ url: string }> }
    }
  }
}

type SdkPlayer = {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: string, cb: (payload: never) => void): void
  togglePlay(): Promise<void>
  setVolume(volume: number): Promise<void>
  seek(positionMs: number): Promise<void>
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SdkPlayer
    }
  }
}

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js'

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = SDK_SRC
    script.async = true
    script.onerror = () => {
      sdkPromise = null
      reject(new Error('No se pudo cargar el SDK de Spotify'))
    }
    document.body.appendChild(script)
  })
  return sdkPromise
}

export type SpotifyPlayerStatus = 'off' | 'loading' | 'ready' | 'error' | 'premium_required'

export type SpotifyNowPlaying = {
  uri: string
  name: string
  artists: string
  imageUrl: string | null
  paused: boolean
  positionMs: number
  durationMs: number
}

/**
 * Reproductor in-app con la cuenta Premium conectada.
 * `enabled` debe ser true solo cuando hay tokens guardados.
 */
export function useSpotifyPlayer(enabled: boolean) {
  const [status, setStatus] = useState<SpotifyPlayerStatus>('off')
  const [error, setError] = useState<string | null>(null)
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlaying | null>(null)
  const playerRef = useRef<SdkPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setStatus('off')
      return
    }
    let cancelled = false
    setStatus('loading')
    setError(null)

    void loadSdk()
      .then(() => {
        if (cancelled || !window.Spotify) return
        const player = new window.Spotify.Player({
          name: 'RogueChess — mesa de partida',
          volume: 0.55,
          getOAuthToken: (cb) => {
            void getSpotifyAccessToken().then((token) => {
              if (token) cb(token)
            })
          },
        })
        playerRef.current = player

        player.addListener('ready', (payload: never) => {
          const { device_id } = payload as { device_id: string }
          deviceIdRef.current = device_id
          if (!cancelled) setStatus('ready')
        })
        player.addListener('not_ready', () => {
          deviceIdRef.current = null
        })
        player.addListener('player_state_changed', (payload: never) => {
          const state = payload as SdkPlayerState | null
          if (cancelled) return
          if (!state?.track_window?.current_track) {
            setNowPlaying(null)
            return
          }
          const t = state.track_window.current_track
          setNowPlaying({
            uri: t.uri,
            name: t.name,
            artists: (t.artists ?? []).map((a) => a.name).join(', '),
            imageUrl: t.album?.images?.[0]?.url ?? null,
            paused: state.paused,
            positionMs: state.position,
            durationMs: state.duration,
          })
        })
        player.addListener('initialization_error', (payload: never) => {
          const { message } = payload as { message: string }
          if (!cancelled) {
            setError(message)
            setStatus('error')
          }
        })
        player.addListener('authentication_error', () => {
          disconnectSpotify()
          if (!cancelled) {
            setError('La sesión de Spotify caducó — vuelve a conectar tu cuenta')
            setStatus('error')
          }
        })
        player.addListener('account_error', () => {
          if (!cancelled) setStatus('premium_required')
        })

        void player.connect()
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error cargando Spotify')
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
      playerRef.current = null
      deviceIdRef.current = null
      setNowPlaying(null)
    }
  }, [enabled])

  const play = useCallback(async (uri: string) => {
    const deviceId = deviceIdRef.current
    const token = await getSpotifyAccessToken()
    if (!deviceId || !token) throw new Error('Reproductor no listo todavía')
    const res = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [uri] }),
      },
    )
    if (res.status === 403) throw new Error('Spotify Premium es necesario para reproducir aquí')
    if (!res.ok && res.status !== 202) {
      throw new Error(`Spotify no pudo reproducir (${res.status})`)
    }
  }, [])

  const togglePlay = useCallback(async () => {
    await playerRef.current?.togglePlay()
  }, [])

  const setVolume = useCallback(async (volume: number) => {
    await playerRef.current?.setVolume(Math.min(1, Math.max(0, volume)))
  }, [])

  return { status, error, nowPlaying, play, togglePlay, setVolume }
}
