import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Music2, Search, X } from 'lucide-react'
import { api, type SoundCloudTrack } from '@/lib/api'
import { easeOut } from '@/lib/motion'

const STORAGE_PREFIX = 'rc-soundcloud-track:'

function loadSaved(matchId: string): SoundCloudTrack | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + matchId)
    if (!raw) return null
    return JSON.parse(raw) as SoundCloudTrack
  } catch {
    return null
  }
}

function saveTrack(matchId: string, track: SoundCloudTrack | null) {
  try {
    if (!track) sessionStorage.removeItem(STORAGE_PREFIX + matchId)
    else sessionStorage.setItem(STORAGE_PREFIX + matchId, JSON.stringify(track))
  } catch {
    /* ignore quota */
  }
}

/** URL de SoundCloud (pista, set o enlace corto) → normalizada, o null. */
function parseSoundCloudUrl(input: string): string | null {
  const t = input.trim()
  try {
    const url = new URL(t)
    const host = url.hostname
    if (
      host === 'soundcloud.com' ||
      host === 'www.soundcloud.com' ||
      host === 'm.soundcloud.com' ||
      host === 'on.soundcloud.com'
    ) {
      return url.toString()
    }
  } catch {
    /* not a URL */
  }
  return null
}

function embedSrc(trackUrl: string): string {
  const u = new URL('https://w.soundcloud.com/player/')
  u.searchParams.set('url', trackUrl)
  u.searchParams.set('color', '#d4af37')
  u.searchParams.set('auto_play', 'false')
  u.searchParams.set('hide_related', 'true')
  u.searchParams.set('show_comments', 'false')
  u.searchParams.set('show_teaser', 'false')
  u.searchParams.set('visual', 'false')
  return u.toString()
}

type Props = {
  matchId: string
  dimension?: string
}

export function SoundCloudMatchWidget({ matchId, dimension = 'primo' }: Props) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [selected, setSelected] = useState<SoundCloudTrack | null>(() => loadSaved(matchId))

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
    setSelected(loadSaved(matchId))
  }, [matchId])

  async function onSubmit(raw: string) {
    const q = raw.trim()
    if (!q) return
    setHint(null)

    const scUrl = parseSoundCloudUrl(q)
    if (!scUrl) {
      // No es un enlace: abrir el buscador de SoundCloud en otra pestaña
      window.open(`https://soundcloud.com/search?q=${encodeURIComponent(q)}`, '_blank', 'noopener')
      setHint('Se abrió el buscador de SoundCloud — copia el enlace de la canción y pégalo aquí.')
      return
    }

    setBusy(true)
    try {
      const track = await api.soundcloudResolve(scUrl)
      setSelected(track)
      saveTrack(matchId, track)
      setQuery('')
    } catch {
      // oEmbed falló: embebemos igual, solo sin metadatos bonitos
      const fallback: SoundCloudTrack = {
        url: scUrl,
        title: 'Pista de SoundCloud',
        author: '',
        thumbnail: null,
      }
      setSelected(fallback)
      saveTrack(matchId, fallback)
      setQuery('')
    } finally {
      setBusy(false)
    }
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
        className="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1 text-xs"
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
                    Sesión SoundCloud
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
                Canciones completas y gratis — solo tú oyes la pista.
              </p>
            </div>

            <div className="space-y-3 p-3">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void onSubmit(query)
                }}
              >
                <label className="sr-only" htmlFor={`${panelId}-q`}>
                  Pegar enlace o buscar en SoundCloud
                </label>
                <input
                  id={`${panelId}-q`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pega enlace de SoundCloud o busca…"
                  className="min-w-0 flex-1 rounded border border-[var(--color-outline-soft)]/70 bg-[var(--color-surface-low)] px-2.5 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-outline)] focus:border-[var(--color-primary)] focus:outline-none"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={busy || query.trim().length < 2}
                  className="btn-primary inline-flex items-center justify-center !px-3 disabled:opacity-50"
                  aria-label="Buscar o añadir"
                >
                  <Search className="size-3.5" strokeWidth={2} />
                </button>
              </form>

              {hint ? (
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-ink-muted)]">
                  <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />
                  {hint}
                </p>
              ) : null}

              {selected ? (
                <motion.div
                  key={selected.url}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: easeOut }}
                  className="overflow-hidden rounded border border-[var(--color-outline-soft)]/50 bg-[var(--color-surface-low)]"
                >
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <p className="font-label truncate text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                      En mesa · {selected.title}
                      {selected.author ? ` — ${selected.author}` : ''}
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
                    title={`SoundCloud · ${selected.title}`}
                    src={embedSrc(selected.url)}
                    width="100%"
                    height="120"
                    allow="autoplay; encrypted-media"
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
