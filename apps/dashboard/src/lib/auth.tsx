import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type UserRole = 'contractor' | 'admin'

interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  telegram_chat_id: number | null
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ─── Demo / Dev mode ─── */
const IS_DEV = !import.meta.env.VITE_SUPABASE_URL

const DEMO_ACCOUNTS: Record<string, { password: string; profile: Profile }> = {
  'admin@leadexpress.com': {
    password: 'admin123',
    profile: {
      id: 'demo-admin-001',
      full_name: 'Jeff (Admin)',
      role: 'admin',
      telegram_chat_id: 123456789,
    },
  },
  'contractor@leadexpress.com': {
    password: 'contractor123',
    profile: {
      id: 'demo-contractor-001',
      full_name: 'Carlos Mendez',
      role: 'contractor',
      telegram_chat_id: 987654321,
    },
  },
}

function makeFakeUser(email: string, id: string): User {
  return {
    id,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    isAdmin: false,
  })

  async function fetchProfile(userId: string): Promise<Profile | null> {
    if (IS_DEV) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, telegram_chat_id')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) return null
    return data as Profile
  }

  async function refreshProfile() {
    if (!state.user) return
    const profile = await fetchProfile(state.user.id)
    if (profile) {
      setState((prev) => ({
        ...prev,
        profile,
        isAdmin: profile.role === 'admin',
      }))
    }
  }

  useEffect(() => {
    if (IS_DEV) {
      // In dev mode, auto-login as admin (no login screen needed)
      const savedEmail = localStorage.getItem('le-demo-email') || 'admin@leadexpress.com'
      const acct = DEMO_ACCOUNTS[savedEmail] ?? DEMO_ACCOUNTS['admin@leadexpress.com']
      localStorage.setItem('le-demo-email', savedEmail)
      setState({
        user: makeFakeUser(savedEmail, acct.profile.id),
        session: null,
        profile: acct.profile,
        loading: false,
        isAdmin: acct.profile.role === 'admin',
      })
      return
    }

    // Production: use Supabase auth
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null
      let profile: Profile | null = null
      if (user) profile = await fetchProfile(user.id)

      setState({
        user,
        session,
        profile,
        loading: false,
        isAdmin: profile?.role === 'admin',
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null
        let profile: Profile | null = null
        if (user) profile = await fetchProfile(user.id)

        setState({
          user,
          session,
          profile,
          loading: false,
          isAdmin: profile?.role === 'admin',
        })
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (IS_DEV) {
      const acct = DEMO_ACCOUNTS[email]
      if (!acct || acct.password !== password) {
        return { error: 'Invalid email or password' }
      }
      localStorage.setItem('le-demo-email', email)
      setState({
        user: makeFakeUser(email, acct.profile.id),
        session: null,
        profile: acct.profile,
        loading: false,
        isAdmin: acct.profile.role === 'admin',
      })
      return { error: null }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string, name: string) => {
    if (IS_DEV) {
      // In dev mode, create a contractor account on-the-fly
      const profile: Profile = {
        id: `demo-${Date.now()}`,
        full_name: name,
        role: 'contractor',
        telegram_chat_id: null,
      }
      localStorage.setItem('le-demo-email', email)
      setState({
        user: makeFakeUser(email, profile.id),
        session: null,
        profile,
        loading: false,
        isAdmin: false,
      })
      return { error: null }
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    if (IS_DEV) {
      localStorage.removeItem('le-demo-email')
      setState({
        user: null,
        session: null,
        profile: null,
        loading: false,
        isAdmin: false,
      })
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
