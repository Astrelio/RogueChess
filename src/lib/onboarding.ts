/**
 * Flags de onboarding persistidos en localStorage.
 * `rc-lobby-tour-v1`: el usuario ya vio el tour del lobby (subir versión para re-mostrar).
 */
const LOBBY_TOUR_KEY = 'rc-lobby-tour-v1'

/** Disparar desde Ajustes para volver a mostrar el tour de interfaz. */
export const START_LOBBY_TOUR_EVENT = 'rc-start-lobby-tour'

export function hasSeenLobbyTour(): boolean {
  try {
    return window.localStorage.getItem(LOBBY_TOUR_KEY) === '1'
  } catch {
    return true
  }
}

export function markLobbyTourSeen() {
  try {
    window.localStorage.setItem(LOBBY_TOUR_KEY, '1')
  } catch {
    /* almacenamiento no disponible: no bloquear la app */
  }
}

export function clearLobbyTourSeen() {
  try {
    window.localStorage.removeItem(LOBBY_TOUR_KEY)
  } catch {
    /* ignore */
  }
}

/** Pide al lobby que abra el tour (LandingPage escucha el evento). */
export function requestLobbyTour() {
  clearLobbyTourSeen()
  window.dispatchEvent(new CustomEvent(START_LOBBY_TOUR_EVENT))
}
