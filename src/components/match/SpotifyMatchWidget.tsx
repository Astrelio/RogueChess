import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Music2, Search, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { api, type SpotifyTrack } from '@/lib/api'
import { easeOut } from '@/lib/motion'

const STORAGE_PREFIX = 'rc-spotify-track:'

function loadSaved(matchId: string): SpotifyTrack | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + matchId)
    if (!raw) return null
    return JSON.parse(raw) as SpotifyTrack
  } catch {
    return null
  }
}

function saveTrack(matchId: string, track: SpotifyTrack | null) {
  try {
    if (!track) sessionStorage.removeItem(STORAGE_PREFIX + matchId)
    else sessionStorage.setItem(STORAGE_PREFIX + matchId, JSON.stringify(track))
  } catch {
    /* ignore quota */
  }
}

/** Extrae id de track desde URL o URI de Spotify. */
function parseSpotifyTrackRef(input: string): string | null {
  const t = input.trim()
  const uri = t.match(/^spotify:track:([a-zA-Z0-9]+)$/)
  if (uri) return uri[1]
  try {
    const url = new URL(t)
    if (!url.hostname.includes('spotify.com')) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const i = parts.indexOf('track')
    if (i >= 0 && parts[i + 1]) return parts[i + 1].split('?')[0]
  } catch {
    /* not a URL */
  }
  return null
}

type Props = {
  matchId: string
  dimension?: string
}

