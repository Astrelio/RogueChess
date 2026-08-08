import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, firebaseReady, getIdToken, logout as fbLogout } from '@/lib/firebase'
import { api } from '@/lib/api'
import type { Profile } from '@/types'

type AuthState = {
  ready: boolean
  firebaseReady: boolean
  user: User | null
  profile: Profile | null
  token: string | null
  refreshProfile: () => Promise<void>
  logout: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const sync = useCallback(async (u: User) => {
    const t = await getIdToken(u)
    setToken(t)
    const { profile: p } = await api.syncProfile(t, {
      displayName: u.displayName ?? undefined,
      avatarUrl: u.photoURL,
      usernameHint: u.displayName ?? u.email?.split('@')[0],
    })
    setProfile(p)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const t = await getIdToken(user)
    setToken(t)
    const { profile: p } = await api.me(t)
    setProfile(p)
  }, [user])

  const getToken = useCallback(async () => {
    if (!user) return null
    const t = await getIdToken(user)
    setToken(t)
    return t
  }, [user])

  useEffect(() => {
    if (!firebaseReady || !auth) {
      setReady(true)
      return
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          await sync(u)
        } catch (err) {
          console.error(err)
          setProfile(null)
        }
      } else {
        setProfile(null)
        setToken(null)
      }
      setReady(true)
    })
    return unsub
  }, [sync])

  useEffect(() => {
    if (!user || !token) return
    const tick = () => {
      void api.heartbeat(token, 'online').catch(() => undefined)
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [user, token])

  const value = useMemo<AuthState>(
    () => ({
      ready,
      firebaseReady,
      user,
      profile,
      token,
      refreshProfile,
      getToken,
      logout: async () => {
        await fbLogout()
        setProfile(null)
        setToken(null)
      },
    }),
    [ready, user, profile, token, refreshProfile, getToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
