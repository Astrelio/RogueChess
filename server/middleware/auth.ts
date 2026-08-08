import type { Request, Response, NextFunction } from 'express'
import { getAdminAuth } from '../firebaseAdmin.js'

export type AuthUser = { uid: string; email?: string }

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing bearer token' })
      return
    }
    const token = header.slice('Bearer '.length).trim()

    if (process.env.VERIFY_SKIP === 'true' && process.env.NODE_ENV !== 'production') {
      // Dev-only: token format "dev:<uid>:<email?>"
      if (token.startsWith('dev:')) {
        const [, uid, email] = token.split(':')
        if (!uid) {
          res.status(401).json({ error: 'invalid dev token' })
          return
        }
        req.user = { uid, email }
        next()
        return
      }
    }

    const decoded = await getAdminAuth().verifyIdToken(token)
    req.user = { uid: decoded.uid, email: decoded.email }
    next()
  } catch (err) {
    console.error('auth error', err)
    res.status(401).json({ error: 'invalid token' })
  }
}
