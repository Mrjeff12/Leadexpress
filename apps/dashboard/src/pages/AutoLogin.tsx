import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

/**
 * /auto-login?token=xxx
 *
 * Exchanges a one-time magic token (from WhatsApp) for a Supabase session.
 * Flow: token → Edge Function validates → returns user_id → sign in → redirect
 */
export default function AutoLogin() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
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
  }, [params])

  async function exchangeToken(token: string) {
    try {
      // Exchange token via Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('magic-login', {
        body: { action: 'exchange', token },
      })

      if (fnError || data?.error) {
        setStatus('error')
        setError(data?.error || fnError?.message || 'Token exchange failed')
        return
      }

      // Session type: set tokens directly
      if (data?.type === 'session' && data?.access_token) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })

        if (sessErr) {
          setStatus('error')
          setError('Session error: ' + sessErr.message)
          return
        }

        setStatus('success')
        const redirectPath = data?.redirect_path || '/'
        // Full page reload to ensure AuthProvider picks up the new session
        setTimeout(() => {
          window.location.href = redirectPath
        }, 1500)
        return
      }

      // Legacy redirect type (fallback)
      if (data?.type === 'redirect' && data?.action_link) {
        setStatus('success')
        setTimeout(() => {
          window.location.href = data.action_link
        }, 1000)
        return
      }

      setStatus('error')
      setError('Unexpected response')

    } catch (err) {
      setStatus('error')
      setError(String(err))
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
          <p className="text-white text-lg font-semibold">Welcome to MasterLeadFlow!</p>
          <p className="text-slate-400 text-sm">Redirecting to your dashboard...</p>
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
