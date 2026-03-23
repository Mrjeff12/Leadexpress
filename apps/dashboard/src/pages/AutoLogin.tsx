import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zyytzwlvtuhgbjpalbgd.supabase.co'

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

      // Direct fetch to Edge Function (bypassing supabase.functions.invoke)
      const res = await fetch(`${SUPA_URL}/functions/v1/magic-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exchange', token }),
      })

      const data = await res.json()
      setDebug(`Response: type=${data.type}, hasToken=${!!data.access_token}, error=${data.error || 'none'}`)

      if (data.error) {
        setStatus('error')
        setError(data.error)
        return
      }

      // Direct session — no redirects, no race conditions
      if (data.type === 'session' && data.access_token && data.refresh_token) {
        setDebug('Setting session directly...')
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        if (sessErr) {
          setStatus('error')
          setError(sessErr.message)
          return
        }
        setStatus('success')
        // Small delay to let AuthProvider pick up the session
        setTimeout(() => {
          window.location.href = data.redirect_path || '/'
        }, 500)
        return
      }

      // Fallback: redirect-based flow
      if (data.verify_url) {
        setDebug('Redirecting to Supabase auth...')
        setStatus('success')
        window.location.href = data.verify_url
        return
      }

      setStatus('error')
      setError('No session received')
      setDebug('Full response: ' + JSON.stringify(data))

    } catch (err) {
      setStatus('error')
      setError(String(err))
      setDebug('Exception: ' + String(err))
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

      {/* Debug info — remove after testing */}
      <p className="mt-8 text-xs text-slate-600 max-w-md text-center break-all">{debug}</p>
    </div>
  )
}
