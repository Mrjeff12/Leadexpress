import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zyytzwlvtuhgbjpalbgd.supabase.co'
const SUPA_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export default function AutoLogin() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setError('No token provided')
      return
    }
    exchangeToken(token)
  }, [])

  async function exchangeToken(token: string) {
    try {
      const res = await fetch(`${SUPA_URL}/functions/v1/magic-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPA_ANON_KEY,
        },
        body: JSON.stringify({ action: 'exchange', token }),
      })

      if (!res.ok) {
        setStatus('error')
        setError(`Login service error (${res.status}). Please request a new link.`)
        return
      }

      let data
      try {
        data = await res.json()
      } catch {
        setStatus('error')
        setError('Unexpected response from login service. Please try again.')
        return
      }

      if (data.error) {
        setStatus('error')
        setError(data.error)
        return
      }

      if (data.type === 'session' && data.access_token && data.refresh_token) {
        // Use Supabase client to properly set the session
        // This ensures the full user object is fetched and stored correctly
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })

        if (sessionError) {
          setStatus('error')
          setError('Could not save your session. Try opening this link in your phone\'s default browser instead of WhatsApp.')
          return
        }

        // Set onboarding step for tracking
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase.from('contractors').update({ onboarding_step: 'registered' }).eq('user_id', user.id)
          }
        } catch {} // non-critical, don't block login flow

        setStatus('success')

        const safePath = (data.redirect_path && data.redirect_path.startsWith('/') && !data.redirect_path.startsWith('//'))
          ? data.redirect_path : '/complete-account'
        setTimeout(() => {
          window.location.replace(safePath)
        }, 600)
        return
      }

      setStatus('error')
      setError('No session received')

    } catch (err) {
      setStatus('error')
      setError('Login failed. Please request a new link from WhatsApp.')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #0a0a1a 0%, #12122a 100%)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
            <div className="absolute inset-0 w-12 h-12 rounded-full animate-ping opacity-20 bg-purple-500" />
          </div>
          <p className="text-white text-lg font-semibold">Signing you in...</p>
          <p className="text-slate-500 text-sm">Please wait</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <p className="text-white text-lg font-semibold">Welcome!</p>
          <p className="text-slate-400 text-sm">Redirecting...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <XCircle className="w-12 h-12 text-red-500" />
          <p className="text-white text-lg font-semibold">Login Failed</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <a
            href="/login"
            className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
            }}
          >
            Go to Login
          </a>
        </div>
      )}
    </div>
  )
}
