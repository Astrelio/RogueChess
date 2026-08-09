import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/auth/AuthContext'
import { PageTransition } from '@/components/PageTransition'
import { firebaseReady, loginWithEmail, loginWithGoogle, registerWithEmail } from '@/lib/firebase'
import { riseItem, stagger } from '@/lib/motion'

export function LoginPage() {
  const { user, ready, firebaseReady: fb } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to="/perfil" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') await loginWithEmail(email, password)
      else await registerWithEmail(email, password, displayName)
      navigate('/perfil')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setBusy(false)
    }
  }

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await loginWithGoogle()
      navigate('/perfil')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error con Google')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageTransition>
      <motion.section variants={stagger} initial="initial" animate="animate" className="mx-auto max-w-md">
        <motion.h1 variants={riseItem} className="font-display text-2xl text-[var(--color-primary)] sm:text-3xl">
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </motion.h1>
        <motion.p variants={riseItem} className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Necesitas cuenta para jugar. Tu perfil se guarda al entrar.
        </motion.p>

        {!fb || !firebaseReady ? (
          <motion.div variants={riseItem} className="panel mt-6 p-4 text-sm text-[var(--color-ink-muted)]">
            Configura <code className="text-[var(--color-primary)]">VITE_FIREBASE_*</code> en{' '}
            <code>.env.local</code>.
          </motion.div>
        ) : (
          <>
            <motion.form variants={riseItem} onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
              {mode === 'register' ? (
                <Field label="Nombre" value={displayName} onChange={setDisplayName} required />
              ) : null}
              <Field label="Email" type="email" value={email} onChange={setEmail} required />
              <Field label="Contraseña" type="password" value={password} onChange={setPassword} required minLength={6} />
              {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
              <motion.button
                type="submit"
                disabled={busy}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary mt-2 disabled:opacity-50"
              >
                {busy ? '…' : mode === 'login' ? 'Entrar' : 'Registrarme'}
              </motion.button>
            </motion.form>

            <motion.button
              type="button"
              variants={riseItem}
              disabled={busy}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void onGoogle()}
              className="btn-ghost mt-3 w-full disabled:opacity-50"
            >
              Continuar con Google
            </motion.button>

            <motion.button
              type="button"
              variants={riseItem}
              className="font-label mt-6 text-xs uppercase tracking-wider text-[var(--color-ink-muted)] underline-offset-4 hover:text-[var(--color-primary)] hover:underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </motion.button>
          </>
        )}

        <motion.div variants={riseItem}>
          <Link
            to="/"
            className="font-label mt-10 inline-block text-xs uppercase tracking-wider text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            ← Volver
          </Link>
        </motion.div>
      </motion.section>
    </PageTransition>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  minLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  minLength?: number
}) {
  return (
    <label className="font-label flex flex-col gap-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="border-0 border-b border-[var(--color-outline-soft)] bg-transparent px-0 py-2 font-body text-sm normal-case tracking-normal text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)]"
      />
    </label>
  )
}
