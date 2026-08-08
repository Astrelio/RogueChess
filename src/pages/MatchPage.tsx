import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { fenWithDragPreview } from '@/lib/dragPreview'
import { mirrorCommand, applyMirrorPawnFen } from '@/lib/mirrorMove'
import {
  buildJokerPayload,
  getJokerTargetMode,
  needsBoardTarget,
  type JokerTargetMode,
} from '@/lib/jokerTargets'
import { JokerCard } from '@/components/jokers/JokerCard'
import { JokerTargetBanner } from '@/components/match/JokerTargetBanner'
import { MatchPortalBridge, type MatchPortalPeerInfo } from '@/components/match/MatchPortalBridge'
import { ShopPhaseModal, ShopWaitOverlay } from '@/components/match/ShopPhaseModal'
import { VictoryOverlay } from '@/components/match/VictoryOverlay'
import { PageTransition } from '@/components/PageTransition'
import {
  portalReady,
  type MatchBoardSnapshot,
  type MatchEmotePayload,
  type PieceDragPayload,
  type ShopReadyPayload,
} from '@/lib/portal'
import { previewAparicionFen, previewRemovePieceFen } from '@/lib/jokerOptimistic'
import { fenHideEnemyInvisible } from '@/lib/invisibleFen'
import { useLiveClocks } from '@/hooks/useLiveClocks'
import type { MatchState, Joker, MatchPlayer, PieceFlag } from '@/types/match'

/** Alinea el FEN con matches.turn_color (Giratiempo / desync). */
function fenWithSideToMove(fen: string, color: 'white' | 'black'): string {
  const parts = fen.split(' ')
  if (parts.length < 2) return fen
  parts[1] = color === 'white' ? 'w' : 'b'
  return parts.join(' ')
}

/** Casillas estrictamente entre a y b (cliente; espejo de server/engine/board). */
function pathBetweenClient(a: string, b: string): string[] {
  const df = b.charCodeAt(0) - a.charCodeAt(0)
  const dr = Number(b[1]) - Number(a[1])
  const straight = df === 0 || dr === 0
  const diagonal = Math.abs(df) === Math.abs(dr)
  if (!straight && !diagonal) return []
  const steps = Math.max(Math.abs(df), Math.abs(dr))
  if (steps <= 1) return []
  const sf = Math.sign(df)
  const sr = Math.sign(dr)
  const out: string[] = []
  for (let i = 1; i < steps; i++) {
    const file = a.charCodeAt(0) - 97 + sf * i
    const rank = Number(a[1]) - 1 + sr * i
    if (file < 0 || file > 7 || rank < 0 || rank > 7) break
    out.push(String.fromCharCode(97 + file) + String(rank + 1))
  }
  return out
}

