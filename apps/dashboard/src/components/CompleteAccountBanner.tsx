import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { AlertTriangle, ArrowRight } from 'lucide-react'

/**
 * Persistent banner — shown on every page until the user adds email + password.
 * NOT dismissible — completing the account is required.
 */
export default function CompleteAccountBanner() {
  const { profile } = useAuth()
  const [needsCompletion, setNeedsCompletion] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data?.user) return
      const email = data.user.email || ''
      const hasOAuth = data.user.app_metadata?.provider && data.user.app_metadata.provider !== 'email'
      // OAuth users (Google/Apple) don't need to set email+password
      if (hasOAuth) return
      if (!email || (email.startsWith('wa-') && email.includes('@app.masterleadflow.com'))) {
        setNeedsCompletion(true)
      }
    })
  }, [profile?.id])

  if (!needsCompletion) return null

  return (
    <div className="relative bg-gradient-to-r from-red-500 to-orange-500">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
          <p className="text-sm text-white font-semibold truncate">
            ⚠️ Complete your account — required to receive leads
          </p>
        </div>
        <Link
          to="/complete-account"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-white text-red-600 flex-shrink-0 active:scale-[0.97] transition-transform"
        >
          Complete Now
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
