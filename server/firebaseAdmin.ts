import admin from 'firebase-admin'

let initialized = false

export function getAdminAuth() {
  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (!projectId) {
      throw new Error(
        'Firebase Admin no configurado. Define al menos FIREBASE_PROJECT_ID (y opcionalmente FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY), o usa VERIFY_SKIP=true en local.',
      )
    }

    if (clientEmail && privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n')
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
    } else {
      // Sin service account: verifyIdToken sigue funcionando porque valida la
      // firma contra los certificados públicos de Google (solo requiere projectId).
      admin.initializeApp({ projectId })
    }
    initialized = true
  }
  return admin.auth()
}
