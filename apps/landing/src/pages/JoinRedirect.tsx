import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const DASHBOARD_URL = 'https://app.leadexpress.co.il/login'
const COOKIE_DAYS = 30
const LS_KEY = 'le_ref'

function setRefCookie(code: string) {
  const expires = new Date()
  expires.setDate(expires.getDate() + COOKIE_DAYS)
  document.cookie = `le_ref=${encodeURIComponent(code)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

function setRefLocalStorage(code: string) {
  const expiry = Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000
  localStorage.setItem(LS_KEY, JSON.stringify({ code, expiry }))
}

export default function JoinRedirect() {
  const { code } = useParams<{ code: string }>()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!code) {
      setError(true)
      return
    }

    // Store referral attribution
    try {
      setRefCookie(code)
      setRefLocalStorage(code)
    } catch {
      // Storage may be blocked, continue with redirect
    }

    // Redirect to dashboard signup with ref param
    const redirectUrl = `${DASHBOARD_URL}?ref=${encodeURIComponent(code)}`

    // Small delay for visual feedback then redirect
    const timer = setTimeout(() => {
      window.location.href = redirectUrl
    }, 1200)

    return () => clearTimeout(timer)
  }, [code])

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-dark mb-2">Invalid Referral Link</h1>
          <p className="text-sm text-dark/40 mb-6">This referral link doesn't seem right. Try asking your partner for a new one.</p>
          <a
            href={DASHBOARD_URL}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#fe5b25] to-[#e04d1c] text-white px-6 py-3 text-sm font-semibold transition-all duration-300 hover:scale-105"
          >
            Go to Lead Express
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="text-center">
        {/* Spinner */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-dark/5" />
          <div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#fe5b25]"
            style={{ animation: 'spin 0.8s linear infinite' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#fe5b25] to-[#e04d1c] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-dark mb-2">Taking you to Lead Express</h1>
        <p className="text-sm text-dark/40">
          Referred by <span className="font-medium text-[#fe5b25]">{code}</span>
        </p>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
