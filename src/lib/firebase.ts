import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

export const firebaseReady = configured

export const app = configured ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const googleProvider = new GoogleAuthProvider()

export async function loginWithGoogle() {
  if (!auth) throw new Error('Firebase no configurado')
  return signInWithPopup(auth, googleProvider)
}

export async function loginWithEmail(email: string, password: string) {
  if (!auth) throw new Error('Firebase no configurado')
  return signInWithEmailAndPassword(auth, email, password)
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  if (!auth) throw new Error('Firebase no configurado')
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) {
    await updateProfile(cred.user, { displayName })
  }
  return cred
}

export async function logout() {
  if (!auth) return
  await signOut(auth)
}

export async function getIdToken(user: User) {
  return user.getIdToken()
}
