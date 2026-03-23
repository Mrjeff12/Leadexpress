import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zyytzwlvtuhgbjpalbgd.supabase.co'
const STORAGE_KEY = 'sb-zyytzwlvtuhgbjpalbgd-auth-token'

export default function AutoLogin() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [debug, setDebug] = useState('')

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
      setDebug('Exchanging token...')

      const res = await fetch(`${SUPA_URL}/functions/v1/magic-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exchange', token }),
      })

      const data = await res.json()
      setDebug(`type=${data.type}, hasToken=${!!data.access_token}`)

      if (data.error) {
        setStatus('error')
        setError(data.error)
        return
      }

      if (data.type === 'session' && data.access_token && data.refresh_token) {
        // Write session to localStorage — bypasses setSession() which can hang
        // in WhatsApp's embedded browser. MUST use window.location.replace()
        // (not React Router navigate) so AuthProvider re-initializes from localStorage.
        const sessionData = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: parseJwt(data.access_token),
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
        setDebug('Session saved! Redirecting...')
        setStatus('success')

        // Hard navigate — full page reload so AuthProvider picks up the session
        // Default to /complete-account for new onboarding users
        setTimeout(() => {
          window.location.replace(data.redirect_path || '/complete-account')
        }, 600)
        return
      }

      setStatus('error')
      setError('No session received')
      setDebug(JSON.stringify(data).slice(0, 200))

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

      <p className="mt-8 text-xs text-slate-600 max-w-md text-center break-all">{debug}</p>
    </div>
  )
}

// Decode JWT payload to extract user info
function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return {
      id: payload.sub,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      aud: payload.aud,
      app_metadata: payload.app_metadata || {},
      user_metadata: payload.user_metadata || {},
    }
  } catch {
    return {}
  }
}
