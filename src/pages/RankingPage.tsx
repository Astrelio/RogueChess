import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { PageTransition } from '@/components/PageTransition'
import { DuelBadge, SearchingBadge } from '@/components/DuelBadge'
import { useChallengePlayer } from '@/hooks/useChallengePlayer'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import { cn, medalColor, presenceLabel } from '@/lib/utils'
import { riseItem, stagger } from '@/lib/motion'
import type { LeaderboardEntry } from '@/types'

const LIKE_MSG: Record<string, string> = {
  ok: 'Me gusta enviado',
  'already liked today': 'Ya le diste me gusta hoy',
  'cannot like yourself': 'No puedes darte me gusta a ti mismo',
  'target not found': 'Jugador no encontrado',
  'sender not found': 'Inicia sesión para dar me gusta',
}

export function RankingPage() {
  const { getToken, user } = useAuth()
  const challenge = useChallengePlayer()
  const lobby = useLobbyPresence()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { entries: rows } = await api.leaderboard(50)
      setEntries(rows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando ranking')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Portal: pulsos de cola / partida → refrescar badges sin F5
  const { onRankingPulse, onMatchReady, onLooking } = lobby
  useEffect(() => {
    const unsubPulse = onRankingPulse(() => {
      void refresh()
    })
    const unsubReady = onMatchReady(() => {
      void refresh()
    })
    const unsubLooking = onLooking(() => {
      void refresh()
    })
    return () => {
      unsubPulse()
      unsubReady()
      unsubLooking()
    }
  }, [onRankingPulse, onMatchReady, onLooking, refresh])

  // Respaldo suave por si se pierde un ephemeral
  useEffect(() => {
    const t = window.setInterval(() => void refresh(), 12000)
    return () => window.clearInterval(t)
  }, [refresh])

  /** Overlay en vivo desde metadata del lobby (más fresco que el REST). */
  const liveByUsername = useMemo(() => {
    const map = new Map<string, { playing: boolean; searching: boolean }>()
    for (const p of lobby.participants) {
      const username = typeof p.meta?.username === 'string' ? p.meta.username : null
      if (!username) continue
      map.set(username.toLowerCase(), {
        playing: p.meta?.playing === true,
        searching: p.meta?.searching === true,
      })
    }
    return map
  }, [lobby.participants])

  function rowStatus(e: LeaderboardEntry): 'playing' | 'searching' | null {
    const live = liveByUsername.get(e.username.toLowerCase())
    if (live?.playing || e.is_in_match === true) return 'playing'
    if (live?.searching || e.is_searching === true) return 'searching'
    return null
  }

  async function like(username: string) {
    setMsg(null)
    try {
      const token = await getToken()
      if (!token) {
        setMsg('Inicia sesión para dar me gusta')
        return
      }
      const res = await api.superLike(token, username)
      const base = LIKE_MSG[res.message] ?? res.message
      setMsg(
        res.popularity_score != null
          ? `${base}. Popularidad: ${res.popularity_score}`
          : base,
      )
      await refresh()
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'No se pudo dar like'
      setMsg(LIKE_MSG[raw] ?? raw)
    }
  }

  return (
    <PageTransition>
      <motion.section variants={stagger} initial="initial" animate="animate">
        <motion.h1 variants={riseItem} className="font-display text-2xl text-[var(--color-primary)] sm:text-3xl">
          Tabla de clasificación
        </motion.h1>
        <motion.p variants={riseItem} className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">
          Top por rating. Medallas: 1 oro · 2 plata · 3 bronce. Un «me gusta» al día por jugador.
        </motion.p>
        {msg ? (
          <motion.p variants={riseItem} className="mt-3 text-sm text-[var(--color-online)]">
            {msg}
          </motion.p>
        ) : null}
        {challenge.error ? (
          <motion.p variants={riseItem} className="mt-3 text-sm text-[var(--color-error)]">
            {challenge.error}
          </motion.p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p> : null}
        {loading ? (
          <p className="font-label mt-6 text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Cargando…</p>
        ) : null}

        <motion.ul variants={stagger} className="mt-8 divide-y divide-[var(--color-outline-soft)]/40 border-y border-[var(--color-outline-soft)]/40">
          {entries.map((e) => {
            const status = rowStatus(e)
            return (
              <motion.li
                key={e.id}
                variants={riseItem}
                whileHover={{ backgroundColor: 'rgba(245,244,239,0.8)' }}
                className="flex flex-wrap items-center gap-3 px-1 py-3.5 sm:flex-nowrap"
              >
                <span className={cn('font-display w-10 text-sm', medalColor(e.medal))}>#{e.rank_pos}</span>
                <span className="w-9 shrink-0">
                  {status === 'playing' ? (
                    <DuelBadge />
                  ) : status === 'searching' ? (
                    <SearchingBadge />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/u/${e.username}`}
                    className="text-sm text-[var(--color-ink)] transition hover:text-[var(--color-primary)]"
                  >
                    {e.display_name}{' '}
                    <span className="text-[var(--color-ink-muted)]">@{e.username}</span>
                  </Link>
                  <div className="font-label mt-0.5 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <span>
                      {status === 'playing'
                        ? 'En duelo'
                        : status === 'searching'
                          ? 'Buscando partida'
                          : presenceLabel(e.presence)}
                    </span>
                    {(e.mood_emoji || e.mood_text) && (
                      <span className="normal-case tracking-normal">
                        {e.mood_emoji} {e.mood_text}
                      </span>
                    )}
                    <span>♥ {e.popularity_score}</span>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className={cn('font-medium', medalColor(e.medal))}>{e.rating}</div>
                  <div className="font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                    {e.wins}V / {e.losses}D / {e.draws}E
                  </div>
                </div>
                {user ? (
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={challenge.busy}
                      onClick={() => void challenge.challengeUsername(e.username)}
                      className="font-label border border-[var(--color-primary)]/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-primary)] transition hover:bg-[var(--color-primary)]/10 disabled:opacity-50"
                    >
                      Retar
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void like(e.username)}
                      className="font-label border border-[var(--color-outline-soft)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    >
                      Me gusta
                    </motion.button>
                  </div>
                ) : null}
              </motion.li>
            )
          })}
          {!loading && entries.length === 0 ? (
            <li className="py-8 text-sm text-[var(--color-ink-muted)]">Aún no hay jugadores. Sé el primero en registrarte.</li>
          ) : null}
        </motion.ul>
      </motion.section>
    </PageTransition>
  )
}
