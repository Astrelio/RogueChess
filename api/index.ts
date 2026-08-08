import type { VercelRequest, VercelResponse } from '@vercel/node'
import app from '../server/app.js'

/**
 * Express como función serverless en Vercel.
 * vercel.json reescribe /api/* → aquí.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1])
}
