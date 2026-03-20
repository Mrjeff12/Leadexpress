import { useState, useEffect, type ReactNode } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Clock, ArrowLeft } from 'lucide-react'

export default function RequirePartner({ children }: { children: ReactNode }) {
  const { effectiveUserId, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const he = locale === 'he'
  const [status, setStatus] = useState<'loading' | 'active' | 'pending' | 'none'>('loading')

  useEffect(() => {
    if (authLoading || !effectiveUserId) return

    supabase
      .from('community_partners')
      .select('status')
      .eq('user_id', effectiveUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'active') {
          setStatus('active')
        } else if (data?.status === 'pending') {
          setStatus('pending')
        } else {
          setStatus('none')
        }
      })
  }, [effectiveUserId, authLoading])

  if (authLoading || status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="le-bg" />
        <div className="le-grain" />
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
            style={{ background: 'hsl(14 99% 57%)' }}>
            LE
          </div>
          <div className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-zinc-50">
        <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-white border border-zinc-200 shadow-lg text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-6">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 mb-2">
            {he ? 'הבקשה שלך בבדיקה' : 'Application Under Review'}
          </h1>
          <p className="text-sm text-zinc-500 mb-1">
            {he
              ? 'בקשת השותפות שלך התקבלה ונמצאת בבדיקה.'
              : 'Your partner application has been received and is being reviewed.'}
          </p>
          <p className="text-sm text-zinc-400 mb-8">
            {he
              ? 'נעדכן אותך ברגע שהבקשה תאושר.'
              : "We'll notify you once your application is approved."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 border border-zinc-200 hover:bg-zinc-50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            {he ? 'חזרה לדשבורד' : 'Back to Dashboard'}
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'none') return <Navigate to="/partner/join" replace />

  return <>{children}</>
}
