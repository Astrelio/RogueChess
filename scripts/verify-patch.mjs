import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const fn = await sql`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_buy_joker'
`
console.log(fn[0]?.def?.includes('FROM match_moves mm') ? 'buy fix ok' : 'buy fix MISSING')
console.log(fn[0]?.def?.slice(0, 200))

const shop = await sql`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_open_shop_for_player'
`
console.log(shop[0]?.def?.includes('0..3') ? 'shop 4 slots ok' : 'shop slots check')
console.log(shop[0]?.def?.includes('v_picked') ? 'dedupe ok' : 'dedupe MISSING')
