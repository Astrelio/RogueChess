import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ws from 'ws'
import { neonConfig, Pool } from '@neondatabase/serverless'

neonConfig.webSocketConstructor = ws

const file = process.argv[2] || 'db/patch_phase2_shop_fixes.sql'
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL missing')
  process.exit(1)
}

const sqlText = readFileSync(resolve(process.cwd(), file), 'utf8')
const pool = new Pool({ connectionString: url })
try {
  await pool.query(sqlText)
  console.log('Applied', file)
} finally {
  await pool.end()
}
