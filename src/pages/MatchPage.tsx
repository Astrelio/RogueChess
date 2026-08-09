import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { fenWithDragPreview } from '@/lib/dragPreview'
import { mirrorCommand, applyMirrorPawnFen } from '@/lib/mirrorMove'
import { applyGhostMoveFen } from '@/lib/ghostMove'
import {
  buildJokerPayload,
  getJokerTargetMode,
  needsBoardTarget,
  type JokerTargetMode,
} from '@/lib/jokerTargets'
import { JokerCard } from '@/components/jokers/JokerCard'
import { JokerTargetBanner } from '@/components/match/JokerTargetBanner'
import { DimensionEnv } from '@/components/match/DimensionEnv'
import { DimensionReveal } from '@/components/match/DimensionReveal'
import { MatchMascotCoach } from '@/components/match/MatchMascotCoach'
import { TutorialCoach } from '@/components/onboarding/TutorialCoach'
import { JokerClockFx, type ClockFxEvent } from '@/components/match/JokerClockFx'
import { JokerFxOverlay } from '@/components/match/JokerFxOverlay'
import { MatchToast } from '@/components/match/MatchToast'
import { MatchPortalBridge, type MatchPortalPeerInfo } from '@/components/match/MatchPortalBridge'
import { ShopIntroOverlay } from '@/components/match/ShopIntroOverlay'
import { ShopPhaseModal, ShopWaitOverlay } from '@/components/match/ShopPhaseModal'
import { SpectatorReactionColumns, type ReactionEvent } from '@/components/match/SpectatorReactions'
import { PixelEmoji } from '@/components/PixelEmoji'
import { VictoryOverlay } from '@/components/match/VictoryOverlay'
import { PageTransition } from '@/components/PageTransition'
import { MONOLITH_HOURGLASS_BG, RUINED_DEBRIS_BG } from '@/lib/boardDecor'
import { piecesForDimension } from '@/lib/dimPieces'
import {
  portalReady,
  type MatchArrowsPayload,
  type MatchBoardSnapshot,
  type MatchEmotePayload,
  type MatchJokerAimPayload,
  type MatchJokerFxPayload,
  type PieceDragPayload,
  type ShopReadyPayload,
  type SpectatorEmojiPayload,
} from '@/lib/portal'

type BoardArrow = { startSquare: string; endSquare: string; color: string }
import { previewAparicionFen, previewMorsmordreFen, previewMultijugosFen, previewRemovePieceFen } from '@/lib/jokerOptimistic'
import { fenHideEnemyInvisible } from '@/lib/invisibleFen'
import {
  indicatorStyle,
  jokerTargetSquares,
  legalInteractionSquares,
  ownInvisibleSquares,
} from '@/lib/boardIndicators'
import { getDimension, isDarkDimension } from '@/lib/dimensions'
import {
  getJokerCastSquares,
  getJokerFxSpec,
  type JokerFxKind,
} from '@/lib/jokerFx'
import {
  fenPieceCount,
  playLoseSound,
  playMatchEndNeutralSound,
  playMoveSound,
  playPhaseSound,
  playShopPhaseSound,
  playResignSound,
  playSelectSound,
  playWinSound,
} from '@/lib/sounds'
import { easeOut } from '@/lib/motion'
import { isPhaseTransition, isStaleBoardPulse, isStaleMatchState, matchProgress } from '@/lib/matchFreshness'
import { useLiveClocks } from '@/hooks/useLiveClocks'
import { useLobbyPresence } from '@/hooks/useLobbyPresence'
import type { MatchState, Joker, MatchPlayer, PieceFlag } from '@/types/match'

/** Paleta fija de reacciones de espectador (videojuego + temática ajedrez). */
const SPECTATOR_REACTIONS = ['☠️', '😁', '😂', '😯', '🙌', '🎉', '🎊', '♟️']

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

