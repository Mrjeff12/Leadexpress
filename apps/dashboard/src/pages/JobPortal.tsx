import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MapPin, FileText, CheckCircle, XCircle, Globe, Shield, Loader2, Star, Users, Zap, ArrowRight } from 'lucide-react'

type PortalLang = 'en' | 'he'
const t = (lang: PortalLang, en: string, he: string) => lang === 'he' ? he : en

interface Job {
  id: string
  lead_id: string
  contractor_id: string
  subcontractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  created_at: string
  updated_at: string
  contractor_name: string
  lead: {
    city: string | null
    zip_code: string | null
    urgency: string | null
    summary: string | null
    description: string | null
    sender_id: string | null
    profession: string | null
  }
}

// ── Inline styles for the portal (self-contained, no tailwind config needed) ──
const BRAND = '#fe5b25'
const BRAND_DARK = '#e04d1c'
const BG = '#f8f6f3'

export default function JobPortal() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [signupName, setSignupName] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [lang, setLang] = useState<PortalLang>(() => {
    const saved = localStorage.getItem('le-portal-lang') as PortalLang | null
    return saved === 'he' ? 'he' : 'en'
  })

  const toggleLang = () => {
    const next = lang === 'en' ? 'he' : 'en'
    setLang(next)
    localStorage.setItem('le-portal-lang', next)
  }

  useEffect(() => {
    async function fetchJob() {
      if (!token) return
      try {
        const { data, error: rpcError } = await supabase.rpc('get_job_order_by_token', { token })
        if (rpcError) throw rpcError
        if (!data) throw new Error('Job not found')
        const jobData = data as unknown as Job
        setJob(jobData)
        if (jobData.lead?.sender_id) {
          const phone = jobData.lead.sender_id.replace(/@.*$/, '')
          setSignupPhone(phone.startsWith('+') ? phone : `+${phone}`)
        }
        supabase.from('job_orders').update({ viewed_at: new Date().toISOString() }).eq('id', jobData.id).then(() => {})
      } catch (err: any) {
        setError(err.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [token])

  const handleApprove = async () => {
    if (!token) return
    setActionLoading(true)
    try {
      const { data, error } = await supabase.rpc('update_job_order_status_by_token', { token, new_status: 'accepted' })
      if (error) throw error
      if (!data) throw new Error('Failed')
      setJob(data as unknown as Job)
      setShowSignup(true)
    } catch {
      alert(t(lang, 'Something went wrong. Please try again.', 'משהו השתבש. נסה שוב.'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDecline = async () => {
    if (!token) return
    setActionLoading(true)
    try {
      const { data, error } = await supabase.rpc('update_job_order_status_by_token', { token, new_status: 'rejected' })
      if (error) throw error
      if (!data) throw new Error('Failed')
      setJob(data as unknown as Job)
    } catch {
      alert(t(lang, 'Something went wrong.', 'משהו השתבש.'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleSignup = async () => {
    if (!signupName.trim() || !signupPhone.trim()) return
    setSignupLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: signupName.trim(), phone: signupPhone.trim(), job_order_id: job?.id }),
      })
      if (res.ok) setSignupDone(true)
      else alert(t(lang, 'Registration failed. Try again.', 'ההרשמה נכשלה. נסה שוב.'))
    } catch {
      alert(t(lang, 'Network error.', 'שגיאת רשת.'))
    } finally {
      setSignupLoading(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
            <p className="text-sm" style={{ color: '#9a9590' }}>{t(lang, 'Loading job details...', 'טוען פרטי עבודה...')}</p>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Error ──
  if (error || !job) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#fef2ef' }}>
            <XCircle className="w-10 h-10" style={{ color: '#e8a99a' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1a1614' }}>{t(lang, 'Link Expired', 'הקישור פג תוקף')}</h1>
          <p className="text-sm text-center" style={{ color: '#9a9590', maxWidth: 280 }}>
            {t(lang, 'This job link is no longer valid or has already been used.', 'קישור העבודה הזה כבר לא תקף או שכבר נעשה בו שימוש.')}
          </p>
        </div>
      </Shell>
    )
  }

  const contractorName = job.contractor_name || t(lang, 'A contractor', 'קבלן')
  const lead = job.lead || { city: null, zip_code: null, urgency: null, summary: null, description: null, sender_id: null, profession: null }
  const profession = (lead.profession || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ') || t(lang, 'Your area', 'האזור שלך')
  const isPending = job.status === 'pending'
  const isAccepted = job.status === 'accepted'
  const isRejected = job.status === 'rejected'

  // ── Signup success ──
  if (signupDone) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#ecfdf5' }}>
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-center" style={{ color: '#1a1614', fontFamily: "'Georgia', serif" }}>
            {t(lang, "You're all set!", 'הכל מוכן!')}
          </h1>
          <p className="text-sm text-center" style={{ color: '#9a9590', maxWidth: 300, lineHeight: 1.6 }}>
            {t(lang,
              "We'll send you a link to your dashboard where you can track this job and manage everything in one place.",
              'נשלח לך לינק לממשק שלך — שם תוכל לעקוב אחרי העבודה ולנהל הכל במקום אחד.'
            )}
          </p>
          <div className="flex items-center gap-2 mt-2 px-4 py-2 rounded-full" style={{ background: '#fff4ef' }}>
            <Zap className="w-4 h-4" style={{ color: BRAND }} />
            <span className="text-xs font-semibold" style={{ color: BRAND_DARK }}>
              {t(lang, 'MasterLeadFlow — Your jobs, organized', 'MasterLeadFlow — העבודות שלך, מסודרות')}
            </span>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Signup form (after approval) ──
  if (showSignup && isAccepted) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 px-5 pt-8 pb-8 max-w-md mx-auto w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#ecfdf5' }}>
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a1614', fontFamily: "'Georgia', serif" }}>
              {t(lang, 'Job Approved!', 'העבודה אושרה!')}
            </h1>
            <p className="text-sm" style={{ color: '#9a9590', lineHeight: 1.6 }}>
              {t(lang,
                'Create your free account to track this job and discover more contractors',
                'צור חשבון חינמי כדי לעקוב אחרי העבודה ולמצוא עוד קבלנים'
              )}
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#fff', border: '1px solid #e8e4e0', boxShadow: '0 4px 24px rgba(26,22,20,0.06)' }}>
            <div className="px-5 py-3.5" style={{ background: '#faf9f7', borderBottom: '1px solid #f0ece8' }}>
              <span className="text-sm font-bold" style={{ color: '#5a5450', letterSpacing: '-0.01em' }}>
                {t(lang, 'Quick Setup', 'הרשמה מהירה')}
              </span>
            </div>
            <div className="px-5 py-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9a9590' }}>
                  {t(lang, 'YOUR NAME', 'השם שלך')}
                </label>
                <input
                  type="text"
                  value={signupName}
                  onChange={e => setSignupName(e.target.value)}
                  placeholder={t(lang, 'Full name', 'שם מלא')}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ border: '1.5px solid #e8e4e0', background: '#faf9f7', color: '#1a1614' }}
                  onFocus={e => { e.target.style.borderColor = BRAND; e.target.style.boxShadow = `0 0 0 3px ${BRAND}20` }}
                  onBlur={e => { e.target.style.borderColor = '#e8e4e0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9a9590' }}>
                  {t(lang, 'PHONE NUMBER', 'מספר טלפון')}
                </label>
                <input
                  type="tel"
                  value={signupPhone}
                  onChange={e => setSignupPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ border: '1.5px solid #e8e4e0', background: '#faf9f7', color: '#1a1614' }}
                  dir="ltr"
                  onFocus={e => { e.target.style.borderColor = BRAND; e.target.style.boxShadow = `0 0 0 3px ${BRAND}20` }}
                  onBlur={e => { e.target.style.borderColor = '#e8e4e0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSignup}
            disabled={signupLoading || !signupName.trim() || !signupPhone.trim()}
            className="w-full rounded-xl py-4 text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, boxShadow: '0 6px 20px rgba(254,91,37,0.35)' }}
          >
            {signupLoading
              ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              : <span className="flex items-center justify-center gap-2">
                  {t(lang, 'Create Free Account', 'צור חשבון חינמי')}
                  <ArrowRight className="w-4 h-4" />
                </span>}
          </button>

          <div className="flex items-center justify-center gap-4 mt-5">
            <span className="flex items-center gap-1 text-[11px]" style={{ color: '#b5b0ab' }}>
              <Shield className="w-3 h-3" /> {t(lang, 'Secure', 'מאובטח')}
            </span>
            <span className="text-[11px]" style={{ color: '#d5d0cb' }}>|</span>
            <span className="text-[11px]" style={{ color: '#b5b0ab' }}>
              {t(lang, 'Free forever', 'חינם לנצח')}
            </span>
            <span className="text-[11px]" style={{ color: '#d5d0cb' }}>|</span>
            <span className="text-[11px]" style={{ color: '#b5b0ab' }}>
              {t(lang, 'No credit card', 'ללא כ.א.')}
            </span>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Rejected ──
  if (isRejected) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#f5f4f2' }}>
            <XCircle className="w-10 h-10" style={{ color: '#c5c0ba' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1a1614' }}>{t(lang, 'Job Declined', 'העבודה נדחתה')}</h1>
          <p className="text-sm text-center" style={{ color: '#9a9590' }}>
            {t(lang, 'No worries. The contractor has been notified.', 'אין בעיה. הקבלן קיבל הודעה.')}
          </p>
        </div>
      </Shell>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN: Pending approval
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <Shell lang={lang} toggleLang={toggleLang}>
      <div className="flex-1 pb-48">
        {/* ── Hero gradient header ── */}
        <div className="relative overflow-hidden" style={{
          background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 50%, #c43d10 100%)`,
          padding: '40px 24px 56px',
        }}>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: '#fff', transform: 'translate(30%, -50%)' }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-[0.07]" style={{ background: '#fff', transform: 'translate(-30%, 40%)' }} />

          <div className="relative max-w-md mx-auto text-center">
            {/* Contractor avatar */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(8px)', border: '2px solid rgba(255,255,255,0.3)' }}>
              {contractorName.charAt(0).toUpperCase()}
            </div>

            <h1 className="text-[22px] font-bold text-white mb-2" style={{ fontFamily: "'Georgia', serif", lineHeight: 1.3 }}>
              {t(lang,
                `${contractorName} wants to take your job`,
                `${contractorName} רוצה לקחת את העבודה שלך`
              )}
            </h1>
            <p className="text-sm text-white/70">
              {t(lang,
                'Review the details and approve to get started',
                'בדוק את הפרטים ואשר כדי להתחיל'
              )}
            </p>
          </div>
        </div>

        {/* ── Content area (overlaps hero) ── */}
        <div className="px-4 -mt-8 max-w-md mx-auto">
          {/* Job Details Card */}
          <div className="rounded-2xl overflow-hidden mb-5" style={{
            background: '#fff',
            border: '1px solid #e8e4e0',
            boxShadow: '0 8px 32px rgba(26,22,20,0.08)',
          }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ background: '#faf9f7', borderBottom: '1px solid #f0ece8' }}>
              <FileText className="w-4 h-4" style={{ color: '#b5b0ab' }} />
              <span className="text-sm font-bold" style={{ color: '#5a5450', letterSpacing: '-0.01em' }}>
                {t(lang, 'Job Details', 'פרטי העבודה')}
              </span>
            </div>
            <div className="px-5 py-5 space-y-4">
              {profession && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#fff4ef' }}>
                    <Zap className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase" style={{ color: '#b5b0ab', letterSpacing: '0.05em' }}>
                      {t(lang, 'Service', 'שירות')}
                    </p>
                    <p className="text-[15px] font-bold" style={{ color: '#1a1614' }}>{profession}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#f0f7ff' }}>
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: '#b5b0ab', letterSpacing: '0.05em' }}>
                    {t(lang, 'Location', 'מיקום')}
                  </p>
                  <p className="text-[15px] font-semibold" style={{ color: '#1a1614' }}>{location}</p>
                </div>
              </div>
              {(lead.summary || lead.description) && (
                <div className="pt-3" style={{ borderTop: '1px solid #f5f3f0' }}>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#7a7570' }}>
                    {lead.summary || lead.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* What is MasterLeadFlow */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: '#fff', border: '1px solid #e8e4e0' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-[9px]" style={{ background: BRAND }}>M</div>
              <span className="text-xs font-bold" style={{ color: '#5a5450' }}>
                {t(lang, 'Powered by MasterLeadFlow', 'מופעל ע"י MasterLeadFlow')}
              </span>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Shield className="w-3.5 h-3.5" />, en: 'Secure job tracking & documentation', he: 'מעקב ותיעוד עבודה מאובטח' },
                { icon: <Users className="w-3.5 h-3.5" />, en: 'Trusted by 500+ contractors', he: 'בשימוש 500+ קבלנים' },
                { icon: <Star className="w-3.5 h-3.5" />, en: 'Free to use — no hidden fees', he: 'חינם לשימוש — ללא עלויות נסתרות' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#faf9f7', color: '#b5b0ab' }}>
                    {item.icon}
                  </div>
                  <span className="text-[13px]" style={{ color: '#7a7570' }}>
                    {t(lang, item.en, item.he)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Social proof strip */}
          <div className="flex items-center justify-center gap-1.5 mb-2">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            ))}
            <span className="text-[11px] ml-1" style={{ color: '#b5b0ab' }}>
              {t(lang, '4.9 from contractors', '4.9 מקבלנים')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Sticky bottom CTA ── */}
      {isPending && (
        <div className="fixed bottom-0 left-0 right-0" style={{ background: `linear-gradient(transparent, ${BG} 24%)` }}>
          <div className="p-4 pb-7 max-w-md mx-auto">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="w-full rounded-xl py-4 text-[15px] font-bold text-white mb-2.5 transition-all active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`, boxShadow: '0 6px 24px rgba(254,91,37,0.4)' }}
            >
              {actionLoading
                ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                : <span className="flex items-center justify-center gap-2">
                    {t(lang, 'Approve Job', 'אשר עבודה')}
                    <ArrowRight className="w-4 h-4" />
                  </span>}
            </button>
            <button
              onClick={handleDecline}
              disabled={actionLoading}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
              style={{ background: '#fff', border: '1px solid #e8e4e0', color: '#9a9590' }}
            >
              {t(lang, 'Decline', 'דחה')}
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}

// ── Shell wrapper ──
function Shell({ lang, toggleLang, children }: { lang: PortalLang; toggleLang: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {/* Nav */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: '#fff', borderBottom: '1px solid #eae6e2' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: BRAND }}>M</div>
          <span className="text-sm font-bold" style={{ color: '#1a1614', letterSpacing: '-0.02em' }}>MasterLeadFlow</span>
        </div>
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all hover:opacity-80"
          style={{ background: '#f5f3f0', color: '#9a9590' }}
        >
          <Globe className="w-3 h-3" />
          {lang === 'en' ? 'עברית' : 'EN'}
        </button>
      </div>
      {children}
    </div>
  )
}
