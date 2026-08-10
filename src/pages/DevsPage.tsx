import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { BackToHome } from '@/components/BackToHome'
import { PageTransition } from '@/components/PageTransition'
import { riseItem, stagger } from '@/lib/motion'
import type { Developer } from '@/types'

const HEART_MSG: Record<string, string> = {
  ok: '¡Gracias!',
  'already hearted': 'Ya le diste me gusta a este desarrollador',
  'sender not found': 'Inicia sesión para dar me gusta',
  'developer not found': 'Desarrollador no encontrado',
}

export function DevsPage() {
  const { getToken, user } = useAuth()
  const [devs, setDevs] = useState<Developer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)

  async function load() {
    const { developers } = await api.developers()
    setDevs(developers)
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }, [])

  async function heart(slug: string) {
    setMsg(null)
    setBusySlug(slug)
    try {
      const token = await getToken()
      if (!token) {
        setMsg('Inicia sesión para dar me gusta')
        return
      }
      const res = await api.heartDeveloper(token, slug)
      setMsg(HEART_MSG[res.message] ?? (res.message === 'ok' ? '¡Gracias!' : res.message))
      await load()
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Error'
      setMsg(HEART_MSG[raw] ?? raw)
      await load().catch(() => {})
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <PageTransition>
      <motion.section variants={stagger} initial="initial" animate="animate">
        <motion.div variants={riseItem} className="mb-4">
          <BackToHome />
        </motion.div>
        <motion.h1 variants={riseItem} className="font-display text-2xl text-[var(--color-primary)] sm:text-3xl">
          Equipo
        </motion.h1>
        <motion.p variants={riseItem} className="mt-2 max-w-xl text-sm text-[var(--color-ink-muted)]">
          Quienes armaron RogueChess. Un me gusta por persona — sin spam, solo gratitud.
        </motion.p>
        {msg ? (
          <motion.p variants={riseItem} className="mt-3 text-sm text-[var(--color-online)]">
            {msg}
          </motion.p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p> : null}

        <motion.ul
          variants={stagger}
          className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5"
        >
          {devs.map((d) => (
            <motion.li
              key={d.id}
              variants={riseItem}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start"
            >
              <div className="mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-full border border-[var(--color-outline-soft)]/60 bg-[var(--color-surface-low)] shadow-[0_8px_24px_rgba(115,92,0,0.12)] sm:mx-0 sm:h-32 sm:w-32">
                {d.avatar_url ? (
                  <img
                    src={d.avatar_url}
                    alt={d.name}
                    width={128}
                    height={128}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="font-display flex h-full w-full items-center justify-center text-2xl text-[var(--color-primary)]">
                    {d.name.trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h2 className="font-display text-lg text-[var(--color-ink)] sm:text-xl">{d.name}</h2>
                <p className="font-label mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-primary)]">
                  {d.role}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{d.bio}</p>
                <div className="mt-4 flex items-center justify-center gap-3 sm:justify-start">
                  <span className="flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)]">
                    <Heart className="h-3.5 w-3.5 fill-[var(--color-primary)] text-[var(--color-primary)]" />
                    {d.heart_count}
                  </span>
                  <motion.button
                    type="button"
                    disabled={!user || busySlug === d.slug}
                    whileHover={{ scale: user ? 1.03 : 1 }}
                    whileTap={{ scale: user ? 0.97 : 1 }}
                    onClick={() => void heart(d.slug)}
                    className="font-label cursor-pointer border border-[var(--color-primary)]/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-primary)] transition hover:bg-[var(--color-primary)]/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busySlug === d.slug ? '…' : 'Me gusta'}
                  </motion.button>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>
    </PageTransition>
  )
}
