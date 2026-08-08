import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { PageTransition } from '@/components/PageTransition'
import { riseItem, stagger } from '@/lib/motion'
import type { Developer } from '@/types'

export function DevsPage() {
  const { getToken, user } = useAuth()
  const [devs, setDevs] = useState<Developer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    const { developers } = await api.developers()
    setDevs(developers)
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }, [])

  async function heart(slug: string) {
    setMsg(null)
    try {
      const token = await getToken()
      if (!token) {
        setMsg('Inicia sesión para enviar un supercorazón')
        return
      }
      const res = await api.heartDeveloper(token, slug)
      setMsg(res.message === 'ok' ? '¡Gracias!' : res.message)
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Ya enviaste uno o error')
    }
  }

  return (
    <PageTransition>
      <motion.section variants={stagger} initial="initial" animate="animate">
        <motion.h1 variants={riseItem} className="font-display text-2xl text-[var(--color-primary)] sm:text-3xl">
          Equipo
        </motion.h1>
        <motion.p variants={riseItem} className="mt-2 max-w-lg text-sm text-[var(--color-ink-muted)]">
          Un supercorazón por desarrollador. Sin spam, solo gratitud.
        </motion.p>
        {msg ? (
          <motion.p variants={riseItem} className="mt-3 text-sm text-[var(--color-online)]">
            {msg}
          </motion.p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[var(--color-error)]">{error}</p> : null}

        <motion.ul variants={stagger} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devs.map((d) => (
            <motion.li
              key={d.id}
              variants={riseItem}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="panel p-4"
            >
              <h2 className="font-display text-lg text-[var(--color-ink)]">{d.name}</h2>
              <p className="font-label mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-primary)]">
                {d.role}
              </p>
              <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{d.bio}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm text-[var(--color-ink-muted)]">
                  <Heart className="h-3.5 w-3.5 text-[var(--color-primary)]" /> {d.heart_count}
                </span>
                <motion.button
                  type="button"
                  disabled={!user}
                  whileHover={{ scale: user ? 1.03 : 1 }}
                  whileTap={{ scale: user ? 0.97 : 1 }}
                  onClick={() => void heart(d.slug)}
                  className="font-label border border-[var(--color-primary)]/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--color-primary)] disabled:opacity-40"
                >
                  Supercorazón
                </motion.button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </motion.section>
    </PageTransition>
  )
}
