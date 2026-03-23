import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { UserPlus, X, ArrowRight } from 'lucide-react'

/**
 * Soft nudge banner — shown on every page until the user adds email + password.
 * Checks if the user's email is a fake wa-* address (created by WhatsApp auto-signup).
 * Dismissible per session, but comes back on next visit.
 */
export default function CompleteAccountBanner() {
  const { profile } = useAuth()
  const [needsCompletion, setNeedsCompletion] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!profile?.id) return

    // Check if this is a WhatsApp-created account with fake email
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email || ''
      // Fake emails: wa-XXXX@app.masterleadflow.com
      if (email.startsWith('wa-') && email.includes('@app.masterleadflow.com')) {
        setNeedsCompletion(true)
      }
    })
  }, [profile?.id])

  if (!needsCompletion || dismissed) return null

  return (
    <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-sm text-amber-800 truncate">
            <span className="font-semibold">Complete your account</span>
            <span className="hidden sm:inline"> — add email & password so you can log in anytime</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/complete-account"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1f)' }}
          >
            Complete
            <ArrowRight className="w-3 h-3" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md hover:bg-amber-100 text-amber-400 hover:text-amber-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
