import admin from 'firebase-admin'

let initialized = false

export function getAdminAuth() {
  if (!initialized) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase Admin no configurado. Define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY o usa VERIFY_SKIP=true en local.',
      )
    }

    privateKey = privateKey.replace(/\\n/g, '\n')

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
    initialized = true
  }
  return admin.auth()
}
