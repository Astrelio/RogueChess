import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const ply = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'match_moves' AND column_name = 'ply'
`
console.log('ply cols', ply)

const cons = await sql`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'shop_offers'::regclass
`
console.log('shop_offers constraints', cons)
