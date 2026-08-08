import type { Developer, LeaderboardEntry, Profile } from '@/types'

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
    request<{ profile: Profile }>(`/api/profiles/${encodeURIComponent(username)}`),

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
}
