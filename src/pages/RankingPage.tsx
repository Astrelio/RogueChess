import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { PageTransition } from '@/components/PageTransition'
import { cn, medalColor, presenceLabel } from '@/lib/utils'
import { riseItem, stagger } from '@/lib/motion'
import type { LeaderboardEntry } from '@/types'

export function RankingPage() {
  const { getToken, user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { entries: rows } = await api.leaderboard(50)
        if (alive) setEntries(rows)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Error cargando ranking')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function like(username: string) {
    setMsg(null)
    try {
      const token = await getToken()
      if (!token) {
        setMsg('Inicia sesión para dar super like')
        return
      }
      const res = await api.superLike(token, username)
      setMsg(`Super like a @${username}. Popularidad: ${res.popularity_score}`)
      const { entries: rows } = await api.leaderboard(50)
      setEntries(rows)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo dar like')
    }
  }

  return (
    <PageTransition>
      <motion.section variants={stagger} initial="initial" animate="animate">
        <motion.h1 variants={riseItem} className="font-display text-2xl text-[var(--color-primary)] sm:text-3xl">
          Tabla de clasificación
        </motion.h1>
        <motion.p variants={riseItem} className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">
          Top por rating. Medallas: 1 oro · 2 plata · 3 bronce. Un super like por día a cada jugador.
        </motion.p>
        {msg ? (
          <motion.p variants={riseItem} className="mt-3 text-sm text-[var(--color-online)]">
            {msg}
          </motion.p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p> : null}
        {loading ? (
          <p className="font-label mt-6 text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Cargando…</p>
        ) : null}

        <motion.ul variants={stagger} className="mt-8 divide-y divide-[var(--color-outline-soft)]/40 border-y border-[var(--color-outline-soft)]/40">
          {entries.map((e) => (
            <motion.li
              key={e.id}
              variants={riseItem}
              whileHover={{ backgroundColor: 'rgba(245,244,239,0.8)' }}
              className="flex flex-wrap items-center gap-3 px-1 py-3.5 sm:flex-nowrap"
            >
              <span className={cn('font-display w-10 text-sm', medalColor(e.medal))}>#{e.rank_pos}</span>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/u/${e.username}`}
                  className="text-sm text-[var(--color-ink)] transition hover:text-[var(--color-primary)]"
                >
                  {e.display_name}{' '}
                  <span className="text-[var(--color-ink-muted)]">@{e.username}</span>
                </Link>
                <div className="font-label mt-0.5 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <span>{presenceLabel(e.presence)}</span>
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
                  {e.wins}W / {e.losses}L / {e.draws}D
                </div>
              </div>
              {user ? (
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => void like(e.username)}
                  className="font-label border border-[var(--color-outline-soft)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  Super like
                </motion.button>
              ) : null}
            </motion.li>
          ))}
          {!loading && entries.length === 0 ? (
            <li className="py-8 text-sm text-[var(--color-ink-muted)]">Aún no hay jugadores. Sé el primero en registrarte.</li>
          ) : null}
        </motion.ul>
      </motion.section>
    </PageTransition>
  )
}
