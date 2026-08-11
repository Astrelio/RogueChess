/**
 * SFX: procedurales (piezas/UI) + samples Kenney CC0 (soundcn) para eventos de partida.
 * Desbloquea con el primer gesto del usuario (autoplay policies).
 * Prefs en localStorage: mute / volumen de efectos y de música.
 */

import { playSound, playSoundUrl } from '@/lib/sound-engine'
import { confirmation004Sound } from '@/sounds/confirmation-004/confirmation-004'
import { drop002Sound } from '@/sounds/drop-002/drop-002'
import { error005Sound } from '@/sounds/error-005/error-005'
import { jinglesHit05Sound } from '@/sounds/jingles-hit-05/jingles-hit-05'

type SoundKind =
  | 'move'
  | 'capture'
  | 'hover'
  | 'click'
  | 'select'
  | 'phase'
  | 'shop_phase'
  | 'match_end'
  | 'resign'
  | 'check'
  | 'illegal'

/**
 * Sonido custom de cambio de fase (grieta / dimensión):
 * `public/sfx/phase-change.mp3` (cello).
 * Fallback: chime Kenney.
 *
 * Tienda: chime `confirmation-004` (el segundo SFX de fase que pusimos).
 */
export const PHASE_CHANGE_SFX_URL = '/sfx/phase-change.mp3'

const SFX_MUTE_KEY = 'rc-sfx-muted'
const SFX_VOL_KEY = 'rc-sfx-volume'
const MUSIC_MUTE_KEY = 'rc-music-muted'
const MUSIC_VOL_KEY = 'rc-music-volume'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let unlocked = false

const lastPlayed: Partial<Record<SoundKind, number>> = {}

function readBool(key: string, fallback = false): boolean {
  try {
    const v = window.localStorage.getItem(key)
    if (v == null) return fallback
    return v === '1' || v === 'true'
  } catch {
    return fallback
  }
}

function writeBool(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function readVol(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return fallback
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    return Math.min(1, Math.max(0, n))
  } catch {
    return fallback
  }
}

function writeVol(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(Math.min(1, Math.max(0, value))))
  } catch {
    /* ignore */
  }
}

let sfxMuted = typeof window !== 'undefined' ? readBool(SFX_MUTE_KEY, false) : false
let sfxVolume = typeof window !== 'undefined' ? readVol(SFX_VOL_KEY, 0.78) : 0.78
let musicMuted = typeof window !== 'undefined' ? readBool(MUSIC_MUTE_KEY, false) : false
let musicVolume = typeof window !== 'undefined' ? readVol(MUSIC_VOL_KEY, 0.6) : 0.6

function applyMasterGain() {
  if (!master) return
  master.gain.value = sfxMuted ? 0 : sfxVolume
}

function sampleGain(base: number): number {
  if (sfxMuted) return 0
  return Math.max(0, base * sfxVolume)
}

export function isSfxMuted(): boolean {
  return sfxMuted
}

export function setSfxMuted(muted: boolean) {
  sfxMuted = muted
  writeBool(SFX_MUTE_KEY, muted)
  applyMasterGain()
}

export function getSfxVolume(): number {
  return sfxVolume
}

export function setSfxVolume(volume: number) {
  sfxVolume = Math.min(1, Math.max(0, volume))
  writeVol(SFX_VOL_KEY, sfxVolume)
  applyMasterGain()
}

export function isMusicMuted(): boolean {
  return musicMuted
}

export function setMusicMuted(muted: boolean) {
  musicMuted = muted
  writeBool(MUSIC_MUTE_KEY, muted)
}

export function getMusicVolume(): number {
  return musicVolume
}

export function setMusicVolume(volume: number) {
  musicVolume = Math.min(1, Math.max(0, volume))
  writeVol(MUSIC_VOL_KEY, musicVolume)
}

/** Volumen efectivo de música (0 si mute). Listo para BGM cuando exista. */
export function getEffectiveMusicVolume(): number {
  return musicMuted ? 0 : musicVolume
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.connect(ctx.destination)
  }
  applyMasterGain()
  return ctx
}

/** Llamar desde un gesto del usuario (pointerdown / keydown). */
export function unlockAudio(): void {
  const c = ensureCtx()
  if (!c) return
  if (c.state === 'suspended') {
    void c.resume().then(() => {
      unlocked = true
    })
  } else {
    unlocked = true
  }
}

function throttle(kind: SoundKind, ms: number): boolean {
  const now = performance.now()
  const prev = lastPlayed[kind] ?? 0
  if (now - prev < ms) return false
  lastPlayed[kind] = now
  return true
}

function tone(
  frequency: number,
  opts: {
    duration?: number
    type?: OscillatorType
    attack?: number
    volume?: number
    slideTo?: number
    filterFreq?: number
  } = {},
) {
  if (!unlocked || sfxMuted) return
  const c = ensureCtx()
  if (!c || !master) return
  if (c.state === 'suspended') void c.resume()

  const {
    duration = 0.08,
    type = 'sine',
    attack = 0.004,
    volume = 0.22,
    slideTo,
    filterFreq,
  } = opts

  const t0 = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(20, frequency), t0)
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration * 0.85)
  }

  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t0 + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  if (filterFreq) {
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 0.7
    osc.connect(filter)
    filter.connect(gain)
  } else {
    osc.connect(gain)
  }
  gain.connect(master)

  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** Ruido corto filtrado (golpe de madera / captura). */
