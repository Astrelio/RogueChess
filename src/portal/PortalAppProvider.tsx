import { useEffect, useMemo } from 'react'
import { PortalProvider } from '@portalsdk/react'
import { useAuth } from '@/auth/AuthContext'
import { portal, portalReady } from '@/lib/portal'

/**
 * Identidad Portal = Firebase ID token (verificado en portal.config.ts vía JWKS).
 * Sin sesión → anonymous (identidad estable local).
 */
export function PortalAppProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken } = useAuth()

  const token = useMemo(() => {
    if (!user) return undefined
    return async () => {
      const t = await getToken()
      if (!t) throw new Error('Sin token Firebase para Portal')
      return t
    }
  }, [user, getToken])

  useEffect(() => {
    if (!portal) return
    if (!user) {
      portal.setToken(undefined)
      return
    }
    portal.setToken(async () => {
      const t = await getToken()
      if (!t) throw new Error('Sin token Firebase para Portal')
      return t
    })
  }, [user, getToken])

  if (!portalReady || !portal) {
    return <>{children}</>
  }

  return (
    <PortalProvider client={portal} token={token}>
      {children}
    </PortalProvider>
  )
}
