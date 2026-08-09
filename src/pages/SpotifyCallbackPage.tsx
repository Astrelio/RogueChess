import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Music2 } from 'lucide-react'
import { completeSpotifyLogin } from '@/lib/spotifyAuth'
import { PageTransition } from '@/components/PageTransition'

export function SpotifyCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const authError = params.get('error')
    if (authError) {
      setError(authError === 'access_denied' ? 'Cancelaste la conexión con Spotify.' : authError)
      return
    }
    if (!code) {
      setError('Spotify no devolvió el código de autorización.')
      return
    }
    completeSpotifyLogin(code)
      .then((returnTo) => navigate(returnTo, { replace: true }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error conectando Spotify'))
  }, [navigate])

  return (
    <PageTransition className="flex flex-1 items-center justify-center">
      <div className="panel max-w-sm p-6 text-center">
        <Music2 className="mx-auto size-8 text-[var(--color-primary)]" strokeWidth={1.5} />
        {error ? (
          <>
            <p className="mt-3 text-sm text-[var(--color-error)]">{error}</p>
            <Link to="/" className="btn-primary mt-4 inline-block !px-4 !py-2 text-sm">
              Volver al inicio
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Conectando con Spotify…</p>
        )}
      </div>
    </PageTransition>
  )
}
