import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(url, key, {
  auth: {
    flowType: 'implicit',
    // Bypass Navigator Locks API which can deadlock in embedded browsers
    lock: (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
  },
})
