import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    '[LeadExpress] Missing Supabase environment variables.\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.\n' +
    'See .env.example for reference.'
  )
}

export const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',
    // Bypass Navigator Locks API which can deadlock in embedded browsers
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
})