export function SpotifyMatchWidget({ matchId, dimension = 'primo' }: Props) {
  const { getToken } = useAuth()
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SpotifyTrack[]>([])
  const [selected, setSelected] = useState<SpotifyTrack | null>(() => loadSaved(matchId))

  const onDocPointer = useEffectEvent((ev: MouseEvent) => {
    if (!open) return
    const el = rootRef.current
    if (el && !el.contains(ev.target as Node)) setOpen(false)
  })

  useEffect(() => {
    document.addEventListener('mousedown', onDocPointer)
    return () => document.removeEventListener('mousedown', onDocPointer)
  }, [onDocPointer])

  useEffect(() => {
    let cancelled = false
    void api.spotifyStatus().then((s) => {
      if (!cancelled) setConfigured(s.configured)
    }).catch(() => {
      if (!cancelled) setConfigured(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSelected(loadSaved(matchId))
  }, [matchId])

  async function runSearch(raw: string) {
    const q = raw.trim()
    if (!q) return

    const pastedId = parseSpotifyTrackRef(q)
    if (pastedId) {
      const track: SpotifyTrack = {
        id: pastedId,
        name: 'Pista de Spotify',
        artists: 'Enlace pegado',
        album: '',
        imageUrl: null,
        uri: `spotify:track:${pastedId}`,
        externalUrl: `https://open.spotify.com/track/${pastedId}`,
        durationMs: 0,
      }
      setSelected(track)
      saveTrack(matchId, track)
      setResults([])
      setError(null)
      return
    }

    if (configured === false) {
      setError('Pega un enlace open.spotify.com/track/… o configura Spotify en la API')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Inicia sesión para buscar en Spotify')
      const { tracks } = await api.spotifySearch(token, q)
      setResults(tracks)
      if (tracks.length === 0) setError('Sin resultados')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de búsqueda')
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  function pick(track: SpotifyTrack) {
    setSelected(track)
    saveTrack(matchId, track)
    setResults([])
    setQuery('')
  }

  function clear() {
    setSelected(null)
    saveTrack(matchId, null)
  }

  const dimHint =
    dimension && dimension !== 'primo'
      ? ` · ${dimension.replace(/_/g, ' ')}`
      : ''

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="btn-ghost inline-flex items-center gap-1.5 !px-3"
        aria-expanded={open}
        aria-controls={panelId}
        title="Música de partida"
        onClick={() => setOpen((v) => !v)}
      >
        <Music2 className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        Música
        {selected ? (
          <span className="ml-0.5 size-1.5 rounded-sm bg-[var(--color-primary-container)]" aria-hidden />
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Música de la partida"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="panel absolute right-0 top-[calc(100%+10px)] z-40 w-[min(100vw-2rem,22rem)] overflow-hidden border-[var(--color-outline-soft)]/60 bg-[color-mix(in_srgb,#fff_90%,transparent)] shadow-[0_16px_40px_rgba(115,92,0,0.12)] backdrop-blur-md"
          >
            <div
              className="border-b border-[var(--color-outline-soft)]/40 px-3 py-2.5"
              style={{
                background:
                  'linear-gradient(120deg, color-mix(in srgb, var(--color-primary-fixed) 35%, transparent), transparent 70%)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">
                    Ambiente de mesa{dimHint}
                  </p>
                  <p className="font-display text-lg leading-tight text-[var(--color-ink)]">
                    Partitura Spotify
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-ink)]"
                  aria-label="Cerrar"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[var(--color-ink-muted)]">
                Solo tú oyes la pista — elige algo para la partida.
              </p>
            </div>

            <div className="space-y-3 p-3">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void runSearch(query)
                }}
              >
                <label className="sr-only" htmlFor={`${panelId}-q`}>
                  Buscar en Spotify
                </label>
                <input
                  id={`${panelId}-q`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={configured === false ? 'Pega enlace de track…' : 'Buscar tema o pegar enlace…'}
                  className="min-w-0 flex-1 rounded border border-[var(--color-outline-soft)]/70 bg-[var(--color-surface-low)] px-2.5 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-outline)] focus:border-[var(--color-primary)] focus:outline-none"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={busy || query.trim().length < 2}
                  className="btn-primary inline-flex items-center justify-center !px-3 disabled:opacity-50"
                  aria-label="Buscar"
                >
                  <Search className="size-3.5" strokeWidth={2} />
                </button>
              </form>

              {error ? (
                <p className="text-[11px] text-[var(--color-error)]">{error}</p>
              ) : null}

              {configured === false ? (
                <p className="text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
                  API Spotify no configurada. Puedes pegar un enlace de track de Spotify para
                  reproducirlo aquí.
                </p>
              ) : null}

              {results.length > 0 ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                  {results.map((track, i) => (
                    <motion.li
                      key={track.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25, ease: easeOut }}
                    >
                      <button
                        type="button"
                        onClick={() => pick(track)}
                        className="flex w-full items-center gap-2.5 rounded px-1.5 py-1.5 text-left transition hover:bg-[color-mix(in_srgb,var(--color-primary-fixed)_28%,transparent)]"
                      >
                        {track.imageUrl ? (
                          <img
                            src={track.imageUrl}
                            alt=""
                            className="size-9 shrink-0 rounded-sm object-cover shadow-sm"
                          />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-[var(--color-surface-high)] text-[var(--color-primary)]">
                            <Music2 className="size-3.5" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-[var(--color-ink)]">
                            {track.name}
                          </span>
                          <span className="block truncate text-[11px] text-[var(--color-ink-muted)]">
                            {track.artists}
                          </span>
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              ) : null}

              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: easeOut }}
                  className="overflow-hidden rounded border border-[var(--color-outline-soft)]/50 bg-[var(--color-surface-low)]"
                >
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <p className="font-label truncate text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                      En mesa · {selected.name}
                    </p>
                    <button
                      type="button"
                      onClick={clear}
                      className="font-label shrink-0 text-[10px] uppercase tracking-wider text-[var(--color-primary)] hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <iframe
                    title={`Spotify · ${selected.name}`}
                    src={`https://open.spotify.com/embed/track/${selected.id}?utm_source=generator&theme=0`}
                    width="100%"
                    height="80"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="block border-0"
                  />
                </motion.div>
              ) : (
                <p className="text-center text-[11px] text-[var(--color-ink-muted)]">
                  Ninguna pista en la mesa todavía.
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
