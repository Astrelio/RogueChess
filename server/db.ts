import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is required (Neon connection string)')
}

export const sql = neon(url)
