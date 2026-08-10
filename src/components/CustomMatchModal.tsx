import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useCustomMatch } from '@/hooks/useCustomMatch'
import { easeOut } from '@/lib/motion'

const TIME_PRESETS = [
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
  { label: '10 min', value: 600 },
] as const

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Modal de sala personalizada: crear con tiempo/espectadores (+ invite opcional)
 * o unirse por código.
 */
export function CustomMatchModal({ open, onClose }: Props) {
  const custom = useCustomMatch()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [username, setUsername] = useState('')
  const [timeControlS, setTimeControlS] = useState(300)
  const [allowSpectators, setAllowSpectators] = useState(true)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      custom.clearError()
      setUsername('')
      setCode('')
      setTab('create')
      setTimeControlS(300)
      setAllowSpectators(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    await custom.createRoom({
      timeControlS,
      allowSpectators,
      inviteUsername: username.trim() || undefined,
    })
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    await custom.joinByCode(code)
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[140] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_45%,transparent)] backdrop-blur-[12px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-match-title"
            className="panel relative z-10 max-h-[min(92dvh,720px)] w-full max-w-md overflow-y-auto border-[var(--color-outline-soft)]/55 bg-[color-mix(in_srgb,#fff_90%,transparent)] p-5 pb-[max(1.25rem,var(--rc-safe-bottom))] shadow-[0_24px_60px_rgba(115,92,0,0.14)] sm:rounded-sm sm:p-7 sm:pb-7"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <p className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
              Sala
            </p>
            <h2
              id="custom-match-title"
              className="font-display mt-1 text-2xl text-[var(--color-primary)]"
            >
              Partida personalizada
            </h2>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={`font-label flex-1 border px-2 py-1.5 text-[10px] uppercase tracking-wider transition ${
                  tab === 'create'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-outline-soft)] text-[var(--color-ink-muted)]'
                }`}
                onClick={() => {
                  setTab('create')
                  custom.clearError()
                }}
              >
                Crear sala
              </button>
              <button
                type="button"
                className={`font-label flex-1 border px-2 py-1.5 text-[10px] uppercase tracking-wider transition ${
                  tab === 'join'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-outline-soft)] text-[var(--color-ink-muted)]'
                }`}
                onClick={() => {
                  setTab('join')
                  custom.clearError()
                }}
              >
                Unirse con código
              </button>
            </div>

            {tab === 'create' ? (
              <form className="mt-5 space-y-4" onSubmit={(e) => void onCreate(e)}>
                <label className="block">
                  <span className="font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Invitar (opcional)
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@usuario"
                    className="panel mt-1 w-full px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    autoComplete="off"
                  />
                  <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-ink-muted)]">
                    Si está conectado, le llega un aviso en la{' '}
                    <strong className="font-medium text-[var(--color-ink)]">campana</strong> del
                    header (Aceptar / Rechazar). Si no, comparte el código de la sala.
                  </p>
                </label>

                <div>
                  <span className="font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Tiempo
                  </span>
                  <div className="mt-1.5 flex gap-2">
                    {TIME_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setTimeControlS(p.value)}
                        className={`font-label flex-1 border px-2 py-1.5 text-[10px] uppercase tracking-wider transition ${
                          timeControlS === p.value
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-[var(--color-outline-soft)] text-[var(--color-ink-muted)]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input
                    type="checkbox"
                    checked={allowSpectators}
                    onChange={(e) => setAllowSpectators(e.target.checked)}
                    className="accent-[var(--color-primary)]"
                  />
                  Permitir espectadores
                </label>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="submit" className="btn-primary disabled:opacity-50" disabled={custom.busy}>
                    {custom.busy ? 'Creando…' : 'Crear sala'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={(e) => void onJoin(e)}>
                <label className="block">
                  <span className="font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Código de sala
                  </span>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCD12"
                    className="panel mt-1 w-full px-3 py-2 font-mono text-lg tracking-[0.2em] outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    autoComplete="off"
                    maxLength={16}
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    className="btn-primary disabled:opacity-50"
                    disabled={custom.busy || !code.trim()}
                  >
                    {custom.busy ? 'Entrando…' : 'Unirse'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {custom.error ? (
              <p className="mt-4 text-sm text-[var(--color-error)]">{custom.error}</p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
