import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { BackToHome } from '@/components/BackToHome'
import { PageTransition } from '@/components/PageTransition'
import { presenceLabel } from '@/lib/utils'
import { riseItem, stagger } from '@/lib/motion'

const EMOJIS = ['⚔️', '♟️', '🔥', '🌙', '🧿', '⏳', '💀', '✨']

export function ProfilePage() {
  const { ready, user, profile, refreshProfile, getToken } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [moodText, setMoodText] = useState('')
  const [moodEmoji, setMoodEmoji] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && !user) return <Navigate to="/login" replace />
  if (!profile) {
    return (
      <p className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
        {ready ? 'Sincronizando perfil…' : 'Cargando…'}
      </p>
    )
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sin sesión')
      await api.updateMe(token, {
        displayName: displayName || profile!.display_name,
        username: username || profile!.username,
        bio: bio || null,
      })
      await refreshProfile()
      setMsg('Perfil actualizado')
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function saveMood(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sin sesión')
      await api.setMood(token, { moodText: moodText || null, moodEmoji: moodEmoji || null })
      await refreshProfile()
      setMsg('Estado de ánimo guardado')
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageTransition>
      <motion.section
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid gap-10 lg:grid-cols-2"
      >
        <motion.div variants={riseItem} className="lg:col-span-2">
          <BackToHome />
        </motion.div>
        <motion.div variants={riseItem}>
          <h1 className="font-display text-2xl text-[var(--color-primary)] sm:text-3xl">Tu perfil</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            @{profile.username} · {presenceLabel(profile.presence)} · rating {profile.rating}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            <Stat label="Victorias" value={profile.wins} />
            <Stat label="Derrotas" value={profile.losses} />
            <Stat label="Tablas" value={profile.draws} />
            <Stat label="Popularidad" value={profile.popularity_score} />
          </dl>
          {(profile.mood_emoji || profile.mood_text) && (
            <p className="panel mt-4 px-3 py-2 text-sm">
              {profile.mood_emoji} {profile.mood_text}
            </p>
          )}
          {msg ? <p className="mt-3 text-sm text-[var(--color-online)]">{msg}</p> : null}
          {err ? <p className="mt-3 text-sm text-[var(--color-error)]">{err}</p> : null}
        </motion.div>

        <motion.div variants={riseItem} className="flex flex-col gap-8">
          <form onSubmit={saveProfile} className="flex flex-col gap-3">
            <h2 className="font-label text-xs uppercase tracking-[0.14em] text-[var(--color-ink)]">Editar</h2>
            <Input label="Nombre" placeholder={profile.display_name} value={displayName} onChange={setDisplayName} />
            <Input label="Usuario" placeholder={profile.username} value={username} onChange={setUsername} />
            <Input label="Bio" placeholder={profile.bio ?? ''} value={bio} onChange={setBio} />
            <motion.button
              type="submit"
              disabled={busy}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary disabled:opacity-50"
            >
              Guardar perfil
            </motion.button>
          </form>

          <form onSubmit={saveMood} className="flex flex-col gap-3">
            <h2 className="font-label text-xs uppercase tracking-[0.14em] text-[var(--color-ink)]">
              Estado de ánimo
            </h2>
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((em) => (
                <motion.button
                  key={em}
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMoodEmoji(em)}
                  className={`border px-2 py-1 text-lg transition ${
                    moodEmoji === em
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-fixed)]/30'
                      : 'border-[var(--color-outline-soft)]'
                  }`}
                >
                  {em}
                </motion.button>
              ))}
            </div>
            <Input
              label="Frase (máx 80)"
              placeholder={profile.mood_text ?? 'En mode grieta…'}
              value={moodText}
              onChange={setMoodText}
              maxLength={80}
            />
            <motion.button
              type="submit"
              disabled={busy}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="btn-ghost disabled:opacity-50"
            >
              Guardar estado
            </motion.button>
          </form>
        </motion.div>
      </motion.section>
    </PageTransition>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="panel px-3 py-2">
      <dt className="font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="font-display mt-1 text-xl text-[var(--color-ink)]">{value}</dd>
    </motion.div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <label className="font-label flex flex-col gap-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="border-0 border-b border-[var(--color-outline-soft)] bg-transparent px-0 py-2 font-body text-sm normal-case tracking-normal text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)]"
      />
    </label>
  )
}
