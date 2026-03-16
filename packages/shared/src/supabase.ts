import { createClient } from '@supabase/supabase-js'

// Server-side client (services) — uses service role key, bypasses RLS
export function createServiceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  return createClient(url, key)
}

// Browser-side client (dashboard) — uses anon key, respects RLS
export function createBrowserClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  return createClient(url, key)
}
