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
  impersonatedUserId: string | null
  impersonatedProfile: Profile | null
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  impersonate: (userId: string) => Promise<void>
  stopImpersonating: () => void
  effectiveUserId: string | undefined
}

const AuthContext = createContext<AuthContextValue | null>(null)

const IMPERSONATE_KEY = 'leadexpress_impersonate'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    isAdmin: false,
    impersonatedUserId: null,
    impersonatedProfile: null,
  })

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, telegram_chat_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[Auth] fetchProfile error:', error.message)
      return null
    }
    if (!data) {
      console.warn('[Auth] fetchProfile: no profile found for', userId)
      return null
    }
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
        impersonatedUserId: null,
        impersonatedProfile: null,
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
          impersonatedUserId: null,
          impersonatedProfile: null,
        })
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    localStorage.removeItem(IMPERSONATE_KEY)
    await supabase.auth.signOut()
  }

  const impersonate = async (userId: string) => {
    if (!state.isAdmin) throw new Error('Only admins can impersonate users')
    const profile = await fetchProfile(userId)
    if (!profile) throw new Error('Could not fetch profile for user')
    localStorage.setItem(IMPERSONATE_KEY, userId)
    setState((prev) => ({
      ...prev,
      impersonatedUserId: userId,
      impersonatedProfile: profile,
    }))
  }

  const stopImpersonating = () => {
    localStorage.removeItem(IMPERSONATE_KEY)
    setState((prev) => ({
      ...prev,
      impersonatedUserId: null,
      impersonatedProfile: null,
    }))
  }

  useEffect(() => {
    if (!state.isAdmin || state.loading) return
    const savedId = localStorage.getItem(IMPERSONATE_KEY)
    if (savedId && !state.impersonatedUserId) {
      impersonate(savedId).catch(() => localStorage.removeItem(IMPERSONATE_KEY))
    }
  }, [state.isAdmin, state.loading])

  const effectiveUserId = state.impersonatedUserId || state.user?.id

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile, impersonate, stopImpersonating, effectiveUserId }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
