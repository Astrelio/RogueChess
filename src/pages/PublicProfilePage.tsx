import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { PageTransition } from '@/components/PageTransition'
import { presenceLabel } from '@/lib/utils'
import { riseItem, stagger } from '@/lib/motion'
import type { Profile } from '@/types'

export function PublicProfilePage() {
  const { username = '' } = useParams()
  const { getToken, user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { profile: p } = await api.getProfile(username)
        if (alive) setProfile(p)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'No encontrado')
      }
    })()
    return () => {
      alive = false
    }
  }, [username])

  async function like() {
    if (!profile) return
    try {
      const token = await getToken()
      if (!token) {
        setMsg('Inicia sesión')
        return
      }
      const res = await api.superLike(token, profile.username)
      setMsg(`Popularidad: ${res.popularity_score}`)
      const { profile: p } = await api.getProfile(username)
      setProfile(p)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error')
    }
  }

  if (error) return <p className="text-sm text-[var(--color-error)]">{error}</p>
  if (!profile) {
    return <p className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">Cargando…</p>
  }

  return (
    <PageTransition>
      <motion.section variants={stagger} initial="initial" animate="animate" className="max-w-lg">
        <motion.div variants={riseItem}>
          <Link
            to="/ranking"
            className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ← Ranking
          </Link>
        </motion.div>
        <motion.h1 variants={riseItem} className="font-display mt-4 text-2xl text-[var(--color-primary)] sm:text-3xl">
          {profile.display_name}
        </motion.h1>
        <motion.p variants={riseItem} className="mt-2 text-sm text-[var(--color-ink-muted)]">
          @{profile.username} · {presenceLabel(profile.presence)} · {profile.rating} ELO
        </motion.p>
        {(profile.mood_emoji || profile.mood_text) && (
          <motion.p variants={riseItem} className="panel mt-4 px-3 py-2 text-sm">
            {profile.mood_emoji} {profile.mood_text}
          </motion.p>
        )}
        {profile.bio ? (
          <motion.p variants={riseItem} className="mt-4 text-sm text-[var(--color-ink-muted)]">
            {profile.bio}
          </motion.p>
        ) : null}
        <motion.p variants={riseItem} className="mt-4 text-sm text-[var(--color-ink-muted)]">
          {profile.wins}W / {profile.losses}L / {profile.draws}D · ♥ {profile.popularity_score}
        </motion.p>
        {user ? (
          <motion.button
            type="button"
            variants={riseItem}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => void like()}
            className="btn-ghost mt-6"
          >
            Super like
          </motion.button>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-[var(--color-online)]">{msg}</p> : null}
      </motion.section>
    </PageTransition>
  )
}