type JokerAim = {
  inventoryId: string
  jokerName: string
  mode: JokerTargetMode
  squares: string[]
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

const dimLabel: Record<string, string> = {
  primo: 'Tablero Primo',
  espejo: 'Espejo',
  bluriel: 'Bluriel',
  gravitacional: 'Gravitacional',
  cadena_sangre: 'Cadena de Sangre',
  ruina: 'Ruina',
  mercado_negro: 'Mercado Negro',
  fragilidad: 'Fragilidad',
}

export function MatchPage() {
  const { id = '' } = useParams()
  const { user, ready, getToken } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<MatchState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const turnStarted = useRef(Date.now())
  const publishRef = useRef<((next: MatchState, reason?: string) => Promise<void>) | null>(null)
  const publishDragRef = useRef<
    ((drag: Omit<PieceDragPayload, 'type' | 'at'> & { force?: boolean }) => void) | null
  >(null)
  const publishBoardRef = useRef<
    ((next: MatchState, opts?: { preview?: boolean }) => Promise<void>) | null
  >(null)
  const publishShopReadyRef = useRef<
    | ((payload: {
        matchId: string
        uid: string
        color: 'white' | 'black'
        cycle_index: number
      }) => Promise<void>)
    | null
  >(null)
  const publishEmoteRef = useRef<
    ((payload: { matchId: string; uid: string; emote: string }) => Promise<void>) | null
  >(null)
  const sendActivityRef = useRef<((kind: string) => void) | null>(null)
  const localDrag = useRef<{ from: string; piece: string } | null>(null)
  const [remoteDrag, setRemoteDrag] = useState<PieceDragPayload | null>(null)
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null)
  const [aim, setAim] = useState<JokerAim | null>(null)
  const [justBoughtOfferId, setJustBoughtOfferId] = useState<string | null>(null)
  const [justBoughtInventoryId, setJustBoughtInventoryId] = useState<string | null>(null)
  const [shopPeek, setShopPeek] = useState(false)
  const [peerInfo, setPeerInfo] = useState<MatchPortalPeerInfo | null>(null)
  const [rivalEmote, setRivalEmote] = useState<string | null>(null)
  const emoteTimer = useRef<number | null>(null)
  const [boardFx, setBoardFx] = useState<{
    squares: string[]
    kind: 'swap' | 'vanish'
  } | null>(null)
  const boardFxTimer = useRef<number | null>(null)

  const flashBoardFx = useCallback((squares: string[], kind: 'swap' | 'vanish') => {
    if (boardFxTimer.current != null) window.clearTimeout(boardFxTimer.current)
    setBoardFx({ squares, kind })
    boardFxTimer.current = window.setTimeout(() => {
      setBoardFx(null)
      boardFxTimer.current = null
    }, kind === 'swap' ? 600 : 480)
  }, [])

  const applyState = useCallback(
    (s: MatchState, opts?: { publish?: boolean; resetClock?: boolean; reason?: string }) => {
      setState(s)
      setOptimisticFen(null)
      setRemoteDrag(null)
      if (s.match.status !== 'shop' && s.match.phase !== 'shop') {
        setShopPeek(false)
      }
      if (opts?.resetClock) turnStarted.current = Date.now()
      if (opts?.publish !== false) void publishRef.current?.(s, opts?.reason)
    },
    [],
  )

  const load = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const { state: s } = await api.getMatch(token, id)
    applyState(s as MatchState, { publish: false, resetClock: true })
  }, [getToken, id, applyState])

  const lastSyncAt = useRef(0)
  const syncFromServer = useCallback(() => {
    const now = Date.now()
    // Más agresivo: 200ms (antes 450) para no “comerse” dirtys seguidos
    if (now - lastSyncAt.current < 200) return
    lastSyncAt.current = now
    setRemoteDrag(null)
    void load().catch(() => undefined)
  }, [load])

  const onDirty = useCallback(
    (_reason: string) => {
      syncFromServer()
    },
    [syncFromServer],
  )

  const onChannelReady = useCallback(() => {
    // Reconexión Portal / late-join: Neon puede tener finished que perdimos al salir
    syncFromServer()
  }, [syncFromServer])

  const onBoardPulse = useCallback(
    (board: MatchBoardSnapshot) => {
      setRemoteDrag(null)
      if (!board.preview) {
        setOptimisticFen(null)
      }
      setState((prev) => {
        if (!prev) return prev
        if (board.preview && board.fen) {
          return {
            ...prev,
            match: { ...prev.match, fen: board.fen },
          }
        }

        if (board.status === 'finished') {
          return {
            ...prev,
            match: {
              ...prev.match,
              status: 'finished',
              clock_running_for: null,
              ...(board.fen ? { fen: board.fen } : {}),
              ...(board.phase ? { phase: board.phase as MatchState['match']['phase'] } : {}),
              ...(board.result !== undefined ? { result: board.result } : {}),
              ...(board.winner_id !== undefined ? { winner_id: board.winner_id } : {}),
            },
          }
        }

        const nextRunning =
          board.clock_running_for !== undefined
            ? board.clock_running_for
            : prev.match.clock_running_for

        let fenPatch: Partial<MatchState['match']> = {}
        if (board.fen) {
          fenPatch = {
            fen: board.fen,
            cycle_index: board.cycle_index || prev.match.cycle_index,
            moves_in_phase: board.moves_in_phase || prev.match.moves_in_phase,
            status: (board.status || prev.match.status) as MatchState['match']['status'],
            phase: (board.phase || prev.match.phase) as MatchState['match']['phase'],
          }
        }

        return {
          ...prev,
          match: {
            ...prev.match,
            ...fenPatch,
            white_time_ms: board.white_time_ms,
            black_time_ms: board.black_time_ms,
            turn_color: board.turn_color as MatchState['match']['turn_color'],
            clock_running_for: nextRunning,
            clock_updated_at: new Date(board.at || Date.now()).toISOString(),
          },
        }
      })

      if (board.status === 'finished' && !board.preview) {
        syncFromServer()
        return
      }
      if (board.fen && !board.preview) turnStarted.current = Date.now()
    },
    [syncFromServer],
  )

  const onRemotePieceDrag = useCallback(
    (drag: PieceDragPayload) => {
      if (user?.uid && drag.uid && drag.uid === user.uid) return
      if (!drag.active) {
        setRemoteDrag(null)
        return
      }
      setRemoteDrag(drag)
    },
    [user?.uid],
  )

  const onShopReadyPulse = useCallback((p: ShopReadyPayload) => {
    if (user?.uid && p.uid === user.uid) return
    setState((prev) => {
      if (!prev || prev.match.cycle_index !== p.cycle_index) return prev
      return {
        ...prev,
        players: prev.players.map((pl) =>
          pl.color === p.color ? { ...pl, shop_ready: true } : pl,
        ),
      }
    })
  }, [user?.uid])

  const onEmotePulse = useCallback((p: MatchEmotePayload) => {
    if (user?.uid && p.uid === user.uid) return
    if (emoteTimer.current != null) window.clearTimeout(emoteTimer.current)
    setRivalEmote(p.emote)
    emoteTimer.current = window.setTimeout(() => {
      setRivalEmote(null)
      emoteTimer.current = null
    }, 2200)
  }, [user?.uid])

  const onPeerInfo = useCallback((info: MatchPortalPeerInfo) => {
    setPeerInfo(info)
  }, [])

  // Si el oponente suelta el drag y no llega el end, limpiar
  useEffect(() => {
    if (!remoteDrag?.active) return
    const t = window.setTimeout(() => setRemoteDrag(null), 2500)
    return () => window.clearTimeout(t)
  }, [remoteDrag])

  useEffect(() => {
    if (!ready || !user) return
    load().catch((err) => setError(err instanceof Error ? err.message : 'Error'))
  }, [ready, user, load])

  useEffect(() => {
    if (!ready || !user || !id) return
    const onVis = () => {
      if (document.visibilityState === 'visible') syncFromServer()
    }
    const onFocus = () => syncFromServer()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
    }
  }, [ready, user, id, syncFromServer])

  const you = state?.you
  const match = state?.match
  const inShopPhase = Boolean(match && (match.status === 'shop' || match.phase === 'shop'))
  const youShopReady = Boolean(you?.shop_ready)
  const isShop = inShopPhase && !youShopReady
  const isShopWaiting = inShopPhase && youShopReady
  const isWaitingRival = match?.status === 'waiting'
  const isFinished = match?.status === 'finished'
  const yourTurn = Boolean(you && match && match.status === 'active' && match.turn_color === you.color)
  const clocks = useLiveClocks(match, state?.players)
  const timeoutClaimed = useRef(false)
  const shopTimeoutClaimed = useRef(false)

  // Reto: host espera a que el rival acepte (join)
  useEffect(() => {
    if (!isWaitingRival || !id) return
    const t = window.setInterval(() => syncFromServer(), 1800)
    return () => window.clearInterval(t)
  }, [isWaitingRival, id, syncFromServer])

  // Si Portal no está ready → poll agresivo. Si está ready → poll suave
  // por si el WS “parece” ok pero no entrega mensajes.
  useEffect(() => {
    if (!id || isFinished || isWaitingRival) return
    if (!match || (match.status !== 'active' && match.status !== 'shop')) return
    const ms = peerInfo?.status === 'ready' ? 7000 : 1200
    const t = window.setInterval(() => syncFromServer(), ms)
    return () => window.clearInterval(t)
  }, [id, isFinished, isWaitingRival, match?.status, peerInfo?.status, syncFromServer])

  // Activity Portal: “shopping” mientras estás en el mercado
  useEffect(() => {
    if (!isShop) return
    sendActivityRef.current?.('shopping')
    const t = window.setInterval(() => sendActivityRef.current?.('shopping'), 4000)
    return () => window.clearInterval(t)
  }, [isShop])

  const [shopLeftMs, setShopLeftMs] = useState(0)
  useEffect(() => {
    if (!inShopPhase || !match?.shop_ends_at) {
      setShopLeftMs(0)
      return
    }
    const ends = new Date(match.shop_ends_at).getTime()
    const tick = () => setShopLeftMs(Math.max(0, ends - Date.now()))
    tick()
    const t = window.setInterval(tick, 200)
    return () => window.clearInterval(t)
  }, [inShopPhase, match?.shop_ends_at, match?.cycle_index])

  // Flag: cuando un reloj vivo llega a 0, el server cierra la partida por tiempo
  useEffect(() => {
    if (!match || !id || isFinished || match.status !== 'active') {
      timeoutClaimed.current = false
      return
    }
    if (!clocks.runningFor) return
    const flaggedOut =
      (clocks.runningFor === 'white' && clocks.whiteMs <= 0) ||
      (clocks.runningFor === 'black' && clocks.blackMs <= 0)
    if (!flaggedOut || timeoutClaimed.current || busy) return
    timeoutClaimed.current = true
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const { state: s } = await api.claimTimeout(token, id)
        applyState(s as MatchState, { reason: 'timeout' })
      } catch {
        timeoutClaimed.current = false
        await load().catch(() => undefined)
      }
    })()
  }, [
    match,
    id,
    isFinished,
    clocks.runningFor,
    clocks.whiteMs,
    clocks.blackMs,
    busy,
    getToken,
    applyState,
    load,
  ])

  // Minuto de tienda agotado → forzar cierre en Neon
  useEffect(() => {
    if (!inShopPhase || !id || isFinished) {
      shopTimeoutClaimed.current = false
      return
    }
    if (shopLeftMs > 0 || shopTimeoutClaimed.current || busy) return
    if (!match?.shop_ends_at) return
    shopTimeoutClaimed.current = true
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const { state: s } = await api.claimShopTimeout(token, id)
        applyState(s as MatchState, { resetClock: true, reason: 'shop_timeout' })
      } catch {
        shopTimeoutClaimed.current = false
        await load().catch(() => undefined)
      }
    })()
  }, [
    inShopPhase,
    id,
    isFinished,
    shopLeftMs,
    busy,
    match?.shop_ends_at,
    getToken,
    applyState,
    load,
  ])

  const displayFen = useMemo(() => {
    if (!match) return ''
    const base = optimisticFen ?? match.fen
    const hidden = fenHideEnemyInvisible(base, state?.flags, you?.color)
    if (!remoteDrag?.active || optimisticFen) return hidden
    return fenWithDragPreview(hidden, { from: remoteDrag.from, hover: remoteDrag.hover })
  }, [match, remoteDrag, optimisticFen, state?.flags, you?.color])

  const dragSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    // Anomalías del tablero (Bombarda / Ruina / monolitos / trampas)
    for (const c of state?.cells ?? []) {
      if (c.is_active === false) continue
      const sq = String(c.square).trim()
      if (c.effect === 'burned') {
        styles[sq] = {
          backgroundColor: 'rgba(180, 60, 40, 0.42)',
          boxShadow: 'inset 0 0 0 2px rgba(140, 40, 20, 0.55)',
        }
      } else if (c.effect === 'ruined') {
        styles[sq] = {
          backgroundColor: 'rgba(60, 55, 45, 0.5)',
          boxShadow: 'inset 0 0 0 2px rgba(40, 35, 30, 0.45)',
        }
      } else if (c.effect === 'monolith') {
        styles[sq] = {
          backgroundColor: 'rgba(212, 175, 55, 0.28)',
          boxShadow: 'inset 0 0 0 2px rgba(212, 175, 55, 0.45)',
        }
      } else if (c.effect === 'trap_defodio') {
        // Solo el dueño ve un leve matiz (el rival no debería saberlo del todo;
        // en MVP ambos lo ven sutil para evitar softlocks de UI).
        styles[sq] = {
          backgroundColor: 'rgba(90, 40, 120, 0.18)',
        }
      }
    }

    if (remoteDrag?.active) {
      styles[remoteDrag.from] = { backgroundColor: 'rgba(115, 92, 0, 0.28)' }
      if (remoteDrag.hover && remoteDrag.hover !== remoteDrag.from) {
        styles[remoteDrag.hover] = { backgroundColor: 'rgba(212, 175, 55, 0.45)' }
      }
    }
    if (aim) {
      aim.squares.forEach((sq, i) => {
        styles[sq] = {
          backgroundColor:
            i === 0 ? 'rgba(212, 175, 55, 0.55)' : 'rgba(115, 92, 0, 0.5)',
          boxShadow: 'inset 0 0 0 2px rgba(212, 175, 55, 0.9)',
        }
      })
    }
    if (boardFx) {
      for (const sq of boardFx.squares) {
        styles[sq] = {
          ...(styles[sq] ?? {}),
          // className no existe en squareStyles; usamos animationName vía CSS global
          animationName: boardFx.kind === 'swap' ? 'rc-joker-swap' : 'rc-joker-vanish',
          animationDuration: boardFx.kind === 'swap' ? '0.55s' : '0.45s',
          animationTimingFunction: 'ease-out',
          animationFillMode: 'both',
        }
      }
    }
    return Object.keys(styles).length ? styles : undefined
  }, [remoteDrag, aim, state?.cells, boardFx])

  const blockedSquares = useMemo(() => {
    const set = new Set<string>()
    for (const c of state?.cells ?? []) {
      if (c.is_active === false) continue
      if (c.effect === 'burned' || c.effect === 'ruined') set.add(String(c.square).trim())
    }
    return set
  }, [state?.cells])

  // Esc cancela el apuntado del comodín
  useEffect(() => {
    if (!aim) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAim(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aim])

  function endLocalDrag() {
    const d = localDrag.current
    localDrag.current = null
    if (!d || !id) return
    publishDragRef.current?.({
      matchId: id,
      from: d.from,
      hover: null,
      piece: d.piece,
      active: false,
      uid: user?.uid,
      force: true,
    })
  }

  function startLocalDrag(from: string, piece: string) {
    if (!id) return
    localDrag.current = { from, piece }
    publishDragRef.current?.({
      matchId: id,
      from,
      hover: from,
      piece,
      active: true,
      uid: user?.uid,
      force: true,
    })
  }

  function hoverLocalDrag(square: string) {
    const d = localDrag.current
    if (!d || !id) return
    publishDragRef.current?.({
      matchId: id,
      from: d.from,
      hover: square,
      piece: d.piece,
      active: true,
      uid: user?.uid,
    })
  }

  const yourShop = useMemo(() => {
    if (!state?.you) return []
    return (state.shop || []).filter((o) => o.match_player_id === state.you!.id && !o.purchased && !o.expired)
  }, [state])

  const yourInv = useMemo(() => {
    if (!state?.you) return []
    return (state.inventory || []).filter((i) => i.match_player_id === state.you!.id)
  }, [state])

  // Tienda / fin de partida / ítem consumido → salir del modo apuntado
  useEffect(() => {
    if (!aim) return
    if (inShopPhase || isFinished) {
      setAim(null)
      return
    }
    if (!yourInv.some((i) => i.id === aim.inventoryId)) setAim(null)
  }, [aim, inShopPhase, isFinished, yourInv])

  const bridge =
    portalReady && id ? (
      <MatchPortalBridge
        matchId={id}
        color={you?.color}
        onDirty={onDirty}
        onBoardPulse={onBoardPulse}
        onPieceDrag={onRemotePieceDrag}
        onShopReady={onShopReadyPulse}
        onEmote={onEmotePulse}
        onChannelReady={onChannelReady}
        onPeerInfo={onPeerInfo}
        publishRef={publishRef}
        publishDragRef={publishDragRef}
        publishBoardRef={publishBoardRef}
        publishShopReadyRef={publishShopReadyRef}
        publishEmoteRef={publishEmoteRef}
        sendActivityRef={sendActivityRef}
      />
    ) : null

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    endLocalDrag()
    if (!targetSquare || !yourTurn || busy) return false
    // Misma casilla: no es jugada, no llamar API
    if (sourceSquare === targetSquare) return false

    if (blockedSquares.has(targetSquare)) {
      setError('Esa casilla está quemada o en ruina — no puedes aterrizar ahí')
      return false
    }

    const chess = new Chess(fenWithSideToMove(match!.fen, match!.turn_color))
    const piece = chess.get(sourceSquare as 'a1')
    let dest = targetSquare
    // Preview alineado con el motor: en Espejo el comando se invierte por completo
    if (match!.current_dimension === 'espejo') {
      const mirrored = mirrorCommand(sourceSquare, targetSquare)
      if (!mirrored || mirrored === sourceSquare) {
        setError('Espejo: ese comando sale del tablero al invertirse')
        return false
      }
      dest = mirrored
      if (blockedSquares.has(dest)) {
        setError('Espejo: el destino efectivo está quemado o en ruina')
        return false
      }
    }

    // Trayectoria (no caballos): no cruzar quemadas
    if (piece && piece.type !== 'n') {
      const path = pathBetweenClient(sourceSquare, dest)
      if (path.some((sq) => blockedSquares.has(sq))) {
        setError('La trayectoria cruza una zona quemada o en ruina')
        return false
      }
    }

    let previewFen: string | null = null
    // chess.js v1 lanza en jugadas ilegales (no devuelve null)
    try {
      const preview = chess.move({ from: sourceSquare, to: dest })
      if (preview) previewFen = chess.fen()
    } catch {
      previewFen = null
    }
    if (
      !previewFen &&
      match!.current_dimension === 'espejo' &&
      piece?.type === 'p' &&
      you?.color
    ) {
      previewFen = applyMirrorPawnFen(
        fenWithSideToMove(match!.fen, match!.turn_color),
        sourceSquare,
        dest,
        you.color,
      )
    }
    if (!previewFen) {
      setError(
        match!.current_dimension === 'espejo'
          ? `Espejo: al invertir, la pieza iría a ${dest} (ilegal)`
          : 'Movimiento ilegal',
      )
      return false
    }

    // Optimista: la pieza queda en destino al instante (animación del board)
    setOptimisticFen(previewFen)
    if (state) {
      const previewState: MatchState = {
        ...state,
        match: { ...state.match, fen: previewFen },
      }
      void publishBoardRef.current?.(previewState, { preview: true })
    }
    setBusy(true)
    setError(null)
    const spent = Date.now() - turnStarted.current
    void (async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error('Sin sesión')
        const { state: s } = await api.makeMove(token, id, {
          from: sourceSquare,
          to: targetSquare,
          timeSpentMs: spent,
        })
        applyState(s as MatchState, { resetClock: true, reason: 'move' })
      } catch (err) {
        setOptimisticFen(null)
        setError(err instanceof Error ? err.message : 'Jugada ilegal')
        await load().catch(() => undefined)
      } finally {
        setBusy(false)
      }
    })()
    return true
  }

  async function buy(offerId: string) {
    if (!state?.you || busy) return
    const offer = yourShop.find((o) => o.id === offerId)
    if (!offer?.joker) return
    if (yourInv.length >= (state.you.inventory_slots ?? 3)) {
      setError('Inventario lleno')
      return
    }
    const clockMs =
      state.you.color === 'black'
        ? state.match.black_time_ms
        : state.you.color === 'white'
          ? state.match.white_time_ms
          : state.you.time_ms
    if (clockMs < offer.cost_seconds * 1000) {
      setError('No te alcanza el tiempo')
      return
    }

    const costMs = offer.cost_seconds * 1000
    const tempInvId = `optimistic-${offerId}`
    setBusy(true)
    setError(null)
    setJustBoughtOfferId(offerId)
    setJustBoughtInventoryId(tempInvId)

    // Optimista: UI responde al instante; Portal publica el pulse tras el server
    setState((prev) => {
      if (!prev?.you) return prev
      const color = prev.you.color
      return {
        ...prev,
        match: {
          ...prev.match,
          white_time_ms:
            color === 'white' ? Math.max(0, prev.match.white_time_ms - costMs) : prev.match.white_time_ms,
          black_time_ms:
            color === 'black' ? Math.max(0, prev.match.black_time_ms - costMs) : prev.match.black_time_ms,
        },
        shop: (prev.shop || []).map((o) => (o.id === offerId ? { ...o, purchased: true } : o)),
        inventory: [
          ...(prev.inventory || []),
          {
            id: tempInvId,
            match_id: prev.match.id,
            match_player_id: prev.you.id,
            joker_id: offer.joker_id,
            status: 'owned',
            purchased_cost_s: offer.cost_seconds,
            slot_index: yourInv.length,
            joker: offer.joker,
          },
        ],
        you: {
          ...prev.you,
          time_ms: Math.max(0, prev.you.time_ms - costMs),
        },
      }
    })

    try {
      const token = await getToken()
      if (!token) return
      const { state: s } = await api.buyJoker(token, id, offerId)
      const realInv = ((s as MatchState).inventory || []).find(
        (i) =>
          i.match_player_id === (s as MatchState).you?.id &&
          i.joker_id === offer.joker_id &&
          i.status === 'owned',
      )
      if (realInv) setJustBoughtInventoryId(realInv.id)
      applyState(s as MatchState, { reason: 'buy' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comprar')
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
      window.setTimeout(() => {
        setJustBoughtOfferId(null)
        setJustBoughtInventoryId(null)
      }, 900)
    }
  }

  async function sell(inventoryId: string) {
    if (!state?.you || busy) return
    const item = yourInv.find((i) => i.id === inventoryId)
    if (!item) return
    const refundMs = (item.purchased_cost_s ?? item.joker?.cost_seconds ?? 0) * 1000

    setBusy(true)
    setError(null)
    setState((prev) => {
      if (!prev?.you) return prev
      const color = prev.you.color
      return {
        ...prev,
        match: {
          ...prev.match,
          white_time_ms:
            color === 'white' ? prev.match.white_time_ms + refundMs : prev.match.white_time_ms,
          black_time_ms:
            color === 'black' ? prev.match.black_time_ms + refundMs : prev.match.black_time_ms,
        },
        inventory: (prev.inventory || []).filter((i) => i.id !== inventoryId),
        you: { ...prev.you, time_ms: prev.you.time_ms + refundMs },
      }
    })

    try {
      const token = await getToken()
      if (!token) return
      const { state: s } = await api.sellJoker(token, id, inventoryId)
      applyState(s as MatchState, { reason: 'sell' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vender')
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  async function castJoker(inventoryId: string, payload: Record<string, unknown> = {}) {
    if (!state?.you || busy) return
    const item = yourInv.find((i) => i.id === inventoryId)
    const code = item?.joker?.code

    setBusy(true)
    setError(null)
    setAim(null)

    // Optimista: inventario + FEN de tablero cuando el comodín lo cambia
    let previewFen: string | null = null
    if (item && code && state.match.fen && state.you.color) {
      if (code === 'aparicion' && typeof payload.a === 'string' && typeof payload.b === 'string') {
        previewFen = previewAparicionFen(
          state.match.fen,
          payload.a,
          payload.b,
          state.you.color,
        )
        if (previewFen) flashBoardFx([payload.a, payload.b], 'swap')
      } else if (
        (code === 'avada_kedavra' || code === 'morsmordre') &&
        typeof payload.square === 'string'
      ) {
        previewFen = previewRemovePieceFen(state.match.fen, payload.square)
        if (previewFen) flashBoardFx([payload.square], 'vanish')
      }
    }
    if (previewFen) {
      setOptimisticFen(previewFen)
      if (state) {
        void publishBoardRef.current?.(
          { ...state, match: { ...state.match, fen: previewFen } },
          { preview: true },
        )
      }
    }

    if (item && code) {
      setState((prev) => {
        if (!prev?.you) return prev
        let next = {
          ...prev,
          inventory: (prev.inventory || []).filter((i) => i.id !== inventoryId),
          ...(previewFen
            ? { match: { ...prev.match, fen: previewFen } }
            : {}),
        }
        const you = { ...next.you! }
        const players = (next.players || []).map((p) =>
          p.id === you.id ? { ...p } : p,
        )
        const me = players.find((p) => p.id === you.id)
        if (code === 'giratiempo' && me) {
          me.giratiempo_active = true
          me.giratiempo_moves_left = 2
          me.giratiempo_captures = 0
          Object.assign(you, me)
        }
        if (code === 'petrificus_totalus' && me) {
          me.petrificus_ready = true
          Object.assign(you, me)
        }
        if (code === 'arresto_momentum') {
          for (const p of players) {
            if (p.id !== you.id) p.arresto_pending = true
          }
        }
        if (code === 'axio_tempus') {
          const steal = 10000
          next = {
            ...next,
            match: {
              ...next.match,
              white_time_ms:
                you.color === 'white'
                  ? next.match.white_time_ms + steal
                  : Math.max(0, next.match.white_time_ms - steal),
              black_time_ms:
                you.color === 'black'
                  ? next.match.black_time_ms + steal
                  : Math.max(0, next.match.black_time_ms - steal),
            },
          }
          you.time_ms = you.time_ms + steal
        }
        if (code === 'expecto_patronum') {
          next = {
            ...next,
            match: { ...next.match, expecto_patronum_active: true },
          }
        }
        if (code === 'capa_invisibilidad' && typeof payload.square === 'string') {
          const sq = payload.square
          const flag: PieceFlag = {
            piece_uid: `inv:${sq}:opt`,
            color: you.color,
            kind: '?',
            square: sq,
            is_invisible: true,
          }
          next = {
            ...next,
            flags: [...(next.flags || []).filter((f) => f.square !== sq), flag],
          }
        }
        return { ...next, players, you }
      })
    }

    try {
      const token = await getToken()
      if (!token) return
      const { state: s } = await api.useJoker(token, id, inventoryId, payload)
      applyState(s as MatchState, { reason: 'use_joker' })
    } catch (err) {
      setOptimisticFen(null)
      setError(err instanceof Error ? err.message : 'No se pudo usar')
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  function beginJokerUse(inventoryId: string, joker: Joker) {
    if (busy || inShopPhase || isFinished) return
    const mode = getJokerTargetMode(joker.code)
    if (!needsBoardTarget(joker.code)) {
      void castJoker(inventoryId, {})
      return
    }
    setError(null)
    setAim({
      inventoryId,
      jokerName: joker.name,
      mode,
      squares: [],
    })
  }

  function onAimSquare(square: string) {
    if (!aim || busy) return
    // Evitar duplicar la misma casilla en multi-target (apareción / imperius)
    if (aim.squares.includes(square) && aim.mode.slots.length > 1) return

    const nextSquares = [...aim.squares, square]
    const payload = buildJokerPayload(aim.mode, nextSquares)
    if (!payload) {
      setAim({ ...aim, squares: nextSquares })
      return
    }
    void castJoker(aim.inventoryId, payload)
  }

  async function closeShop() {
    if (!match || !you) return
    setBusy(true)
    setError(null)
    // Optimista: listo y modal de espera (la fase sigue en shop hasta el rival / timeout)
    setState((prev) => {
      if (!prev?.you) return prev
      return {
        ...prev,
        you: { ...prev.you, shop_ready: true },
        players: prev.players.map((p) =>
          p.id === prev.you!.id ? { ...p, shop_ready: true } : p,
        ),
      }
    })
    try {
      const token = await getToken()
      if (!token) return
      const { state: s } = await api.closeShop(token, id)
      if (user?.uid && you.color && s.match.status === 'shop') {
        void publishShopReadyRef.current?.({
          matchId: id,
          uid: user.uid,
          color: you.color,
          cycle_index: match.cycle_index,
        })
      }
      applyState(s as MatchState, {
        resetClock: s.match.status === 'active',
        reason: s.match.status === 'shop' ? 'shop_ready' : 'close_shop',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cerrando tienda')
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  async function resign() {
    const token = await getToken()
    if (!token) return
    const { state: s } = await api.resignMatch(token, id)
    applyState(s as MatchState, { reason: 'resign' })
  }

  if (ready && !user) return <Navigate to="/login" replace />
  if (!state || !match) {
    return (
      <>
        {bridge}
        <p className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
          {error ?? 'Cargando partida…'}
        </p>
      </>
    )
  }

  const yourTimeMs =
    you?.color === 'black' ? clocks.blackMs : you?.color === 'white' ? clocks.whiteMs : you?.time_ms ?? 0
  const white = state.players.find((p) => p.color === 'white')
  const black = state.players.find((p) => p.color === 'black')

  const youWon = Boolean(you?.profile_id && match.winner_id && match.winner_id === you.profile_id)
  const isDraw = match.result === 'draw' || match.result === 'abort'
  const victoryTitle = isDraw ? 'Tablas' : youWon ? 'Victoria' : 'Derrota'
  const victorySubtitle = isDraw
    ? 'El tablero se queda en empate. El tiempo no eligió bando.'
    : youWon
      ? 'La dimensión te sonrió. Tu reloj aún late.'
      : 'Otra grieta, otra chance. El mercado te espera de nuevo.'
  const resultLabel =
    match.result === 'resign'
      ? 'Por rendición'
      : match.result === 'timeout'
        ? 'Por tiempo'
        : match.result === 'white_win' || match.result === 'black_win'
          ? 'Jaque mate'
          : match.result === 'draw'
            ? 'Empate'
            : 'Fin de partida'

  async function rematch() {
    const token = await getToken()
    if (!token) return
    const { match: m } = await api.startQuickMatch(token)
    navigate(`/partida/${m.id}`)
  }

  return (
    <PageTransition>
      {bridge}
      <ShopPhaseModal
        open={isShop && !isFinished}
        cycleIndex={match.cycle_index}
        timeMs={yourTimeMs}
        shopLeftMs={shopLeftMs || 60000}
        offers={yourShop}
        inventory={yourInv}
        inventorySlots={you?.inventory_slots ?? 3}
        busy={busy}
        error={error}
        justBoughtOfferId={justBoughtOfferId}
        justBoughtInventoryId={justBoughtInventoryId}
        onBuy={(offerId) => void buy(offerId)}
        onSell={(inventoryId) => void sell(inventoryId)}
        onContinue={() => void closeShop()}
      />
      <ShopWaitOverlay
        open={isShopWaiting && !isFinished}
        peek={shopPeek}
        shopLeftMs={shopLeftMs}
        rivalShopping={peerInfo?.shoppingActivity}
        onPeek={() => setShopPeek(true)}
        onBack={() => setShopPeek(false)}
      />
      <VictoryOverlay
        open={isFinished}
        title={victoryTitle}
        subtitle={victorySubtitle}
        resultLabel={resultLabel}
        youWon={youWon && !isDraw}
        onExit={() => navigate('/')}
        onRematch={() => void rematch()}
      />
      <div
        className={`grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] ${
          isShop || (isShopWaiting && !shopPeek) ? 'pointer-events-none select-none' : ''
        }`}
        aria-hidden={isShop || (isShopWaiting && !shopPeek) || undefined}
      >
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-label text-[10px] uppercase tracking-[0.16em] text-[var(--color-primary)]">
                {match.mode === 'bot'
                  ? 'Partida rápida · vs RogueBot'
                  : isWaitingRival
                    ? 'Reto Portal · esperando rival'
                    : 'Partida'}
              </p>
              <h1 className="font-display text-2xl text-[var(--color-ink)]">
                {isWaitingRival
                  ? 'Esperando aceptación…'
                  : dimLabel[match.current_dimension] ?? match.current_dimension}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {isWaitingRival
                  ? 'El rival debe pulsar Aceptar en el toast de Portal / inbox.'
                  : `Ciclo ${match.cycle_index} · fase ${match.phase} · movimientos ${match.moves_in_phase}/${match.moves_per_phase}`}
              </p>
              {peerInfo ? (
                <p className="font-label mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                  Portal · {peerInfo.status}
                  {peerInfo.rivalOnline ? ' · rival en canal' : ' · solo tú'}
                  {peerInfo.shoppingActivity ? ' · rival en tienda…' : ''}
                </p>
              ) : null}
              {rivalEmote ? (
                <p className="mt-2 text-2xl" aria-live="polite">
                  {rivalEmote}
                </p>
              ) : null}
              {match.current_dimension === 'espejo' ? (
                <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--color-primary)]">
                  Espejo activo: arrastra hacia un lado y la pieza va al contrario. Los peones van hacia
                  tu propio bando (pueden coronar en tu fila de inicio). Enroque corto ↔ largo.
                </p>
              ) : null}
              {(you as MatchPlayer & { giratiempo_active?: boolean })?.giratiempo_active ? (
                <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--color-primary)]">
                  Giratiempo: te queda un movimiento extra en este turno (máx. 1 captura; jaque corta el
                  doble turno).
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isFinished && !isWaitingRival ? (
                <>
                  {['👍', '😮', '🔥', '♟️'].map((emote) => (
                    <button
                      key={emote}
                      type="button"
                      className="btn-ghost !px-2 !py-1 text-base"
                      title="Emote Portal"
                      onClick={() => {
                        if (!user?.uid) return
                        void publishEmoteRef.current?.({ matchId: id, uid: user.uid, emote })
                      }}
                    >
                      {emote}
                    </button>
                  ))}
                  <button type="button" onClick={() => void resign()} className="btn-ghost">
                    Rendirse
                  </button>
                </>
              ) : isFinished ? (
                <button type="button" onClick={() => navigate('/')} className="btn-primary">
                  Salir
                </button>
              ) : (
                <button type="button" onClick={() => navigate('/')} className="btn-ghost">
                  Cancelar reto
                </button>
              )}
            </div>
          </div>

          <div className="mb-3 flex justify-between font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <span className={clocks.runningFor === 'black' ? 'text-[var(--color-primary)]' : ''}>
              Negras · {black?.display_name ?? '…'} ·{' '}
              <span className="tabular-nums">{formatMs(clocks.blackMs)}</span>
              {clocks.runningFor === 'black' ? ' · ●' : ''}
            </span>
            <span className={match.turn_color === 'black' ? 'text-[var(--color-primary)]' : ''}>
              {match.turn_color === 'black' ? 'Su turno' : !clocks.runningFor && match.status === 'active' ? 'Reloj en pausa' : ''}
            </span>
          </div>

          <div className={`mx-auto max-w-[min(100%,520px)] ${isShop || (isShopWaiting && !shopPeek) ? 'opacity-40 blur-[2px]' : ''}`}>
            {aim ? (
              <JokerTargetBanner
                open
                jokerName={aim.jokerName}
                mode={aim.mode}
                selected={aim.squares}
                onCancel={() => setAim(null)}
              />
            ) : null}
            <Chessboard
              options={{
                id: `board-${match.id}`,
                position: displayFen,
                boardOrientation: you?.color === 'black' ? 'black' : 'white',
                allowDragging:
                  yourTurn && !busy && !inShopPhase && !isFinished && !optimisticFen && !aim,
                animationDurationInMs: 280,
                squareStyles: dragSquareStyles,
                onSquareClick: ({ square }) => {
                  if (aim) onAimSquare(square)
                },
                onPieceDrag: ({ piece, square }) => {
                  if (aim || !square) return
                  startLocalDrag(square, piece.pieceType)
                },
                onMouseOverSquare: ({ square }) => {
                  if (localDrag.current) hoverLocalDrag(square)
                },
                onPieceDragCancel: () => {
                  endLocalDrag()
                },
                onPieceDrop: ({ sourceSquare, targetSquare }) => {
                  if (aim) return false
                  return onPieceDrop({ sourceSquare, targetSquare })
                },
                boardStyle: {
                  borderRadius: '4px',
                  boxShadow: '0 12px 40px rgba(115,92,0,0.08)',
                  cursor: aim ? 'crosshair' : undefined,
                },
                lightSquareStyle: { backgroundColor: '#f5f4ef' },
                darkSquareStyle: { backgroundColor: '#d0c5af' },
              }}
            />
            {remoteDrag?.active ? (
              <p className="mt-2 text-center font-label text-[10px] uppercase tracking-wider text-[var(--color-primary)]">
                Rival moviendo…
              </p>
            ) : null}
            {blockedSquares.size > 0 ? (
              <p className="mt-2 text-center text-[11px] text-[var(--color-ink-muted)]">
                Casillas en rojo/oscuro: quemadas o en ruina — no aterrizar ni atravesarlas (el caballo sí salta).
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex justify-between font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
            <span className={clocks.runningFor === 'white' ? 'text-[var(--color-primary)]' : ''}>
              Blancas · {white?.display_name ?? '…'} ·{' '}
              <span className="tabular-nums">{formatMs(clocks.whiteMs)}</span>
              {clocks.runningFor === 'white' ? ' · ●' : ''}
            </span>
            <span className={yourTurn ? 'text-[var(--color-primary)]' : ''}>
              {yourTurn ? 'Tu turno' : match.turn_color === 'white' ? 'Turno blancas' : ''}
              {!clocks.runningFor && match.status === 'active' && yourTurn ? ' · reloj espera 1ª jugada' : ''}
            </span>
          </div>

          {error && !isShop ? <p className="mt-3 text-sm text-[var(--color-error)]">{error}</p> : null}
        </section>

        <aside className="flex flex-col gap-6">
          <div className="panel p-4">
            <h2 className="font-label text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              Inventario
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {yourInv.map((item) =>
                item.joker ? (
                  <JokerCard
                    key={item.id}
                    joker={item.joker as Joker}
                    size={112}
                    disabled={busy || isFinished || inShopPhase}
                    selected={aim?.inventoryId === item.id}
                    onClick={() => {
                      if (inShopPhase) return
                      if (aim?.inventoryId === item.id) {
                        setAim(null)
                        return
                      }
                      beginJokerUse(item.id, item.joker as Joker)
                    }}
                  />
                ) : null,
              )}
              {yourInv.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-muted)]">Vacío (máx 3)</p>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
              {inShopPhase
                ? isShopWaiting
                  ? 'Esperando al rival — puedes mirar el tablero'
                  : 'Negocia en el mercado'
                : aim
                  ? 'Click en el tablero para apuntar · Esc cancela'
                  : 'Click = usar comodín (algunos piden casilla)'}
            </p>
          </div>

          {!inShopPhase ? (
            <div className="panel p-4 text-sm text-[var(--color-ink-muted)]">
              Tras {match.moves_per_phase} movimientos se abre el mercado. Ahora: {match.moves_in_phase}.
            </div>
          ) : (
            <div className="panel p-4 text-sm text-[var(--color-primary)]">
              {isShopWaiting
                ? `Esperando rival · ${Math.ceil(shopLeftMs / 1000)}s`
                : `Mercado abierto · ${Math.ceil(shopLeftMs / 1000)}s`}
            </div>
          )}

          <Link to="/" className="font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            ← Lobby
          </Link>
        </aside>
      </div>
    </PageTransition>
  )
}
