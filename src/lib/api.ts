import type { Developer, LeaderboardEntry, LiveMatchRef, Profile } from '@/types'
import type { MatchState, Joker } from '@/types/match'

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options
  const res = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string; message?: string }).error
      || (data as { message?: string }).message
      || `HTTP ${res.status}`)
  }
  return data as T
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),

  syncProfile: (token: string, body: { displayName?: string; avatarUrl?: string | null; usernameHint?: string }) =>
    request<{ profile: Profile }>('/api/auth/sync', { method: 'POST', token, body: JSON.stringify(body) }),

  me: (token: string) =>
    request<{ profile: Profile }>('/api/auth/me', { token }),

  leaderboard: (limit = 50, offset = 0) =>
    request<{ entries: LeaderboardEntry[] }>(`/api/leaderboard?limit=${limit}&offset=${offset}`),

  getProfile: (username: string) =>
    request<{ profile: Profile; liveMatch?: LiveMatchRef | null }>(
      `/api/profiles/${encodeURIComponent(username)}`,
    ),

  updateMe: (token: string, body: { displayName?: string; username?: string; bio?: string | null; avatarUrl?: string | null }) =>
    request<{ profile: Profile }>('/api/profiles/me', { method: 'PATCH', token, body: JSON.stringify(body) }),

  setMood: (token: string, body: { moodText?: string | null; moodEmoji?: string | null }) =>
    request<{ profile: Profile }>('/api/profiles/me/mood', { method: 'PATCH', token, body: JSON.stringify(body) }),

  superLike: (token: string, toUsername: string) =>
    request<{ ok: boolean; message: string; popularity_score: number | null }>('/api/profiles/super-like', {
      method: 'POST',
      token,
      body: JSON.stringify({ toUsername }),
    }),

  developers: () =>
    request<{ developers: Developer[] }>('/api/developers'),

  heartDeveloper: (token: string, slug: string) =>
    request<{ ok: boolean; message: string; heart_count: number | null }>('/api/developers/heart', {
      method: 'POST',
      token,
      body: JSON.stringify({ slug }),
    }),

  heartbeat: (token: string, presence = 'online') =>
    request<{ profile: Profile }>('/api/presence/heartbeat', {
      method: 'POST',
      token,
      body: JSON.stringify({ presence }),
    }),

  startQuickMatch: (token: string) =>
    request<{ match: { id: string }; state: MatchState }>('/api/matches/quick', { method: 'POST', token }),

  createChallengeMatch: (
    token: string,
    opts?: {
      timeControlS?: number
      allowSpectators?: boolean
      mode?: 'custom' | 'quick'
      inviteUsername?: string
    },
  ) =>
    request<{
      match: { id: string; status: string; invite_code?: string | null; time_control_s?: number }
      state: MatchState
    }>('/api/matches/challenge', {
      method: 'POST',
      token,
      body: JSON.stringify({
        timeControlS: opts?.timeControlS ?? 300,
        allowSpectators: opts?.allowSpectators ?? true,
        mode: opts?.mode ?? 'custom',
        inviteUsername: opts?.inviteUsername,
      }),
    }),

  /** Sala personalizada (siempre mode=custom + invite_code). */
  createCustomMatch: (
    token: string,
    opts?: { timeControlS?: number; allowSpectators?: boolean; inviteUsername?: string },
  ) =>
    request<{
      match: { id: string; status: string; invite_code?: string | null; time_control_s?: number }
      state: MatchState
    }>('/api/matches/custom', {
      method: 'POST',
      token,
      body: JSON.stringify({
        timeControlS: opts?.timeControlS ?? 300,
        allowSpectators: opts?.allowSpectators ?? true,
        inviteUsername: opts?.inviteUsername,
      }),
    }),

  /** Invitaciones waiting dirigidas a mí (bandeja). */
  getPendingInvites: (token: string) =>
    request<{
      invites: Array<{
        invite_id: string
        match_id: string
        invite_code: string
        from_username: string
        from_uid: string
        time_control_s?: number
      }>
    }>('/api/matches/invites/pending', { token }),

  joinMatch: (token: string, id: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/join`, { method: 'POST', token }),

  joinMatchByCode: (token: string, code: string) =>
    request<{
      match: { id: string }
      state: MatchState
    }>('/api/matches/join-by-code', {
      method: 'POST',
      token,
      body: JSON.stringify({ code }),
    }),

  enqueueMatch: (token: string, timeControlS = 300) =>
    request<{
      queue: {
        id: string
        status: string
        matched_match_id: string | null
      }
      state: MatchState | null
    }>('/api/matches/queue', {
      method: 'POST',
      token,
      body: JSON.stringify({ timeControlS }),
    }),

  getQueue: (token: string) =>
    request<{
      queue: {
        id: string
        status: string
        matched_match_id: string | null
      } | null
      state: MatchState | null
    }>('/api/matches/queue', { token }),

  cancelQueue: (token: string) =>
    request<{ ok: boolean }>('/api/matches/queue/cancel', { method: 'POST', token }),

  queueFallbackBot: (token: string) =>
    request<{ match: { id: string }; state: MatchState; vsBot: boolean }>(
      '/api/matches/queue/bot',
      { method: 'POST', token },
    ),

  getMatch: (token: string, id: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}`, { token }),

  makeMove: (token: string, id: string, body: { from: string; to: string; promotion?: string; timeSpentMs?: number }) =>
    request<{ state: MatchState }>(`/api/matches/${id}/move`, {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),

  buyJoker: (token: string, id: string, offerId: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/shop/buy`, {
      method: 'POST',
      token,
      body: JSON.stringify({ offerId }),
    }),

  sellJoker: (token: string, id: string, inventoryId: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/shop/sell`, {
      method: 'POST',
      token,
      body: JSON.stringify({ inventoryId }),
    }),

  useJoker: (token: string, id: string, inventoryId: string, payload?: Record<string, unknown>) =>
    request<{ state: MatchState; events?: string[]; fizzled?: boolean }>(`/api/matches/${id}/joker/use`, {
      method: 'POST',
      token,
      body: JSON.stringify({ inventoryId, payload }),
    }),

  closeShop: (token: string, id: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/shop/close`, { method: 'POST', token }),

  claimShopTimeout: (token: string, id: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/shop/timeout`, { method: 'POST', token }),

  resignMatch: (token: string, id: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/resign`, { method: 'POST', token }),

  /** Registra al usuario como espectador de la partida (idempotente). */
  spectateMatch: (token: string, id: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/spectate`, { method: 'POST', token }),

  /** Emoji de espectador; Neon valida pertenencia + cooldown (8s). */
  sendSpectatorEmoji: (token: string, id: string, emoji: string) =>
    request<{ ok: boolean; emoji?: { id: string } }>(`/api/matches/${id}/spectator-emoji`, {
      method: 'POST',
      token,
      body: JSON.stringify({ emoji }),
    }),

  /** Declara flag: el reloj en vivo llegó a 0 (server valida con clock_updated_at). */
  claimTimeout: (token: string, id: string) =>
    request<{ state: MatchState }>(`/api/matches/${id}/timeout`, { method: 'POST', token }),

  jokersCatalog: () =>
    request<{ jokers: Joker[] }>('/api/matches/catalog/jokers'),
}
