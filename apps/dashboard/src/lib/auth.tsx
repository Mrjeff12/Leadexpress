import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type UserRole = 'contractor' | 'admin' | 'publisher'

interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  roles: UserRole[]
  telegram_chat_id: number | null
  publisher_bio?: string | null
  publisher_company_name?: string | null
  publisher_verified?: boolean
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
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsVerification?: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  impersonate: (userId: string) => Promise<void>
  stopImpersonating: () => void
  effectiveUserId: string | undefined
  activeRole: UserRole
  switchRole: (role: UserRole) => void
  isPublisher: boolean
  addPublisherRole: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const IMPERSONATE_KEY = 'leadexpress_impersonate'
const ACTIVE_ROLE_KEY = 'leadexpress_active_role'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    return (localStorage.getItem(ACTIVE_ROLE_KEY) as UserRole) || 'contractor'
  })

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
      .select('id, full_name, role, roles, telegram_chat_id, publisher_bio, publisher_company_name, publisher_verified')
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
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem(IMPERSONATE_KEY)
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            isAdmin: false,
            impersonatedUserId: null,
            impersonatedProfile: null,
          })
          return
        }

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) return { error: error.message }

    // Supabase returns user with empty identities when the email already exists
    if (data.user && data.user.identities?.length === 0) {
      return { error: 'An account with this email already exists.' }
    }

    // If email confirmation is required, session will be null
    if (data.user && !data.session) {
      return { error: null, needsVerification: true }
    }

    return { error: null }
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
    await supabase.from('audit_logs').insert({
      user_id: state.user?.id,
      action: 'impersonate_start',
      resource_type: 'user',
      resource_id: userId,
      details: { admin_email: state.user?.email },
    })
  }

  const stopImpersonating = () => {
    const previousImpersonatedId = state.impersonatedUserId
    localStorage.removeItem(IMPERSONATE_KEY)
    setState((prev) => ({
      ...prev,
      impersonatedUserId: null,
      impersonatedProfile: null,
    }))
    if (previousImpersonatedId) {
      supabase.from('audit_logs').insert({
        user_id: state.user?.id,
        action: 'impersonate_stop',
        resource_type: 'user',
        resource_id: previousImpersonatedId,
      })
    }
  }

  useEffect(() => {
    if (!state.isAdmin || state.loading) return
    const savedId = localStorage.getItem(IMPERSONATE_KEY)
    if (savedId && !state.impersonatedUserId) {
      impersonate(savedId).catch(() => localStorage.removeItem(IMPERSONATE_KEY))
    }
  }, [state.isAdmin, state.loading])

  const effectiveUserId = state.impersonatedUserId || state.user?.id

  const switchRole = useCallback((role: UserRole) => {
    const roles = state.profile?.roles || ['contractor']
    if (roles.includes(role)) {
      setActiveRole(role)
      localStorage.setItem(ACTIVE_ROLE_KEY, role)
    }
  }, [state.profile])

  const isPublisher = useMemo(() => {
    return state.profile?.roles?.includes('publisher') ?? false
  }, [state.profile])

  const addPublisherRole = useCallback(async () => {
    if (!state.user) return
    const currentRoles = state.profile?.roles || ['contractor']
    if (currentRoles.includes('publisher')) return
    const newRoles = [...currentRoles, 'publisher'] as UserRole[]
    const { error } = await supabase
      .from('profiles')
      .update({ roles: newRoles })
      .eq('id', state.user.id)
    if (!error) {
      await refreshProfile()
      switchRole('publisher')
    }
  }, [state.user, state.profile, refreshProfile, switchRole])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile, impersonate, stopImpersonating, effectiveUserId, activeRole, switchRole, isPublisher, addPublisherRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
