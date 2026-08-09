export type PresenceStatus = 'offline' | 'online' | 'away' | 'playing' | 'spectating'
export type Medal = 'gold' | 'silver' | 'bronze' | 'none'

export type Profile = {
  id: string
  firebase_uid: string
  email: string | null
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  mood_text: string | null
  mood_emoji: string | null
  mood_updated_at: string | null
  presence: PresenceStatus
  last_seen_at: string
  rating: number
  peak_rating: number
  wins: number
  losses: number
  draws: number
  games_played: number
  popularity_score: number
  preferred_deck: string | null
  is_banned: boolean
  created_at: string
  updated_at: string
}

/** Partida en vivo de un perfil (para el botón Espectar). */
export type LiveMatchRef = {
  id: string
  allow_spectators: boolean
}

export type LeaderboardEntry = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  mood_text: string | null
  mood_emoji: string | null
  presence: PresenceStatus
  rating: number
  peak_rating: number
  wins: number
  losses: number
  draws: number
  games_played: number
  popularity_score: number
  rank_pos: number
  medal: Medal
  last_seen_at: string
  created_at: string
  /** Calculado en la API (partida viva reciente). */
  is_in_match?: boolean
  /** En cola de matchmaking (y no en partida). */
  is_searching?: boolean
}

export type Developer = {
  id: string
  slug: string
  name: string
  role: string | null
  bio: string | null
  avatar_url: string | null
  github_url: string | null
  twitter_url: string | null
  heart_count: number
  sort_order: number
}