function noiseBurst(opts: {
  duration?: number
  volume?: number
  filterFreq?: number
} = {}) {
  if (!unlocked || sfxMuted) return
  const c = ensureCtx()
  if (!c || !master) return
  if (c.state === 'suspended') void c.resume()

  const { duration = 0.06, volume = 0.18, filterFreq = 1200 } = opts
  const n = Math.max(1, Math.floor(c.sampleRate * duration))
  const buffer = c.createBuffer(1, n, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / n)
  }

  const t0 = c.currentTime
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  filter.Q.value = 0.9
  const gain = c.createGain()
  gain.gain.setValueAtTime(volume, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  src.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  src.start(t0)
  src.stop(t0 + duration + 0.01)
}

/** Pieza al soltar / jugada del rival. */
export function playMoveSound(opts?: { capture?: boolean }): void {
  if (sfxMuted) return
  const capture = Boolean(opts?.capture)
  if (!throttle(capture ? 'capture' : 'move', 40)) return

  if (capture) {
    noiseBurst({ duration: 0.08, volume: 0.42, filterFreq: 900 })
    tone(220, {
      duration: 0.13,
      type: 'triangle',
      volume: 0.36,
      slideTo: 110,
      filterFreq: 1800,
    })
    return
  }

  noiseBurst({ duration: 0.05, volume: 0.28, filterFreq: 700 })
  tone(165, {
    duration: 0.1,
    type: 'sine',
    volume: 0.32,
    slideTo: 95,
    filterFreq: 1400,
  })
}

/** Jaque: chime ascendente distinto a move/capture. */
export function playCheckSound(): void {
  if (sfxMuted) return
  if (!throttle('check', 180)) return
  tone(520, { duration: 0.09, type: 'sine', volume: 0.34, slideTo: 780, filterFreq: 2800 })
  window.setTimeout(() => {
    tone(780, { duration: 0.12, type: 'triangle', volume: 0.28, slideTo: 980, filterFreq: 3200 })
  }, 70)
}

/** Jugada / aim ilegal. */
export function playIllegalSound(): void {
  if (sfxMuted) return
  if (!throttle('illegal', 120)) return
  tone(180, {
    duration: 0.14,
    type: 'square',
    volume: 0.22,
    slideTo: 90,
    filterFreq: 900,
  })
  noiseBurst({ duration: 0.05, volume: 0.2, filterFreq: 600 })
}

/** Hover suave en botones. */
export function playHoverSound(): void {
  if (sfxMuted) return
  if (!throttle('hover', 55)) return
  tone(620, { duration: 0.04, type: 'sine', volume: 0.14, attack: 0.002 })
}

/** Click / press de botón. */
export function playClickSound(): void {
  if (sfxMuted) return
  if (!throttle('click', 35)) return
  tone(380, {
    duration: 0.055,
    type: 'triangle',
    volume: 0.28,
    slideTo: 240,
    filterFreq: 2200,
  })
  noiseBurst({ duration: 0.025, volume: 0.16, filterFreq: 2400 })
}

/** Selección de pieza / casilla (más suave que un move). */
export function playSelectSound(): void {
  if (sfxMuted) return
  if (!throttle('select', 40)) return
  tone(480, { duration: 0.045, type: 'sine', volume: 0.18, slideTo: 420 })
}

/** Cuenta piezas en la parte de colocación del FEN. */
export function fenPieceCount(fen: string): number {
  const board = fen.split(' ')[0] ?? ''
  let n = 0
  for (const ch of board) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) n++
  }
  return n
}

/* --- Samples Kenney (CC0) vía soundcn — eventos de partida --- */

function playSample(kind: SoundKind, dataUri: string, volume = 0.68, throttleMs = 400) {
  if (sfxMuted) return
  if (!throttle(kind, throttleMs)) return
  unlockAudio()
  void playSound(dataUri, { volume: sampleGain(volume) }).catch(() => undefined)
}

/** Victoria (jugador). */
export function playWinSound(): void {
  playSample('match_end', jinglesHit05Sound.dataUri, 0.72, 1200)
}

/** Derrota (jugador). */
export function playLoseSound(): void {
  playSample('match_end', error005Sound.dataUri, 0.7, 1200)
}

/** Fin neutro (tablas / espectador). */
export function playMatchEndNeutralSound(): void {
  playSample('match_end', confirmation004Sound.dataUri, 0.62, 1200)
}

/** Rendirse (feedback inmediato al pulsar). */
export function playResignSound(): void {
  playSample('resign', drop002Sound.dataUri, 0.65, 300)
}

/**
 * Cambio de fase / grieta / dimensión.
 * Preferencia: `public/sfx/phase-change.mp3` (cello).
 * Fallback: chime Kenney.
 */
export function playPhaseSound(): void {
  if (sfxMuted) return
  if (!throttle('phase', 500)) return
  unlockAudio()
  void (async () => {
    try {
      await playSoundUrl(PHASE_CHANGE_SFX_URL, { volume: sampleGain(0.72) })
    } catch {
      await playSound(confirmation004Sound.dataUri, { volume: sampleGain(0.58) }).catch(
        () => undefined,
      )
    }
  })()
}

/** Entrada a tienda — chime confirmation-004 (no el whoosh ni el cello). */
export function playShopPhaseSound(): void {
  playSample('shop_phase', confirmation004Sound.dataUri, 0.62, 500)
}
