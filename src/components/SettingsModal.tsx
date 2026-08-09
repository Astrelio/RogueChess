import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/motion'
import { requestLobbyTour } from '@/lib/onboarding'
import {
  getMusicVolume,
  getSfxVolume,
  isMusicMuted,
  isSfxMuted,
  playClickSound,
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
  unlockAudio,
} from '@/lib/sounds'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Modal de Ajustes: audio (efectos + música) y reinicio del tour de interfaz.
 */
export function SettingsModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sfxOn, setSfxOn] = useState(() => !isSfxMuted())
  const [sfxVol, setSfxVol] = useState(() => getSfxVolume())
  const [musicOn, setMusicOn] = useState(() => !isMusicMuted())
  const [musicVol, setMusicVol] = useState(() => getMusicVolume())
  const [thanksOpen, setThanksOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setSfxOn(!isSfxMuted())
    setSfxVol(getSfxVolume())
    setMusicOn(!isMusicMuted())
    setMusicVol(getMusicVolume())
    setThanksOpen(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function toggleSfx(next: boolean) {
    unlockAudio()
    setSfxOn(next)
    setSfxMuted(!next)
    if (next) playClickSound()
  }

  function changeSfxVol(v: number) {
    unlockAudio()
    setSfxVol(v)
    setSfxVolume(v)
    if (v > 0 && !isSfxMuted()) playClickSound()
  }

  function toggleMusic(next: boolean) {
    setMusicOn(next)
    setMusicMuted(!next)
  }

  function changeMusicVol(v: number) {
    setMusicVol(v)
    setMusicVolume(v)
  }

  function startUiTour() {
    onClose()
    const go = () => requestLobbyTour()
    if (location.pathname !== '/') {
      navigate('/')
      window.setTimeout(go, 120)
    } else {
      go()
    }
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          data-sfx-ignore
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
            aria-labelledby="settings-title"
            className="panel relative z-10 w-full max-w-md overflow-hidden border-[var(--color-outline-soft)]/55 bg-[color-mix(in_srgb,#fff_90%,transparent)] p-7 shadow-[0_24px_60px_rgba(115,92,0,0.14)]"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <p className="font-label text-[10px] uppercase tracking-[0.22em] text-[var(--color-primary)]">
              Preferencias
            </p>
            <h2
              id="settings-title"
              className="font-display mt-1 text-2xl text-[var(--color-primary)]"
            >
              Ajustes
            </h2>

            <div className="mt-6 space-y-5">
              <AudioRow
                title="Efectos de sonido"
                hint="Piezas, botones y eventos de partida"
                enabled={sfxOn}
                volume={sfxVol}
                onToggle={toggleSfx}
                onVolume={changeSfxVol}
              />
              <AudioRow
                title="Música"
                hint="Pistas y ambiente"
                enabled={musicOn}
                volume={musicVol}
                onToggle={toggleMusic}
                onVolume={changeMusicVol}
              />
            </div>

            <div className="mt-7 border-t hairline pt-5">
              <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                Ayuda
              </p>
              <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">
                Vuelve a ver la guía del lobby: ranking, comodines, jugar y perfil.
              </p>
              <button type="button" className="btn-ghost mt-3 !px-3 !py-2 text-[11px]" onClick={startUiTour}>
                Tutorial de interfaz
              </button>
            </div>

            <div className="mt-7 border-t hairline pt-5">
              <button
                type="button"
                aria-expanded={thanksOpen}
                onClick={() => setThanksOpen((v) => !v)}
                className="font-label group flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm text-left text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)] transition hover:bg-[var(--color-primary)]/10 hover:pl-1.5 hover:underline hover:decoration-[var(--color-primary)]/35 hover:underline-offset-4"
              >
                De Astrelio
                <span
                  aria-hidden
                  className={`text-[11px] opacity-70 transition group-hover:opacity-100 ${thanksOpen ? 'rotate-180' : ''}`}
                >
                  ▾
                </span>
              </button>
              <AnimatePresence initial={false}>
                {thanksOpen ? (
                  <motion.div
                    key="thanks"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                      Si estás aquí, probablemente te gustó el juego, o tal vez no; el caso es que aún
                      necesito aprender más cosas, pero por el momento este es mi regalo para ti.
                      Gracias por jugar.
                    </p>
                    <p className="font-display mt-2 text-sm text-[var(--color-primary)]">@astrelio</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 pb-0.5">
                      <a
                        href="https://soundcloud.com/player-one-949722221/tqmm?in=player-one-949722221/sets/nebulum-mirage-1&si=79fef695a0b24e1b9a290123109d2610&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-label text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink)] underline decoration-[var(--color-primary)]/40 underline-offset-4 transition hover:text-[var(--color-primary)]"
                      >
                        SoundCloud · música
                      </a>
                      <a
                        href="https://instagram.com/_astrelio"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-label text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink)] underline decoration-[var(--color-primary)]/40 underline-offset-4 transition hover:text-[var(--color-primary)]"
                      >
                        Instagram · @_astrelio
                      </a>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-primary !px-4 !py-2 text-[11px]" onClick={onClose}>
                Listo
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

function AudioRow({
  title,
  hint,
  enabled,
  volume,
  onToggle,
  onVolume,
}: {
  title: string
  hint: string
  enabled: boolean
  volume: number
  onToggle: (next: boolean) => void
  onVolume: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink)]">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">{hint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? `Apagar ${title}` : `Encender ${title}`}
          onClick={() => onToggle(!enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
            enabled
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/20'
              : 'border-[var(--color-outline-soft)] bg-[var(--color-surface)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--color-primary)] transition ${
              enabled ? 'left-[1.35rem]' : 'left-0.5 opacity-50'
            }`}
          />
        </button>
      </div>
      <label className="mt-3 flex items-center gap-3">
        <span className="font-label w-14 shrink-0 text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
          Volumen
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          disabled={!enabled}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          className="h-1.5 w-full cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className="font-label w-8 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-ink-muted)]">
          {Math.round(volume * 100)}
        </span>
      </label>
    </div>
  )
}
