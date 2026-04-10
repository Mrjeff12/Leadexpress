import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
if (!SUPA_URL) throw new Error('VITE_SUPABASE_URL environment variable is required')
const SUPA_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const MAX_RETRIES = 2
const TIMEOUT_MS = 15_000

export default function AutoLogin() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const retryCount = useRef(0)

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
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const res = await fetch(`${SUPA_URL}/functions/v1/magic-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPA_ANON_KEY,
        },
        body: JSON.stringify({ action: 'exchange', token }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        // Auto-retry on server errors
        if (res.status >= 500 && retryCount.current < MAX_RETRIES) {
          retryCount.current++
          setRetrying(true)
          await new Promise(r => setTimeout(r, 1500))
          setRetrying(false)
          return exchangeToken(token)
        }
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
        // Store session directly in localStorage — avoids setSession() hanging
        // in WhatsApp's in-app browser and other embedded WebViews.
        // Supabase client picks these up automatically on next page load.
        const storageKey = `sb-${new URL(SUPA_URL).hostname.split('.')[0]}-auth-token`
        const sessionPayload: Record<string, unknown> = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_type: data.token_type || 'bearer',
          expires_in: data.expires_in || 3600,
          expires_at: data.expires_at || Math.floor(Date.now() / 1000) + 3600,
        }
        // Include user object so Supabase doesn't need an extra API call on init
        if (data.user) sessionPayload.user = data.user
        try {
          localStorage.setItem(storageKey, JSON.stringify(sessionPayload))
        } catch {
          // Fallback: try setSession with a tight timeout
          const sessionPromise = supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          })
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('setSession timeout')), 5000)
          )
          try {
            await Promise.race([sessionPromise, timeoutPromise])
          } catch {
            setStatus('error')
            setError('Could not save your session. Try opening this link in your phone\'s default browser.')
            return
          }
        }

        setStatus('success')

        // Legacy tokens from Rebeca may still carry /complete-account — redirect them to /onboarding
        const rawPath = data.redirect_path === '/complete-account' ? '/onboarding' : data.redirect_path
        const safePath = (rawPath && rawPath.startsWith('/') && !rawPath.startsWith('//'))
          ? rawPath : '/onboarding'
        // Hard redirect — forces Supabase client to re-initialize with stored tokens
        setTimeout(() => {
          window.location.replace(safePath)
        }, 400)
        return
      }

      setStatus('error')
      setError('No session received')

    } catch (err: any) {
      // Timeout or network error — auto-retry
      if (err?.name === 'AbortError' && retryCount.current < MAX_RETRIES) {
        retryCount.current++
        setRetrying(true)
        await new Promise(r => setTimeout(r, 1000))
        setRetrying(false)
        return exchangeToken(params.get('token')!)
      }
      setStatus('error')
      setError(err?.name === 'AbortError'
        ? 'Connection timed out. Please check your internet and try again.'
        : 'Login failed. Please request a new link from WhatsApp.')
    }
  }

  function handleRetry() {
    const token = params.get('token')
    if (!token) return
    retryCount.current = 0
    setStatus('loading')
    setError('')
    exchangeToken(token)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: '#0a0a0a',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#ff6b35' }} />
            <div
              className="absolute inset-0 w-12 h-12 rounded-full animate-ping"
              style={{ background: 'rgba(255,107,53,0.2)' }}
            />
          </div>
          <p
            className="text-lg font-semibold"
            style={{ color: retrying ? '#636366' : '#fff', letterSpacing: '-0.03em' }}
          >
            {retrying ? 'Retrying...' : 'Signing you in...'}
          </p>
          <p className="text-sm" style={{ color: '#636366' }}>Please wait</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-4">
          <CheckCircle className="w-12 h-12" style={{ color: '#30d158' }} />
          <p className="text-lg font-semibold" style={{ color: '#fff', letterSpacing: '-0.03em' }}>Welcome!</p>
          <p className="text-sm" style={{ color: '#636366' }}>Redirecting...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,69,58,0.12)' }}
          >
            <XCircle className="w-8 h-8" style={{ color: '#ff453a' }} />
          </div>
          <p className="text-lg font-semibold" style={{ color: '#fff', letterSpacing: '-0.03em' }}>Login Failed</p>
          <p className="text-sm" style={{ color: '#a1a1a6' }}>{error}</p>

          <button
            onClick={handleRetry}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: '#ff6b35',
              boxShadow: '0 0 20px rgba(255,107,53,0.25)',
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <a
            href="/login"
            className="text-xs transition-colors"
            style={{ color: '#636366' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#a1a1a6')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#636366')}
          >
            Or sign in with email
          </a>
        </div>
      )}
    </div>
  )
}
