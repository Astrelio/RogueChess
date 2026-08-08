import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

type Sql = NeonQueryFunction<false, false>

let cached: Sql | null = null

function getSql(): Sql {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required (Neon connection string)')
  }
  cached = neon(url)
  return cached
}

/** Lazy: no falla al importar el módulo (así /api/health puede responder en Vercel). */
export const sql: Sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  getSql()(strings, ...values)) as Sql