export function MatchPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const cheerUsername = (searchParams.get('cheer') || '').toLowerCase()
  const isTutorial = searchParams.get('tutorial') === '1'
  const [tutorialDone, setTutorialDone] = useState(false)
  const invitedUsername =
    typeof (location.state as { invitedUsername?: string } | null)?.invitedUsername === 'string'
      ? (location.state as { invitedUsername: string }).invitedUsername
      : null
  const { user, profile, ready, getToken } = useAuth()
  const lobby = useLobbyPresence()
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
  const publishJokerFxRef = useRef<
    | ((payload: {
        matchId: string
        uid: string
        code: string
        squares: string[]
        fen?: string
      }) => Promise<void>)
    | null
  >(null)
  const publishJokerAimRef = useRef<
    | ((payload: {
        matchId: string
        uid: string
        active: boolean
        code?: string
        squares?: string[]
        selected?: string[]
      }) => Promise<void>)
    | null
  >(null)
  const publishArrowsRef = useRef<
    | ((payload: {
        matchId: string
        uid: string
        arrows: BoardArrow[]
      }) => Promise<void>)
    | null
  >(null)
  const publishSpectatorEmojiRef = useRef<
    | ((payload: {
        matchId: string
        uid: string
        username?: string
        emoji: string
        targetColor: 'white' | 'black'
        emojiId?: string
      }) => Promise<void>)
    | null
  >(null)
  const sendActivityRef = useRef<((kind: string) => void) | null>(null)
  const localDrag = useRef<{ from: string; piece: string } | null>(null)
  const [remoteDrag, setRemoteDrag] = useState<PieceDragPayload | null>(null)
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null)
  const [aim, setAim] = useState<JokerAim | null>(null)
  /** Aim remoto (espectadores): mismas partículas/tema que el caster. */
  const [remoteAim, setRemoteAim] = useState<{
    uid: string
    squares: string[]
    theme: ReturnType<typeof getJokerFxSpec>['theme']
    code: string
    selected: string[]
  } | null>(null)
  /** Flechas de análisis por jugador → solo espectadores las ven. */
  const arrowsByUid = useRef(new Map<string, BoardArrow[]>())
  const [spectatorArrows, setSpectatorArrows] = useState<BoardArrow[]>([])
  const lastPublishedArrowsKey = useRef('')
  /** Evita doble SFX (local + pulse/apply del mismo movimiento). */
  const skipMoveSfxRef = useRef(false)
  const heardFenRef = useRef<string | null>(null)
  const matchEndSfxKey = useRef<string | null>(null)
  /** Pieza seleccionada para click-to-move + indicadores de destinos. */
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [justBoughtOfferId, setJustBoughtOfferId] = useState<string | null>(null)
  const [justBoughtInventoryId, setJustBoughtInventoryId] = useState<string | null>(null)
  const [shopPeek, setShopPeek] = useState(false)
  const [peerInfo, setPeerInfo] = useState<MatchPortalPeerInfo | null>(null)
  const [rivalEmote, setRivalEmote] = useState<string | null>(null)
  const emoteTimer = useRef<number | null>(null)
  /** Reacciones de espectador (feed corto autoexpirable). */
  const [spectatorEmojis, setSpectatorEmojis] = useState<ReactionEvent[]>([])
  const spectatorEmojiKey = useRef(0)
  const spectatorJoinTried = useRef(false)
  const [emojiCooldownLeft, setEmojiCooldownLeft] = useState(0)
  const emojiCooldownUntil = useRef(0)
  const [codeCopied, setCodeCopied] = useState(false)
  const [boardFx, setBoardFx] = useState<{
    squares: string[]
    kind: JokerFxKind
    durationMs: number
  } | null>(null)
  const boardFxTimer = useRef<number | null>(null)
  const [jokerBurst, setJokerBurst] = useState<{
    squares: string[]
    code: string
    at: number
  } | null>(null)
  const burstTimer = useRef<number | null>(null)
  const [clockFx, setClockFx] = useState<ClockFxEvent | null>(null)
  const clockFxTimer = useRef<number | null>(null)
  const [vanishingInvId, setVanishingInvId] = useState<string | null>(null)
  const [shopIntroDone, setShopIntroDone] = useState(false)
  const shopIntroCycleRef = useRef<number | null>(null)
  const [revealDimension, setRevealDimension] = useState<string | null>(null)
  const dimensionRef = useRef<string | null>(null)
  const revealCycleRef = useRef<number | null>(null)
  /** Intro Primo ya vista u omitida (rejoin a mitad de partida). */
  const [primoIntroDone, setPrimoIntroDone] = useState(false)
  /** Tablero solo tras cerrar el reveal a pantalla completa. */
  const [boardVisible, setBoardVisible] = useState(false)

  const playJokerFx = useCallback((code: string, castSquares: string[]) => {
    const spec = getJokerFxSpec(code)

    const clearBoard = () => {
      if (boardFxTimer.current != null) window.clearTimeout(boardFxTimer.current)
      boardFxTimer.current = null
      setBoardFx(null)
    }
    const clearBurst = () => {
      if (burstTimer.current != null) window.clearTimeout(burstTimer.current)
      burstTimer.current = null
      setJokerBurst(null)
    }
    const clearClock = () => {
      if (clockFxTimer.current != null) window.clearTimeout(clockFxTimer.current)
      clockFxTimer.current = null
      setClockFx(null)
    }

    if (
      spec.stage === 'clockSteal' ||
      spec.stage === 'clockFreeze' ||
      spec.stage === 'clockHaste'
    ) {
      clearClock()
      setClockFx({ code, at: Date.now(), youSide: 'bottom' })
      clockFxTimer.current = window.setTimeout(clearClock, spec.durationMs + 200)
      return
    }

    if (spec.stage === 'boardCenter' || spec.stage === 'shield') {
      clearBurst()
      setJokerBurst({ squares: [], code, at: Date.now() })
      burstTimer.current = window.setTimeout(clearBurst, spec.durationMs + 120)
      return
    }

    clearBoard()
    clearBurst()
    const squares = castSquares.length ? castSquares : []
    if (squares.length) {
      setBoardFx({ squares, kind: spec.kind, durationMs: Math.min(spec.durationMs, 480) })
      boardFxTimer.current = window.setTimeout(clearBoard, Math.min(spec.durationMs, 480) + 40)
    }
    setJokerBurst({ squares, code, at: Date.now() })
    burstTimer.current = window.setTimeout(clearBurst, spec.durationMs + 80)
  }, [])

  const clearJokerFx = useCallback(() => {
    if (boardFxTimer.current != null) window.clearTimeout(boardFxTimer.current)
    if (burstTimer.current != null) window.clearTimeout(burstTimer.current)
    if (clockFxTimer.current != null) window.clearTimeout(clockFxTimer.current)
    boardFxTimer.current = null
    burstTimer.current = null
    clockFxTimer.current = null
    setBoardFx(null)
    setJokerBurst(null)
    setClockFx(null)
    setVanishingInvId(null)
  }, [])

  const finishShopIntro = useCallback(() => {
    setShopIntroDone(true)
  }, [])

  const dismissDimensionReveal = useCallback(() => {
    setPrimoIntroDone(true)
    setRevealDimension(null)
  }, [])

  const onRevealExitComplete = useCallback(() => {
    setBoardVisible(true)
  }, [])

  // Errores / ilegales: toast corto y auto-dismiss
  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(() => setError(null), 2800)
    return () => window.clearTimeout(t)
  }, [error])

  /** Watermarks anti-eco / anti-carrera Portal + REST. */
  const lastBoardAtRef = useRef(0)
  const lastClockAtRef = useRef(0)
  const lastDragAtRef = useRef(0)
  const stateRef = useRef<MatchState | null>(null)
  const fetchGenRef = useRef(0)

  const applyState = useCallback(
    (s: MatchState, opts?: { publish?: boolean; resetClock?: boolean; reason?: string }) => {
      // No aplicar REST viejo (poll/dirty atrasado) encima de un estado más nuevo
      if (isStaleMatchState(s, stateRef.current)) return
      const prev = stateRef.current
      stateRef.current = s
      // No pisar lastBoardAt con Date.now(): bloquearía pulsos Portal legítimos
      setState(s)
      // Conservar preview local hasta que el server alcance el FEN (anti snap-back)
      setOptimisticFen((opt) => {
        if (!opt) return null
        if (s.match.fen === opt) return null
        if (prev && matchProgress(s.match) > matchProgress(prev.match)) return null
        if (prev && s.match.fen === prev.match.fen) return opt
        return null
      })
      setRemoteDrag(null)
      if (s.match.status !== 'shop' && s.match.phase !== 'shop') {
        setShopPeek(false)
      }
      if (opts?.resetClock) turnStarted.current = Date.now()
      if (opts?.publish !== false) void publishRef.current?.(s, opts?.reason)
    },
    [],
  )

  /** Dispara una reacción local (el que envía la ve al instante, sin esperar eco Portal). */
  const triggerEmojiBurst = useCallback(
    (emoji: string, opts?: { username?: string; targetColor?: 'white' | 'black' }) => {
      const key = ++spectatorEmojiKey.current
      const targetColor = opts?.targetColor ?? 'white'
      setSpectatorEmojis((prev) => [
        ...prev.slice(-7),
        { key, emoji, username: opts?.username, targetColor },
      ])
      window.setTimeout(() => {
        setSpectatorEmojis((prev) => prev.filter((e) => e.key !== key))
      }, 3600)
    },
    [],
  )

  /**
   * Reacciones: Portal ephemeral (rápido) + Neon recent_emojis vía dirty/poll.
   * Dedupe por id; las propias ya se mostraron local-first.
   */
  const seenEmojiIds = useRef<Set<string>>(new Set())
  const emojiFeedPrimed = useRef(false)

  useEffect(() => {
    seenEmojiIds.current.clear()
    emojiFeedPrimed.current = false
  }, [id])

  const ingestEmojiFeed = useCallback(
    (feed: MatchState['recent_emojis'] | undefined) => {
      if (!feed) return
      if (!emojiFeedPrimed.current) {
        emojiFeedPrimed.current = true
        for (const e of feed) seenEmojiIds.current.add(e.id)
        return
      }
      for (const e of feed) {
        if (seenEmojiIds.current.has(e.id)) continue
        seenEmojiIds.current.add(e.id)
        if (user?.uid && e.from_uid === user.uid) continue
        triggerEmojiBurst(e.emoji, {
          username: e.username,
          targetColor: e.target_color === 'black' ? 'black' : 'white',
        })
      }
    },
    [user?.uid, triggerEmojiBurst],
  )

  const load = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    const gen = ++fetchGenRef.current
    const { state: s } = await api.getMatch(token, id)
    // Respuesta fuera de orden (poll lento / dirty duplicado)
    if (gen !== fetchGenRef.current) return
    const next = s as MatchState
    ingestEmojiFeed(next.recent_emojis)
    applyState(next, { publish: false, resetClock: true })
  }, [getToken, id, applyState, ingestEmojiFeed])

  const lastSyncAt = useRef(0)
  const syncFromServer = useCallback((opts?: { force?: boolean }) => {
    const now = Date.now()
    // Tras tienda→grieta hay que forzar: el throttle de 200ms puede botar el refetch
    // que trae current_dimension y dejar la dim anterior hasta el poll largo.
    if (!opts?.force && now - lastSyncAt.current < 200) return
    lastSyncAt.current = now
    setRemoteDrag(null)
    void load().catch(() => undefined)
  }, [load])

  const onDirty = useCallback(
    (reason: string) => {
      const force =
        /shop|close|dimension|reveal|timeout/i.test(reason)
      syncFromServer({ force })
    },
    [syncFromServer],
  )

  const onChannelReady = useCallback(() => {
    syncFromServer()
  }, [syncFromServer])

  const onBoardPulse = useCallback(
    (board: MatchBoardSnapshot) => {
      const current = stateRef.current
      if (isStaleBoardPulse(board, current, lastBoardAtRef.current)) return

      if (board.preview && board.fen) {
        setOptimisticFen(board.fen)
        return
      }

      if (typeof board.at === 'number' && board.at > 0) {
        if (board.fen || board.status === 'finished' || board.status === 'shop' || board.status === 'active') {
          lastBoardAtRef.current = Math.max(lastBoardAtRef.current, board.at)
        } else {
          if (board.at < lastClockAtRef.current) return
          lastClockAtRef.current = board.at
        }
      }

      const phaseChanging = isPhaseTransition(current?.match, {
        status: board.status || current?.match.status || '',
        phase: board.phase || current?.match.phase,
        cycle_index: board.cycle_index || current?.match.cycle_index || 0,
      })

      setRemoteDrag(null)
      if (board.status === 'finished' || phaseChanging) {
        setOptimisticFen(null)
      } else if (board.fen) {
        setOptimisticFen((opt) => {
          if (!opt) return null
          if (board.fen === opt) return null
          if (current && board.fen === current.match.fen) return opt
          return null
        })
      }

      setState((prev) => {
        if (!prev) return prev
        if (isStaleBoardPulse(board, prev, 0)) return prev

        if (board.status === 'finished') {
          const next: MatchState = {
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
          stateRef.current = next
          return next
        }

        if (phaseChanging || board.status === 'shop' || board.status === 'active') {
          const nextRunning =
            board.clock_running_for !== undefined
              ? board.clock_running_for
              : phaseChanging
                ? null
                : prev.match.clock_running_for

          const next: MatchState = {
            ...prev,
            match: {
              ...prev.match,
              ...(board.fen ? { fen: board.fen } : {}),
              ...(board.current_dimension
                ? { current_dimension: board.current_dimension }
                : {}),
              cycle_index: board.cycle_index || prev.match.cycle_index,
              moves_in_phase:
                board.moves_in_phase !== undefined && board.moves_in_phase !== null
                  ? board.moves_in_phase
                  : prev.match.moves_in_phase,
              status: (board.status || prev.match.status) as MatchState['match']['status'],
              phase: (board.phase || prev.match.phase) as MatchState['match']['phase'],
              white_time_ms: board.white_time_ms || prev.match.white_time_ms,
              black_time_ms: board.black_time_ms || prev.match.black_time_ms,
              turn_color: (board.turn_color || prev.match.turn_color) as MatchState['match']['turn_color'],
              clock_running_for: nextRunning,
              clock_updated_at: new Date(board.at || Date.now()).toISOString(),
            },
            ...(board.status === 'active' && prev.match.status === 'shop' ? { shop: [] } : {}),
            ...(board.status === 'shop' && prev.match.status !== 'shop'
              ? {
                  players: prev.players.map((pl) =>
                    pl.is_bot ? pl : { ...pl, shop_ready: pl.id === prev.you?.id ? pl.shop_ready : false },
                  ),
                }
              : {}),
          }
          stateRef.current = next
          return next
        }

        if (!board.fen) {
          const next: MatchState = {
            ...prev,
            match: {
              ...prev.match,
              ...(board.current_dimension
                ? { current_dimension: board.current_dimension }
                : {}),
              white_time_ms: board.white_time_ms,
              black_time_ms: board.black_time_ms,
              turn_color: board.turn_color as MatchState['match']['turn_color'],
              clock_running_for:
                board.clock_running_for !== undefined
                  ? board.clock_running_for
                  : prev.match.clock_running_for,
              clock_updated_at: new Date(board.at || Date.now()).toISOString(),
            },
          }
          stateRef.current = next
          return next
        }

        const nextRunning =
          board.clock_running_for !== undefined
            ? board.clock_running_for
            : prev.match.clock_running_for

        const next: MatchState = {
          ...prev,
          match: {
            ...prev.match,
            fen: board.fen,
            ...(board.current_dimension
              ? { current_dimension: board.current_dimension }
              : {}),
            cycle_index: board.cycle_index || prev.match.cycle_index,
            moves_in_phase: board.moves_in_phase || prev.match.moves_in_phase,
            status: (board.status || prev.match.status) as MatchState['match']['status'],
            phase: (board.phase || prev.match.phase) as MatchState['match']['phase'],
            white_time_ms: board.white_time_ms,
            black_time_ms: board.black_time_ms,
            turn_color: board.turn_color as MatchState['match']['turn_color'],
            clock_running_for: nextRunning,
            clock_updated_at: new Date(board.at || Date.now()).toISOString(),
          },
        }
        stateRef.current = next
        return next
      })

      // Portal anuncia la fase; Neon completa shop/inventory/dimensión
      if (board.status === 'finished' || phaseChanging) {
        syncFromServer({ force: true })
        return
      }
      if (board.fen) turnStarted.current = Date.now()
    },
    [syncFromServer],
  )

  const onRemotePieceDrag = useCallback(
    (drag: PieceDragPayload) => {
      if (user?.uid && drag.uid && drag.uid === user.uid) return
      if (typeof drag.at === 'number' && drag.at > 0 && drag.at < lastDragAtRef.current) return
      if (typeof drag.at === 'number' && drag.at > 0) {
        lastDragAtRef.current = drag.at
      }
      if (!drag.active) {
        setRemoteDrag(null)
        return
      }
      setRemoteDrag(drag)
    },
    [user?.uid],
  )

  const onShopReadyPulse = useCallback(
    (p: ShopReadyPayload) => {
      if (user?.uid && p.uid === user.uid) return
      setState((prev) => {
        if (!prev) return prev
        // Ciclo viejo de tienda → ignorar
        if (prev.match.cycle_index !== p.cycle_index) return prev
        if (prev.match.status !== 'shop' && prev.match.phase !== 'shop') return prev
        const next: MatchState = {
          ...prev,
          players: prev.players.map((pl) =>
            pl.color === p.color ? { ...pl, shop_ready: true } : pl,
          ),
        }
        stateRef.current = next
        return next
      })
    },
    [user?.uid],
  )

  const onEmotePulse = useCallback((p: MatchEmotePayload) => {
    if (user?.uid && p.uid === user.uid) return
    if (emoteTimer.current != null) window.clearTimeout(emoteTimer.current)
    setRivalEmote(p.emote)
    emoteTimer.current = window.setTimeout(() => {
      setRivalEmote(null)
      emoteTimer.current = null
    }, 2200)
  }, [user?.uid])

  const onJokerFxPulse = useCallback(
    (p: MatchJokerFxPayload) => {
      if (user?.uid && p.uid === user.uid) return
      setRemoteAim(null)
      if (p.fen) {
        setOptimisticFen(p.fen)
        setState((prev) => {
          if (!prev) return prev
          const next = { ...prev, match: { ...prev.match, fen: p.fen! } }
          stateRef.current = next
          return next
        })
      }
      playJokerFx(p.code, p.squares ?? [])
    },
    [user?.uid, playJokerFx],
  )

  const onJokerAimPulse = useCallback(
    (p: MatchJokerAimPayload) => {
      if (user?.uid && p.uid === user.uid) return
      // Solo espectadores: el rival no ve el apuntado del oponente
      const spectator = Boolean(stateRef.current && !stateRef.current.you)
      if (!spectator) return
      if (!p.active || !p.code) {
        setRemoteAim((prev) => (prev && prev.uid === p.uid ? null : prev))
        return
      }
      const spec = getJokerFxSpec(p.code)
      setRemoteAim({
        uid: p.uid,
        squares: p.squares ?? [],
        theme: spec.theme,
        code: p.code,
        selected: p.selected ?? [],
      })
    },
    [user?.uid],
  )

  const onArrowsPulse = useCallback(
    (p: MatchArrowsPayload) => {
      if (user?.uid && p.uid === user.uid) return
      const spectator = Boolean(stateRef.current && !stateRef.current.you)
      if (!spectator) return
      arrowsByUid.current.set(p.uid, p.arrows ?? [])
      setSpectatorArrows([...arrowsByUid.current.values()].flat())
    },
    [user?.uid],
  )

  /** Shatter FX cuando una reina Multijugos desaparece del tablero. */
  const mjSquaresRef = useRef<string[]>([])
  useEffect(() => {
    const next = (state?.flags || [])
      .filter((f) => f.multijugos_queen && f.square)
      .map((f) => f.square as string)
    const lost = mjSquaresRef.current.filter((sq) => !next.includes(sq))
    if (lost.length) playJokerFx('pocion_multijugos', lost)
    mjSquaresRef.current = next
  }, [state?.flags, playJokerFx])

  const onPeerInfo = useCallback((info: MatchPortalPeerInfo) => {
    setPeerInfo(info)
  }, [])

  /** Vía rápida: emoji entrante por Portal. */
  const onSpectatorEmojiPulse = useCallback(
    (p: SpectatorEmojiPayload) => {
      if (p.emojiId) {
        if (seenEmojiIds.current.has(p.emojiId)) return
        seenEmojiIds.current.add(p.emojiId)
      }
      if (user?.uid && p.uid === user.uid) return
      triggerEmojiBurst(p.emoji, {
        username: p.username,
        targetColor: p.targetColor === 'black' ? 'black' : 'white',
      })
    },
    [user?.uid, triggerEmojiBurst],
  )

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

  // Nueva partida (rematch / deep link): resetear reveal
  useEffect(() => {
    dimensionRef.current = null
    revealCycleRef.current = null
    setPrimoIntroDone(false)
    setBoardVisible(false)
    setRevealDimension(null)
  }, [id])

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
  /** Sin asiento en la partida → modo espectador (solo lectura). */
  const isSpectator = Boolean(state && !state.you)

  // SFX de piezas: propia (skip) + rival / espectador vía FEN
  useEffect(() => {
    const fen = match?.fen
    if (!fen) return
    const prev = heardFenRef.current
    heardFenRef.current = fen
    if (!prev || prev === fen) return
    if (skipMoveSfxRef.current) {
      skipMoveSfxRef.current = false
      return
    }
    const prevBoard = prev.split(' ')[0]
    const nextBoard = fen.split(' ')[0]
    if (prevBoard === nextBoard) return
    playMoveSound({ capture: fenPieceCount(fen) < fenPieceCount(prev) })
  }, [match?.fen])

  /** Color del jugador al que anima el espectador (?cheer=username). */
  const cheerTargetColor = useMemo((): 'white' | 'black' => {
    if (!state?.players?.length) return 'white'
    if (cheerUsername) {
      const hit = state.players.find(
        (p) => (p.username || '').toLowerCase() === cheerUsername,
      )
      if (hit?.color === 'black' || hit?.color === 'white') return hit.color
    }
    return 'white'
  }, [state?.players, cheerUsername])

  const boardOrientation: 'white' | 'black' = you?.color === 'black'
    ? 'black'
    : isSpectator
      ? cheerTargetColor
      : 'white'

  // Ranking en vivo: marcar playing en metadata del lobby
  useEffect(() => {
    if (!ready || !user || !match || isSpectator) return
    if (match.status === 'finished' || match.status === 'waiting') {
      lobby.setPlaying(false)
      return
    }
    lobby.setPlaying(true)
    return () => {
      lobby.setPlaying(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, match?.status, match?.id, isSpectator])

  const inShopPhase = Boolean(match && (match.status === 'shop' || match.phase === 'shop'))
  const youShopReady = Boolean(you?.shop_ready)
  const isShop = inShopPhase && !youShopReady && !isSpectator
  const isShopWaiting = inShopPhase && youShopReady
  const isWaitingRival = match?.status === 'waiting'
  const isFinished = match?.status === 'finished'
  const yourTurn = Boolean(you && match && match.status === 'active' && match.turn_color === you.color)

  // Intro “Elige tus comodines” al abrir cada ciclo de mercado
  useEffect(() => {
    if (!inShopPhase || isFinished) {
      setShopIntroDone(false)
      shopIntroCycleRef.current = null
      return
    }
    const cycle = match?.cycle_index ?? 0
    if (shopIntroCycleRef.current !== cycle) {
      shopIntroCycleRef.current = cycle
      setShopIntroDone(false)
    }
  }, [inShopPhase, isFinished, match?.cycle_index])

  const showShopIntro = isShop && !isFinished && !shopIntroDone
  const showShopModal = isShop && !isFinished && shopIntroDone
  const dimMeta = getDimension(match?.current_dimension)
  const darkDim = isDarkDimension(dimMeta.id)
  const dimPieces = useMemo(() => piecesForDimension(darkDim), [darkDim])
  const openingPrimo =
    Boolean(match) &&
    !primoIntroDone &&
    !isFinished &&
    match!.status === 'active' &&
    match!.phase === 'primo' &&
    match!.current_dimension === 'primo' &&
    match!.cycle_index === 0 &&
    (match!.moves_in_phase ?? 0) === 0

  /** Reveal síncrono en el 1er paint (Primo) o el que dispara el efecto (otras dims). */
  const activeReveal = revealDimension ?? (openingPrimo ? 'primo' : null)
  const showMatchBoard = boardVisible && !activeReveal

  // Samples Kenney: cambio de fase / tienda / fin de partida
  useEffect(() => {
    if (revealDimension) playPhaseSound()
  }, [revealDimension])

  useEffect(() => {
    if (openingPrimo) playShopPhaseSound()
  }, [openingPrimo])

  useEffect(() => {
    if (showShopIntro) playShopPhaseSound()
  }, [showShopIntro])

  useEffect(() => {
    if (!isFinished || !match) return
    const key = `${match.id}:${match.result ?? ''}:${match.winner_id ?? ''}`
    if (matchEndSfxKey.current === key) return
    matchEndSfxKey.current = key
    if (isSpectator || match.result === 'draw' || match.result === 'abort') {
      playMatchEndNeutralSound()
      return
    }
    const won = Boolean(you?.profile_id && match.winner_id && match.winner_id === you.profile_id)
    if (won) playWinSound()
    else playLoseSound()
  }, [isFinished, isSpectator, match, you?.profile_id])

  // Reveal: Primo al inicio (derivado); luego al cambiar dimensión / ciclo grieta
  useEffect(() => {
    if (!match) return
    if (isFinished) {
      setBoardVisible(true)
      return
    }
    const dim = match.current_dimension
    const cycle = match.cycle_index
    if (!dim) return

    const isOpeningPrimo =
      match.status === 'active' &&
      match.phase === 'primo' &&
      dim === 'primo' &&
      cycle === 0 &&
      (match.moves_in_phase ?? 0) === 0

    if (isOpeningPrimo && !primoIntroDone) {
      dimensionRef.current = dim
      revealCycleRef.current = cycle
      setBoardVisible(false)
      return
    }

    if (dimensionRef.current === null) {
      dimensionRef.current = dim
      revealCycleRef.current = cycle
      // Join a mitad / sin intro Primo: tablero ya
      if (!primoIntroDone) setPrimoIntroDone(true)
      setBoardVisible(true)
      return
    }

    const dimChanged = dimensionRef.current !== dim
    const cycleAdvanced =
      revealCycleRef.current != null &&
      cycle > revealCycleRef.current &&
      match.status === 'active' &&
      match.phase === 'grieta'

    if (!dimChanged && !cycleAdvanced) {
      if (cycle !== revealCycleRef.current) revealCycleRef.current = cycle
      return
    }

    dimensionRef.current = dim
    revealCycleRef.current = cycle
    setBoardVisible(false)
    setRevealDimension(dim)
  }, [
    match?.current_dimension,
    match?.cycle_index,
    match?.moves_in_phase,
    match?.status,
    match?.phase,
    isFinished,
    match,
    primoIntroDone,
  ])

  useEffect(() => {
    if (!activeReveal) return
    const t = window.setTimeout(() => dismissDimensionReveal(), 3400)
    return () => window.clearTimeout(t)
  }, [activeReveal, dismissDimensionReveal])

  const clocks = useLiveClocks(match, state?.players)
  const timeoutClaimed = useRef(false)
  const shopTimeoutClaimed = useRef(false)

  // Auto-registro como espectador en Neon (idempotente). Cubre link directo y refresh.
  useEffect(() => {
    if (!isSpectator || !id || isFinished || isWaitingRival || spectatorJoinTried.current) return
    if (match?.allow_spectators === false) return
    spectatorJoinTried.current = true
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const { state: s } = await api.spectateMatch(token, id)
        applyState(s as MatchState, { publish: false })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo espectar')
      }
    })()
  }, [isSpectator, id, isFinished, isWaitingRival, match?.allow_spectators, getToken, applyState])

  // Cooldown UX del emoji de espectador (el real lo valida Neon: 8s)
  useEffect(() => {
    if (emojiCooldownLeft <= 0) return
    const t = window.setInterval(() => {
      setEmojiCooldownLeft(Math.max(0, emojiCooldownUntil.current - Date.now()))
    }, 250)
    return () => window.clearInterval(t)
  }, [emojiCooldownLeft])

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
  // (solo jugadores; el espectador no tiene asiento para declarar timeout)
  useEffect(() => {
    if (!match || !id || isFinished || match.status !== 'active' || isSpectator) {
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

  // Minuto de tienda agotado → forzar cierre en Neon (lo declaran los jugadores)
  useEffect(() => {
    if (!inShopPhase || !id || isFinished || isSpectator) {
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

  const blockedSquares = useMemo(() => {
    const set = new Set<string>()
    for (const c of state?.cells ?? []) {
      if (c.is_active === false) continue
      if (c.effect === 'burned' || c.effect === 'ruined') set.add(String(c.square).trim())
    }
    return set
  }, [state?.cells])

  const pathBlockedSquares = useMemo(() => {
    const set = new Set<string>()
    for (const c of state?.cells ?? []) {
      if (c.is_active === false) continue
      if (c.effect === 'ruined') set.add(String(c.square).trim())
    }
    return set
  }, [state?.cells])

  const ghostActive = useMemo(() => {
    return (state?.effects ?? []).some((e) => {
      const row = e as { kind?: string; is_active?: boolean; applied_by?: string }
      return (
        row.is_active !== false &&
        row.kind === 'ghost_step' &&
        row.applied_by === you?.id
      )
    })
  }, [state?.effects, you?.id])

  const moveHints = useMemo(() => {
    if (aim || !match || !you?.color) return { moves: [] as string[], captures: [] as string[] }
    const from = selectedSquare
    if (!from) return { moves: [] as string[], captures: [] as string[] }
    if (!yourTurn || busy || inShopPhase || isFinished || optimisticFen) {
      return { moves: [] as string[], captures: [] as string[] }
    }
    const youExt = you as MatchPlayer & {
      giratiempo_active?: boolean
      giratiempo_captures?: number
    }
    return legalInteractionSquares({
      fen: fenWithSideToMove(match.fen, match.turn_color),
      from,
      color: you.color,
      dimension: match.current_dimension,
      blocked: blockedSquares,
      pathBlocked: pathBlockedSquares,
      ghostActive,
      giratiempoBlockCaptures: Boolean(
        youExt.giratiempo_active && (youExt.giratiempo_captures ?? 0) >= 1,
      ),
    })
  }, [
    aim,
    match,
    you,
    selectedSquare,
    yourTurn,
    busy,
    inShopPhase,
    isFinished,
    optimisticFen,
    blockedSquares,
    pathBlockedSquares,
    ghostActive,
  ])

  const jokerHints = useMemo(() => {
    if (!aim || !match || !you?.color) {
      return { hostile: [] as string[], ally: [] as string[], empty: [] as string[] }
    }
    return jokerTargetSquares({
      code: aim.mode.code,
      fen: fenWithSideToMove(match.fen, match.turn_color),
      color: you.color,
      dimension: match.current_dimension,
      flags: state?.flags,
      cells: state?.cells,
      selected: aim.squares,
      slotIndex: aim.squares.length,
    })
  }, [aim, match, you?.color, state?.flags, state?.cells])

  const invisibleHints = useMemo(
    () => ownInvisibleSquares(state?.flags, you?.color),
    [state?.flags, you?.color],
  )

  const jokerAimAura = useMemo(() => {
    if (!aim) return null
    const squares = [
      ...new Set([...jokerHints.hostile, ...jokerHints.ally, ...jokerHints.empty]),
    ]
    if (!squares.length) return null
    const spec = getJokerFxSpec(aim.mode.code)
    return { squares, theme: spec.theme, code: aim.mode.code }
  }, [aim, jokerHints])

  /** Local (jugador) o remoto (espectador): mismo overlay de partículas por comodín. */
  const displayJokerAim = jokerAimAura ?? (isSpectator ? remoteAim : null)
  const hadPublishedAim = useRef(false)

  // Publicar aim → espectadores ven partículas / casillas en vivo
  useEffect(() => {
    if (isSpectator || !id || !user?.uid) return
    if (!aim) {
      if (!hadPublishedAim.current) return
      hadPublishedAim.current = false
      void publishJokerAimRef.current?.({
        matchId: id,
        uid: user.uid,
        active: false,
      })
      return
    }
    hadPublishedAim.current = true
    void publishJokerAimRef.current?.({
      matchId: id,
      uid: user.uid,
      active: true,
      code: aim.mode.code,
      squares: jokerAimAura?.squares ?? [],
      selected: aim.squares,
    })
  }, [aim, jokerAimAura, isSpectator, id, user?.uid])

  // Limpia flechas remotas al cambiar de partida
  useEffect(() => {
    arrowsByUid.current.clear()
    setSpectatorArrows([])
    setRemoteAim(null)
    lastPublishedArrowsKey.current = ''
    heardFenRef.current = null
    skipMoveSfxRef.current = false
    matchEndSfxKey.current = null
  }, [id])

  const publishLocalArrows = useCallback(
    (arrows: BoardArrow[]) => {
      if (isSpectator || !id || !user?.uid) return
      const key = arrows
        .map((a) => `${a.startSquare}>${a.endSquare}:${a.color}`)
        .join('|')
      if (key === lastPublishedArrowsKey.current) return
      lastPublishedArrowsKey.current = key
      void publishArrowsRef.current?.({
        matchId: id,
        uid: user.uid,
        arrows,
      })
    },
    [isSpectator, id, user?.uid],
  )

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
          backgroundColor: 'rgba(40, 36, 30, 0.55)',
          backgroundImage: RUINED_DEBRIS_BG,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 'inset 0 0 0 2px rgba(30, 26, 22, 0.55)',
        }
      } else if (c.effect === 'monolith') {
        styles[sq] = {
          backgroundColor: 'rgba(212, 175, 55, 0.22)',
          backgroundImage: MONOLITH_HOURGLASS_BG,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: '42%',
          boxShadow: 'inset 0 0 0 2px rgba(212, 175, 55, 0.5)',
          animationName: 'rc-monolith-bob',
          animationDuration: '2.4s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }
      } else if (c.effect === 'trap_defodio') {
        // Solo el dueño ve la trampa; el rival no debe saber dónde está.
        if (c.owner_player_id && c.owner_player_id === you?.id) {
          styles[sq] = {
            backgroundColor: 'rgba(90, 40, 120, 0.22)',
            boxShadow: 'inset 0 0 0 1px rgba(90, 40, 120, 0.35)',
          }
        }
      }
    }

    // Piezas propias invisibles (capa) — siempre visibles para ti
    for (const sq of invisibleHints) {
      styles[sq] = {
        ...(styles[sq] ?? {}),
        ...indicatorStyle('invisible'),
        filter: 'blur(1.6px) saturate(0.75) opacity(0.55)',
        animationName: 'rc-piece-cloak',
        animationDuration: '2.2s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
      }
    }

    // Destinos legales (parpadeo a tamaño de casilla)
    for (const sq of moveHints.moves) {
      styles[sq] = { ...(styles[sq] ?? {}), ...indicatorStyle('move') }
    }
    for (const sq of moveHints.captures) {
      styles[sq] = {
        ...(styles[sq] ?? {}),
        ...indicatorStyle(
          match?.current_dimension === 'cadena_sangre' ? 'blood_capture' : 'capture',
        ),
      }
    }

    // Objetivos de comodín en apuntado
    if (aim) {
      for (const sq of jokerHints.empty) {
        styles[sq] = { ...(styles[sq] ?? {}), ...indicatorStyle('joker_empty') }
      }
      for (const sq of jokerHints.ally) {
        styles[sq] = { ...(styles[sq] ?? {}), ...indicatorStyle('joker_ally') }
      }
      for (const sq of jokerHints.hostile) {
        styles[sq] = { ...(styles[sq] ?? {}), ...indicatorStyle('joker_hostile') }
      }
      // Selección parcial (apareción / imperius): acento suave sin tapar el tema
      aim.squares.forEach((sq, i) => {
        styles[sq] = {
          ...(styles[sq] ?? {}),
          boxShadow:
            i === 0
              ? 'inset 0 0 0 2px rgba(212, 175, 55, 0.85)'
              : 'inset 0 0 0 2px rgba(180, 150, 60, 0.7)',
        }
      })
    } else if (isSpectator && remoteAim) {
      for (const sq of remoteAim.squares) {
        styles[sq] = {
          ...(styles[sq] ?? {}),
          ...indicatorStyle('joker_empty'),
        }
      }
      remoteAim.selected.forEach((sq, i) => {
        styles[sq] = {
          ...(styles[sq] ?? {}),
          boxShadow:
            i === 0
              ? 'inset 0 0 0 2px rgba(212, 175, 55, 0.85)'
              : 'inset 0 0 0 2px rgba(180, 150, 60, 0.7)',
        }
      })
    }

    if (selectedSquare && !aim) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] ?? {}),
        ...indicatorStyle('selected'),
      }
    }

    if (remoteDrag?.active) {
      styles[remoteDrag.from] = {
        ...(styles[remoteDrag.from] ?? {}),
        backgroundColor: 'rgba(115, 92, 0, 0.28)',
      }
      if (remoteDrag.hover && remoteDrag.hover !== remoteDrag.from) {
        styles[remoteDrag.hover] = {
          ...(styles[remoteDrag.hover] ?? {}),
          backgroundColor: 'rgba(212, 175, 55, 0.45)',
        }
      }
    }

    if (boardFx) {
      for (const sq of boardFx.squares) {
        styles[sq] = {
          ...(styles[sq] ?? {}),
          animationName: `rc-joker-${boardFx.kind}`,
          animationDuration: `${Math.max(0.45, boardFx.durationMs / 1000)}s`,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'both',
          animationIterationCount: 1,
        }
      }
    }
    return Object.keys(styles).length ? styles : undefined
  }, [
    remoteDrag,
    aim,
    remoteAim,
    isSpectator,
    state?.cells,
    boardFx,
    you?.id,
    invisibleHints,
    moveHints,
    jokerHints,
    selectedSquare,
    match?.current_dimension,
  ])

  // Esc cancela apuntado / selección
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (aim) setAim(null)
      else setSelectedSquare(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aim])

  // Tablero / fase cambian → limpia selección de pieza
  useEffect(() => {
    setSelectedSquare(null)
  }, [match?.fen, match?.turn_color, inShopPhase, isFinished, aim?.inventoryId])

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
    playSelectSound()
    setSelectedSquare(from)
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

  function onBoardSquareClick(square: string) {
    if (aim) {
      onAimSquare(square)
      return
    }
    if (!yourTurn || busy || inShopPhase || isFinished || optimisticFen || !match || !you?.color) {
      return
    }
    const fen = fenWithSideToMove(match.fen, match.turn_color)
    let chess: Chess
    try {
      chess = new Chess(fen)
    } catch {
      return
    }
    const me = you.color === 'white' ? 'w' : 'b'
    const piece = chess.get(square as 'a1')

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null)
        return
      }
      const canMove =
        moveHints.moves.includes(square) || moveHints.captures.includes(square)
      if (canMove) {
        const ok = onPieceDrop({ sourceSquare: selectedSquare, targetSquare: square })
        if (ok) setSelectedSquare(null)
        return
      }
      if (piece && piece.color === me) {
        playSelectSound()
        setSelectedSquare(square)
        return
      }
      setSelectedSquare(null)
      return
    }

    if (piece && piece.color === me) {
      playSelectSound()
      setSelectedSquare(square)
    }
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
        isSpectator={isSpectator}
        onDirty={onDirty}
        onBoardPulse={onBoardPulse}
        onPieceDrag={onRemotePieceDrag}
        onShopReady={onShopReadyPulse}
        onEmote={onEmotePulse}
        onJokerFx={onJokerFxPulse}
        onJokerAim={onJokerAimPulse}
        onArrows={onArrowsPulse}
        onSpectatorEmoji={onSpectatorEmojiPulse}
        onChannelReady={onChannelReady}
        onPeerInfo={onPeerInfo}
        publishRef={publishRef}
        publishDragRef={publishDragRef}
        publishBoardRef={publishBoardRef}
        publishShopReadyRef={publishShopReadyRef}
        publishEmoteRef={publishEmoteRef}
        publishJokerFxRef={publishJokerFxRef}
        publishJokerAimRef={publishJokerAimRef}
        publishArrowsRef={publishArrowsRef}
        publishSpectatorEmojiRef={publishSpectatorEmojiRef}
        sendActivityRef={sendActivityRef}
      />
    ) : null

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    endLocalDrag()
    if (!targetSquare || !yourTurn || busy) return false
    // Misma casilla: no es jugada, no llamar API
    if (sourceSquare === targetSquare) return false

    const chess = new Chess(fenWithSideToMove(match!.fen, match!.turn_color))
    const piece = chess.get(sourceSquare as 'a1')
    let dest = targetSquare
    // Preview alineado con el motor: en Espejo el comando se invierte por completo
    // (NO validar quemado sobre la intención — solo sobre el destino efectivo)
    if (match!.current_dimension === 'espejo') {
      const mirrored = mirrorCommand(sourceSquare, targetSquare)
      if (!mirrored || mirrored === sourceSquare) {
        setError('Espejo: ese movimiento cae fuera del tablero')
        return false
      }
      dest = mirrored
    }

    if (blockedSquares.has(dest)) {
      setError(
        match!.current_dimension === 'espejo'
          ? 'Espejo: el destino efectivo está quemado o en ruina'
          : 'Esa casilla está quemada o en ruina — no puedes aterrizar ahí',
      )
      return false
    }

    // Trayectoria: solo ruina corta el rayo (Bombarda se atraviesa)
    if (piece && piece.type !== 'n') {
      const path = pathBetweenClient(sourceSquare, dest)
      if (path.some((sq) => pathBlockedSquares.has(sq))) {
        setError('La trayectoria cruza una zona en ruina')
        return false
      }
    }

    // Gravitacional: deslizantes ≤3
    if (
      match!.current_dimension === 'gravitacional' &&
      piece &&
      (piece.type === 'q' || piece.type === 'r' || piece.type === 'b')
    ) {
      const df = Math.abs(dest.charCodeAt(0) - sourceSquare.charCodeAt(0))
      const dr = Math.abs(Number(dest[1]) - Number(sourceSquare[1]))
      if (Math.max(df, dr) > 3) {
        setError('Gravitacional: dama, torre y alfil solo llegan a 3 casillas')
        return false
      }
    }

    // Giratiempo: solo una captura
    const youExt = you as MatchPlayer & {
      giratiempo_active?: boolean
      giratiempo_captures?: number
    }
    if (youExt?.giratiempo_active && (youExt.giratiempo_captures ?? 0) >= 1) {
      const destPiece = chess.get(dest as 'a1')
      if (destPiece && destPiece.color !== piece?.color) {
        setError('Giratiempo: solo se permite una captura')
        return false
      }
    }

    // Cadena de sangre: si hay captura legal, obliga
    if (match!.current_dimension === 'cadena_sangre') {
      try {
        const probe = new Chess(fenWithSideToMove(match!.fen, match!.turn_color))
        const legal = probe.moves({ verbose: true }) as Array<{
          from: string
          to: string
          captured?: string
        }>
        const captureExists = legal.some(
          (m) => m.captured && !blockedSquares.has(m.to),
        )
        const destOcc = chess.get(dest as 'a1')
        const thisCaptures = Boolean(destOcc && destOcc.color !== piece?.color)
        if (captureExists && !thisCaptures) {
          setError('Cadena de Sangre: si puedes capturar, debes hacerlo')
          return false
        }
      } catch {
        /* ignore preview probe */
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
        blockedSquares,
        pathBlockedSquares,
      )
    }
    // Paso fantasma activo
    const ghostActiveMove = (state?.effects ?? []).some((e) => {
      const row = e as { kind?: string; is_active?: boolean; applied_by?: string }
      return (
        row.is_active !== false &&
        row.kind === 'ghost_step' &&
        row.applied_by === you?.id
      )
    })
    if (!previewFen && ghostActiveMove && piece && you?.color) {
      previewFen = applyGhostMoveFen(
        fenWithSideToMove(match!.fen, match!.turn_color),
        sourceSquare,
        dest,
        you.color,
        blockedSquares,
        match!.current_dimension === 'gravitacional',
        pathBlockedSquares,
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

    const destPiece = chess.get(dest as 'a1')
    const isCapture = Boolean(destPiece && destPiece.color !== piece?.color)
    skipMoveSfxRef.current = true
    playMoveSound({ capture: isCapture })

    // Optimista LOCAL only — no publicar preview a Portal (ecos viejos reverían piezas)
    setSelectedSquare(null)
    setOptimisticFen(previewFen)
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
    if (!state?.you || busy || !yourTurn) return
    const item = yourInv.find((i) => i.id === inventoryId)
    const code = item?.joker?.code

    setBusy(true)
    setError(null)
    setAim(null)
    setVanishingInvId(inventoryId)

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
      } else if (code === 'avada_kedavra' && typeof payload.square === 'string') {
        const sq = payload.square
        const wasPawn = (state.flags || []).some(
          (f) => f.square === sq && f.color !== state.you!.color && f.was_pawn,
        )
        previewFen = previewRemovePieceFen(state.match.fen, sq, { wasPawn })
      } else if (code === 'morsmordre' && typeof payload.square === 'string') {
        previewFen = previewMorsmordreFen(
          state.match.fen,
          payload.square,
          state.you.color,
          blockedSquares,
        )
      } else if (code === 'pocion_multijugos' && typeof payload.square === 'string') {
        previewFen = previewMultijugosFen(
          state.match.fen,
          payload.square,
          state.you.color,
        )
      }
    }
    const castSquares = code ? getJokerCastSquares(code, payload) : []
    if (code) {
      playJokerFx(code, castSquares)
    }
    if (previewFen) {
      setOptimisticFen(previewFen)
      // Portal: rival ve el FEN al instante (preview) sin esperar Neon
      void publishBoardRef.current?.(
        { ...state, match: { ...state.match, fen: previewFen } },
        { preview: true },
      )
    }
    // Portal FX inmediato (peers) — no esperar REST
    if (code && user?.uid) {
      void publishJokerFxRef.current?.({
        matchId: id,
        uid: user.uid,
        code,
        squares: castSquares,
        ...(previewFen ? { fen: previewFen } : {}),
      })
    }

    if (item && code) {
      // Efectos optimistas ya (FEN/flags/reloj); el slot sale tras la animación
      setState((prev) => {
        if (!prev?.you) return prev
        let next = {
          ...prev,
          ...(previewFen ? { match: { ...prev.match, fen: previewFen } } : {}),
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
        if (code === 'pocion_multijugos' && typeof payload.square === 'string') {
          const sq = payload.square
          const flag: PieceFlag = {
            piece_uid: `mj:${sq}:opt`,
            color: you.color,
            kind: 'q',
            square: sq,
            was_pawn: true,
            multijugos_queen: true,
          }
          next = {
            ...next,
            flags: [...(next.flags || []).filter((f) => f.square !== sq), flag],
          }
        }
        return { ...next, players, you }
      })

      window.setTimeout(() => {
        setState((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            inventory: (prev.inventory || []).filter((i) => i.id !== inventoryId),
          }
        })
        setVanishingInvId(null)
      }, 200)
    } else {
      setVanishingInvId(null)
    }

    try {
      const token = await getToken()
      if (!token) {
        clearJokerFx()
        return
      }
      const { state: s } = await api.useJoker(token, id, inventoryId, payload)
      applyState(s as MatchState, { reason: 'use_joker' })
    } catch (err) {
      clearJokerFx()
      setOptimisticFen(null)
      setError(err instanceof Error ? err.message : 'No se pudo usar')
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  function beginJokerUse(inventoryId: string, joker: Joker) {
    if (busy || inShopPhase || isFinished || !yourTurn) return
    const mode = getJokerTargetMode(joker.code)
    if (!mode) {
      setError(`Comodín desconocido: ${joker.code}`)
      return
    }
    if (!needsBoardTarget(joker.code)) {
      void castJoker(inventoryId, {})
      return
    }
    setError(null)
    setSelectedSquare(null)
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

    // Solo casillas legales del comodín (p. ej. Avada nunca el rey)
    const allowed = new Set([
      ...jokerHints.hostile,
      ...jokerHints.ally,
      ...jokerHints.empty,
    ])
    if (allowed.size > 0 && !allowed.has(square)) {
      setError('Esa casilla no es un objetivo válido')
      return
    }

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
    if (isSpectator) return
    playResignSound()
    const token = await getToken()
    if (!token) return
    const { state: s } = await api.resignMatch(token, id)
    applyState(s as MatchState, { reason: 'resign' })
  }

  /** Emoji del espectador: Neon valida cooldown → Portal hace el fan-out. */
  async function sendSpectatorEmoji(emoji: string) {
    if (!emoji || !user?.uid || emojiCooldownLeft > 0) return
    try {
      const token = await getToken()
      if (!token) return
      const res = await api.sendSpectatorEmoji(token, id, emoji)
      const emojiId = res.emoji?.id
      if (emojiId) seenEmojiIds.current.add(emojiId)
      emojiCooldownUntil.current = Date.now() + 8000
      setEmojiCooldownLeft(8000)
      triggerEmojiBurst(emoji, {
        username: profile?.username,
        targetColor: cheerTargetColor,
      })
      void publishSpectatorEmojiRef.current?.({
        matchId: id,
        uid: user.uid,
        username: profile?.username,
        emoji,
        targetColor: cheerTargetColor,
        emojiId,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('cooldown')) {
        emojiCooldownUntil.current = Date.now() + 8000
        setEmojiCooldownLeft(8000)
      } else {
        setError(msg || 'No se pudo enviar el emoji')
      }
    }
  }

  if (ready && !user) return <Navigate to="/login" replace />
  if (!state || !match) {
    return (
      <>
        <DimensionEnv theme="primo" persistent />
        {bridge}
        <p className="relative z-[1] font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
          {error ?? 'Cargando partida…'}
        </p>
      </>
    )
  }

  const yourTimeMs =
    you?.color === 'black' ? clocks.blackMs : you?.color === 'white' ? clocks.whiteMs : you?.time_ms ?? 0
  const white = state.players.find((p) => p.color === 'white')
  const black = state.players.find((p) => p.color === 'black')

  // Rival arriba, tú abajo (según orientación del tablero)
  const myColor: 'white' | 'black' = boardOrientation
  const rivalColor: 'white' | 'black' = myColor === 'white' ? 'black' : 'white'
  const myPlayer = myColor === 'white' ? white : black
  const rivalPlayer = rivalColor === 'white' ? white : black
  const myMs = myColor === 'white' ? clocks.whiteMs : clocks.blackMs
  const rivalMs = rivalColor === 'white' ? clocks.whiteMs : clocks.blackMs

  const youWon = Boolean(you?.profile_id && match.winner_id && match.winner_id === you.profile_id)
  const isDraw = match.result === 'draw' || match.result === 'abort'
  const winnerPlayer = match.winner_id
    ? state.players.find((p) => p.profile_id === match.winner_id)
    : null
  const victoryTitle = isDraw
    ? 'Tablas'
    : isSpectator
      ? 'Partida terminada'
      : youWon
        ? 'Victoria'
        : 'Derrota'
  const victorySubtitle = isDraw
    ? 'El tablero se queda en empate. El tiempo no eligió bando.'
    : isSpectator
      ? winnerPlayer
        ? `Ganó ${winnerPlayer.display_name ?? winnerPlayer.username ?? (winnerPlayer.color === 'white' ? 'blancas' : 'negras')}. Gracias por espectar.`
        : 'La partida llegó a su fin. Gracias por espectar.'
      : youWon
        ? 'La grieta te sonrió. Conserva el tempo.'
        : 'Otra partida, otra grieta. El mercado te espera.'
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
    <PageTransition
      className={`rc-match-dim rc-match-dim--${dimMeta.id} relative flex min-h-0 flex-1 flex-col overflow-hidden`}
    >
      <DimensionEnv theme={dimMeta.id} persistent />
      {bridge}
      <MatchToast
        message={error}
        tone="error"
        dark={darkDim}
        className={aim ? '!top-[5.5rem]' : undefined}
      />
      {aim ? (
        <JokerTargetBanner
          open
          jokerName={aim.jokerName}
          mode={aim.mode}
          selected={aim.squares}
          dark={darkDim}
          onCancel={() => setAim(null)}
        />
      ) : null}
      <ShopIntroOverlay
        open={showShopIntro && showMatchBoard}
        cycleIndex={match.cycle_index}
        dark={darkDim || dimMeta.id === 'cadena_sangre'}
        onDone={finishShopIntro}
      />
      <DimensionReveal
        dimensionId={activeReveal}
        onDismiss={dismissDimensionReveal}
        onExitComplete={onRevealExitComplete}
      />
      <ShopPhaseModal
        open={showShopModal && showMatchBoard}
        cycleIndex={match.cycle_index}
        timeMs={yourTimeMs}
        shopLeftMs={shopLeftMs || 60000}
        offers={yourShop}
        inventory={yourInv}
        inventorySlots={you?.inventory_slots ?? 3}
        busy={busy}
        justBoughtOfferId={justBoughtOfferId}
        justBoughtInventoryId={justBoughtInventoryId}
        dimensionId={dimMeta.id}
        onBuy={(offerId) => void buy(offerId)}
        onSell={(inventoryId) => void sell(inventoryId)}
        onContinue={() => void closeShop()}
      />
      <ShopWaitOverlay
        open={isShopWaiting && !isFinished && showMatchBoard}
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
        onRematch={isSpectator ? undefined : () => void rematch()}
      />
      <div
        className={`relative z-[1] flex min-h-0 flex-1 flex-col ${
          !showMatchBoard ? 'invisible pointer-events-none' : ''
        } ${
          isShop || (isShopWaiting && !shopPeek) ? 'pointer-events-none select-none' : ''
        }`}
        aria-hidden={!showMatchBoard || isShop || (isShopWaiting && !shopPeek) || undefined}
      >
        {/* Barra meta: logo + acciones */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-1.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/"
              className="font-display text-base tracking-tight text-[var(--color-primary)] hover:opacity-80"
            >
              RogueChess
            </Link>
            {rivalEmote ? (
              <span className="text-xl leading-none" aria-live="polite">
                {rivalEmote}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            {isSpectator && !isFinished ? null : !isFinished && !isWaitingRival ? (
              <button
                type="button"
                onClick={() => void resign()}
                className="btn-ghost !px-3 !py-1 text-xs"
              >
                Rendirse
              </button>
            ) : isFinished ? (
              <button type="button" onClick={() => navigate('/')} className="btn-primary !px-3 !py-1 text-xs">
                Salir
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/')} className="btn-ghost !px-3 !py-1 text-xs">
                Cancelar reto
              </button>
            )}
          </div>
        </div>

        {/* Fila: info dimensión (izq) + tablero (centro) + spacer der. equilibrado */}
        <div className="relative flex min-h-0 flex-1 items-stretch gap-4 lg:gap-6">
          {/* Panel dimensión — izquierda, legible */}
          <aside
            data-tutorial="dimension"
            className="hidden w-[min(100%,220px)] shrink-0 flex-col justify-center sm:flex lg:w-[240px]"
          >
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-[var(--color-primary)]">
              {isSpectator
                ? 'Espectando'
                : isWaitingRival
                  ? match.mode === 'custom'
                    ? 'Sala personalizada'
                    : 'Reto'
                  : `Ciclo ${match.cycle_index}`}
            </p>
            <h1 className="font-display mt-1 text-xl leading-tight text-[var(--color-ink)] lg:text-2xl">
              {isWaitingRival ? 'Esperando rival…' : dimMeta.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {isWaitingRival
                ? match.invite_code
                  ? 'Comparte el código o espera a que acepten el reto.'
                  : 'Esperando a que el rival acepte la invitación.'
                : dimMeta.blurb}
            </p>
            {isWaitingRival ? (
              <div className="panel mt-3 space-y-2 p-3">
                {match.invite_code ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-2xl tracking-[0.22em] text-[var(--color-primary)]">
                      {match.invite_code}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={() => {
                        void navigator.clipboard?.writeText(match.invite_code ?? '').then(() => {
                          setCodeCopied(true)
                          window.setTimeout(() => setCodeCopied(false), 1600)
                        })
                      }}
                    >
                      {codeCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                ) : null}
                <p className="font-label text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {Math.round((match.time_control_s || 300) / 60)} min
                  {' · '}
                  {match.allow_spectators === false ? 'Sin espectadores' : 'Espectadores permitidos'}
                </p>
                {invitedUsername ? (
                  <p className="text-xs text-[var(--color-ink)]">
                    Invitación enviada a{' '}
                    <span className="font-medium">@{invitedUsername}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            {!isWaitingRival ? (
              <p className="font-label mt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {match.moves_in_phase}/{match.moves_per_phase} mov.
                {match.mode === 'bot' ? ' · vs RogueBot' : ''}
                {match.mode === 'custom' ? ' · personalizada' : ''}
                {match.phase === 'shop' || match.status === 'shop' ? ' · mercado' : ''}
                {isSpectator ? ' · solo lectura' : ''}
              </p>
            ) : null}
            {(you as MatchPlayer & { giratiempo_active?: boolean })?.giratiempo_active ? (
              <p className="mt-3 text-xs leading-snug text-[var(--color-primary)]">
                Giratiempo: movimiento extra este turno (máx. 1 captura).
              </p>
            ) : null}
            {(state.spectators?.length ?? 0) > 0 ? (
              <p className="font-label mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {state.spectators.length}{' '}
                {state.spectators.length === 1 ? 'espectador' : 'espectadores'}
              </p>
            ) : null}
          </aside>

          {/* Tablero centrado */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1.5">
            {/* Móvil: título corto de dimensión */}
            <div className="w-full shrink-0 text-center sm:hidden">
              <h1 className="font-display text-base text-[var(--color-ink)]">
                {isWaitingRival ? 'Esperando…' : dimMeta.title}
              </h1>
            </div>

            <div
              className={`flex w-[min(100%,560px,calc(100dvh-268px))] flex-col ${
                isShop || (isShopWaiting && !shopPeek) ? 'opacity-40 blur-[2px]' : ''
              }`}
            >
              {/* Reloj rival */}
              <div className="flex items-center justify-between gap-2 pb-1.5 font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <span className={clocks.runningFor === rivalColor ? 'text-[var(--color-primary)]' : ''}>
                  {rivalPlayer?.display_name ?? '…'}
                  {remoteDrag?.active ? ' · moviendo…' : ''}
                </span>
                <span
                  className={`tabular-nums text-sm ${
                    clocks.runningFor === rivalColor
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-ink)]'
                  }`}
                >
                  {formatMs(rivalMs)}
                  {clocks.runningFor === rivalColor ? ' ●' : ''}
                </span>
              </div>

              <div data-tutorial="board" className={`rc-board-stage rc-board-stage--${dimMeta.id} relative`}>
                <SpectatorReactionColumns
                  events={spectatorEmojis}
                  boardOrientation={boardOrientation}
                  dark={darkDim}
                />
                <JokerClockFx event={clockFx} />
                <Chessboard
                  options={{
                    id: `board-${match.id}`,
                    position: displayFen,
                    boardOrientation,
                    allowDragging:
                      !isSpectator &&
                      yourTurn &&
                      !busy &&
                      !inShopPhase &&
                      !isFinished &&
                      !optimisticFen &&
                      !aim,
                    allowDrawingArrows: !isSpectator,
                    ...(isSpectator ? { arrows: spectatorArrows } : {}),
                    clearArrowsOnClick: true,
                    clearArrowsOnPositionChange: true,
                    onArrowsChange: isSpectator
                      ? undefined
                      : ({ arrows }) => {
                          publishLocalArrows(arrows as BoardArrow[])
                        },
                    animationDurationInMs: optimisticFen ? 0 : 280,
                    squareStyles: dragSquareStyles,
                    pieces: dimPieces,
                    onSquareClick: ({ square }) => {
                      if (isSpectator) return
                      if (square) onBoardSquareClick(square)
                    },
                    onPieceDrag: ({ piece, square }) => {
                      if (isSpectator || aim || !square) return
                      startLocalDrag(square, piece.pieceType)
                    },
                    onMouseOverSquare: ({ square }) => {
                      if (localDrag.current) hoverLocalDrag(square)
                    },
                    onPieceDragCancel: () => {
                      endLocalDrag()
                    },
                    onPieceDrop: ({ sourceSquare, targetSquare }) => {
                      if (isSpectator || aim) return false
                      return onPieceDrop({ sourceSquare, targetSquare })
                    },
                    boardStyle: {
                      borderRadius: '4px',
                      boxShadow: dimMeta.board.frame
                        ? `0 0 0 1px ${dimMeta.board.frame}, 0 18px 50px rgba(0,0,0,0.35)`
                        : '0 12px 40px rgba(115,92,0,0.08)',
                      cursor: aim ? 'crosshair' : undefined,
                    },
                    lightSquareStyle: { backgroundColor: dimMeta.board.light },
                    darkSquareStyle: { backgroundColor: dimMeta.board.dark },
                  }}
                />
                <JokerFxOverlay
                  orientation={boardOrientation}
                  aim={displayJokerAim}
                  burst={jokerBurst}
                />
              </div>

              {/* Reloj propio */}
              <div className="flex items-center justify-between gap-2 pt-1.5 font-label text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                <span className={clocks.runningFor === myColor ? 'text-[var(--color-primary)]' : ''}>
                  {myPlayer?.display_name ?? (isSpectator ? (myColor === 'white' ? 'Blancas' : 'Negras') : 'Tú')}
                  {yourTurn ? ' · tu turno' : ''}
                  {!clocks.runningFor && match.status === 'active' && yourTurn
                    ? ' · reloj espera 1ª jugada'
                    : ''}
                </span>
                <span
                  data-tutorial="clock"
                  className={`tabular-nums text-sm ${
                    clocks.runningFor === myColor
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-ink)]'
                  }`}
                >
                  {formatMs(myMs)}
                  {clocks.runningFor === myColor ? ' ●' : ''}
                </span>
              </div>
            </div>

            {/* Comodines — ocultos en modo espectador */}
            {!isSpectator ? (
              <div data-tutorial="jokers" className="flex shrink-0 items-center gap-2 pt-0.5">
                <AnimatePresence mode="popLayout">
                  {yourInv.map((item) =>
                    item.joker ? (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 1, scale: 1, y: 0, rotate: 0, filter: 'blur(0px)' }}
                        animate={
                          vanishingInvId === item.id
                            ? {
                                opacity: 0,
                                scale: 0.52,
                                y: 32,
                                rotate: 10,
                                filter: 'blur(6px)',
                              }
                            : { opacity: 1, scale: 1, y: 0, rotate: 0, filter: 'blur(0px)' }
                        }
                        exit={{
                          opacity: 0,
                          scale: 0.5,
                          y: 24,
                          filter: 'blur(4px)',
                        }}
                        transition={{ duration: 0.2, ease: easeOut }}
                        className="origin-bottom"
                      >
                        <JokerCard
                          joker={item.joker as Joker}
                          size={96}
                          darkTooltip={darkDim}
                          disabled={
                            busy ||
                            isFinished ||
                            inShopPhase ||
                            !yourTurn ||
                            vanishingInvId === item.id
                          }
                          selected={aim?.inventoryId === item.id}
                          onClick={() => {
                            if (inShopPhase || !yourTurn) return
                            if (aim?.inventoryId === item.id) {
                              setAim(null)
                              return
                            }
                            beginJokerUse(item.id, item.joker as Joker)
                          }}
                        />
                      </motion.div>
                    ) : null,
                  )}
                </AnimatePresence>
                {Array.from({ length: Math.max(0, (you?.inventory_slots ?? 3) - yourInv.length) }).map(
                  (_, i) => (
                    <motion.div
                      key={`slot-${i}`}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center rounded border border-dashed border-[var(--color-outline-soft)]/60 text-[var(--color-ink-muted)]/50"
                      style={{ width: 96, height: Math.round(96 * 1.4) }}
                      aria-hidden
                    >
                      <span className="font-label text-[9px] uppercase tracking-wider">Vacío</span>
                    </motion.div>
                  ),
                )}
              </div>
            ) : null}

            <p className="h-4 shrink-0 truncate text-center text-[11px] text-[var(--color-ink-muted)]">
              {isSpectator
                ? 'Modo espectador · solo lectura'
                : blockedSquares.size > 0
                  ? 'Casillas oscuras/rojas: quemadas o en ruina — el caballo sí salta'
                  : inShopPhase
                    ? isShopWaiting
                      ? `Esperando rival · ${Math.ceil(shopLeftMs / 1000)}s`
                      : `Mercado abierto · ${Math.ceil(shopLeftMs / 1000)}s`
                    : ''}
            </p>
          </div>

          {/* Spacer derecho = mismo ancho que el panel izq → tablero siempre centrado */}
          <div
            className="hidden w-[min(100%,220px)] shrink-0 sm:block lg:w-[240px]"
            aria-hidden
          />

          {isTutorial && !isSpectator && !tutorialDone ? (
            <TutorialCoach
              open={showMatchBoard && !isWaitingRival && !isFinished}
              dark={darkDim}
              moved={Boolean(match && ((match.moves_in_phase ?? 0) > 0 || match.cycle_index > 0))}
              jokerCount={yourInv.length}
              dimensionId={dimMeta.id}
              inShop={inShopPhase}
              aimingJokerCode={aim?.mode.code ?? null}
              onDone={() => setTutorialDone(true)}
            />
          ) : (
            <MatchMascotCoach
              dimensionId={dimMeta.id}
              open={showMatchBoard && !isWaitingRival && !isFinished}
              dark={darkDim}
            />
          )}
        </div>
      </div>

      {isSpectator && !isFinished ? (
        <div className="fixed right-3 bottom-3 z-40 flex items-center gap-0.5 border border-[var(--color-outline-soft)] bg-[var(--color-surface)]/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
          <span className="font-label mr-1.5 text-[9px] uppercase tracking-wider text-[var(--color-ink-muted)]">
            {emojiCooldownLeft > 0 ? `${Math.ceil(emojiCooldownLeft / 1000)}s` : 'Reaccionar'}
          </span>
          {SPECTATOR_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              title={`Reaccionar con ${emoji}`}
              disabled={emojiCooldownLeft > 0}
              className="p-1 transition hover:-translate-y-0.5 hover:bg-[var(--color-primary)]/10 disabled:opacity-30"
              onClick={() => void sendSpectatorEmoji(emoji)}
            >
              <PixelEmoji emoji={emoji} size={22} res={14} />
            </button>
          ))}
        </div>
      ) : null}
    </PageTransition>
  )
}
