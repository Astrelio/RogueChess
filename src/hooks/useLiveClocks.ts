import { useEffect, useState } from 'react'
import type { MatchPlayer, MatchRow } from '@/types/match'

type LiveClocks = {
  whiteMs: number
  blackMs: number
  runningFor: 'white' | 'black' | null
}

function parseUpdatedAt(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function sideFlags(
  players: MatchPlayer[] | undefined,
  color: 'white' | 'black',
) {
  const p = players?.find((x) => x.color === color)
  return {
    petrificus: Boolean(p?.petrificus_ready),
    arresto: Boolean(p?.arresto_pending),
  }
}

/**
 * Reloj en vivo a partir de white/black_time_ms + clock_running_for + clock_updated_at.
 * - Pausa si status !== active o clock_running_for es null.
 * - Petrificus: el lado activo no gasta (reloj congelado).
 * - Arresto: el lado activo gasta a x2 (visual; el server también *2 al mover).
 */
export function useLiveClocks(
  match: MatchRow | null | undefined,
  players?: MatchPlayer[],
): LiveClocks {
  const [now, setNow] = useState(() => Date.now())

  const rawRunning =
    match?.status === 'active' && match.clock_running_for
      ? match.clock_running_for
      : null

  const flags = rawRunning ? sideFlags(players, rawRunning) : null
  // Petrificus congela el reloj del jugador que lo tiene listo en su turno
  const running = flags?.petrificus ? null : rawRunning
  const rate = flags?.arresto && running ? 2 : 1

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [
    running,
    rate,
    match?.id,
    match?.clock_updated_at,
    match?.white_time_ms,
    match?.black_time_ms,
  ])

  if (!match) {
    return { whiteMs: 0, blackMs: 0, runningFor: null }
  }

  const updatedAt = parseUpdatedAt(match.clock_updated_at)
  const elapsed =
    running && updatedAt != null
      ? Math.max(0, now - updatedAt) * rate
      : 0

  const whiteMs = Math.max(
    0,
    match.white_time_ms - (running === 'white' ? elapsed : 0),
  )
  const blackMs = Math.max(
    0,
    match.black_time_ms - (running === 'black' ? elapsed : 0),
  )

  return { whiteMs, blackMs, runningFor: running }
}
