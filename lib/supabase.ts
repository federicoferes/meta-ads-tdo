import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Singleton — safe for Edge runtime (no Node.js APIs)
let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    })
  }
  return _client
}

export const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID ?? 'act_940819329720344'
// Snapshots de menos de 6 horas se consideran frescos
export const CACHE_TTL_HOURS = 6
