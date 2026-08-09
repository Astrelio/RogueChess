import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthContext'
import { PortalAppProvider } from '@/portal/PortalAppProvider'
import { Shell } from '@/components/Shell'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { RankingPage } from '@/pages/RankingPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PublicProfilePage } from '@/pages/PublicProfilePage'
import { DevsPage } from '@/pages/DevsPage'
import { MatchPage } from '@/pages/MatchPage'
import { SpotifyCallbackPage } from '@/pages/SpotifyCallbackPage'

export default function App() {
  return (
    <AuthProvider>
      <PortalAppProvider>
        <BrowserRouter>
          <Shell>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/u/:username" element={<PublicProfilePage />} />
              <Route path="/devs" element={<DevsPage />} />
              <Route path="/partida/:id" element={<MatchPage />} />
              <Route path="/spotify-callback" element={<SpotifyCallbackPage />} />
            </Routes>
          </Shell>
        </BrowserRouter>
      </PortalAppProvider>
    </AuthProvider>
  )
}
