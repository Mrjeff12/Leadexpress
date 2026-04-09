import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  MapPin, CheckCircle, XCircle, Globe, Shield, Loader2, Star,
  Zap, ArrowRight, ClipboardList, RefreshCw, Award,
  Wrench, ChevronDown
} from 'lucide-react'

// ── Types & helpers ─────────────────────────────────────────────────────────
type PortalLang = 'en' | 'he'
const t = (lang: PortalLang, en: string, he: string) => lang === 'he' ? he : en

interface ContractorProfile {
  avatar_url: string | null
  avg_rating: number
  review_count: number
  tier: string
  years_experience: number | null
  bio: string | null
  headline: string | null
  completion_rate: number
  professions: string[] | null
}

interface Job {
  id: string
  lead_id: string
  contractor_id: string | null
  publisher_user_id: string | null
  subcontractor_id: string | null
  deal_type: string
  deal_value: string
  status: string
  created_at: string
  updated_at: string
  portal_mode: 'publisher_signup' | 'contractor_signup' | 'complete'
  contractor_name: string
  contractor_profile?: ContractorProfile
  publisher_name?: string
  publisher_profile?: ContractorProfile
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

const BRAND = '#ff6b35'

// ── Tailwind-style animation keyframes ─────────────────────────────────────
const DARK_ANIM = `
@keyframes animIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes checkPop {
  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
  50% { transform: scale(1.15) rotate(0deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes gentleBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.animate-in   { animation: animIn 0.45s ease-out both; }
.animate-in-1 { animation: animIn 0.45s ease-out 0.08s both; }
.animate-in-2 { animation: animIn 0.45s ease-out 0.16s both; }
.animate-in-3 { animation: animIn 0.45s ease-out 0.24s both; }
.animate-in-4 { animation: animIn 0.45s ease-out 0.32s both; }
.animate-check { animation: checkPop 0.55s ease-out 0.25s both; }
.animate-bounce-subtle { animation: gentleBounce 2s ease-in-out infinite; }
`

// ── Main Component ──────────────────────────────────────────────────────────
export default function JobPortal() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [signupName, setSignupName] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [leadAddress, setLeadAddress] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [myEarnings, setMyEarnings] = useState('')
  const [subPay, setSubPay] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null) // null = checking
  const [existingUserName, setExistingUserName] = useState('')
  const [waSendFailed, setWaSendFailed] = useState(false)
  const [noPhone, setNoPhone] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const [lang, setLang] = useState<PortalLang>(() => {
    const saved = localStorage.getItem('le-portal-lang') as PortalLang | null
    return saved === 'he' ? 'he' : 'en'
  })

  const toggleLang = () => {
    const next = lang === 'en' ? 'he' : 'en'
    setLang(next)
    localStorage.setItem('le-portal-lang', next)
  }

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        // Extract phone from WhatsApp sender ID
        let publisherPhone = ''
        if (jobData.lead?.sender_id) {
          const phone = jobData.lead.sender_id.replace(/@.*$/, '')
          publisherPhone = phone.startsWith('+') ? phone : `+${phone}`
          setSignupPhone(publisherPhone)
        }
        if (jobData.status === 'pending') {
          await supabase.rpc('update_job_order_status_by_token', { token, new_status: 'accepted' })
        }
        supabase.from('job_orders').update({ viewed_at: new Date().toISOString() }).eq('id', jobData.id).then(() => {})

        // No phone = can't proceed
        if (!publisherPhone) {
          setNoPhone(true)
        }

        // Check if publisher is an existing user
        if (publisherPhone) {
          try {
            const checkRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'check', phone: publisherPhone }),
            })
            const checkData = await checkRes.json()
            setIsExistingUser(checkData.exists === true)
            if (checkData.name) setExistingUserName(checkData.name)
          } catch {
            setIsExistingUser(false) // Assume new user on error
          }
        } else {
          setIsExistingUser(false)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [token])

  const handleSignup = async () => {
    if (signupLoading) return // Prevent double-click
    if (!isExistingUser && !signupName.trim()) return
    if (!signupPhone.trim()) return
    setSignupLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          mode: isContractorSignup ? 'contractor_signup' : 'publisher_signup',
          name: isExistingUser ? existingUserName : signupName.trim(),
          phone: signupPhone.trim(),
          job_order_id: job?.id,
          lead_address: !isContractorSignup ? (leadAddress.trim() || undefined) : undefined,
          lead_phone: !isContractorSignup ? (leadPhone.trim() || undefined) : undefined,
          my_earnings: !isContractorSignup ? (myEarnings.trim() || undefined) : undefined,
          sub_pay: !isContractorSignup ? (subPay.trim() || undefined) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(t(lang, 'Something went wrong. Try again.', 'משהו השתבש. נסה שוב.'))
        return
      }
      // Check if WhatsApp was actually sent
      if (data.magicLinkSent === false) {
        setSignupDone(true) // Still show success but with fallback message
        setWaSendFailed(true)
        return
      }
      setSignupDone(true)
    } catch {
      alert(t(lang, 'Network error.', 'שגיאת רשת.'))
    } finally {
      setSignupLoading(false)
    }
  }

  const isFormReady = isExistingUser
    ? signupPhone.trim()
    : (signupName.trim() && signupPhone.trim())

  // Derived data
  const portalMode = job?.portal_mode || 'publisher_signup'
  const isContractorSignup = portalMode === 'contractor_signup'

  // In contractor_signup mode, the "other party" is the publisher
  const otherPartyName = isContractorSignup
    ? (job?.publisher_name || t(lang, 'A publisher', 'מפרסם'))
    : (job?.contractor_name || t(lang, 'A contractor', 'קבלן'))
  const otherPartyProfile = isContractorSignup ? job?.publisher_profile : job?.contractor_profile

  const contractorName = job?.contractor_name || t(lang, 'A contractor', 'קבלן')
  const cp = otherPartyProfile
  const lead = job?.lead || { city: null, zip_code: null, urgency: null, summary: null, description: null, sender_id: null, profession: null }
  const profession = (lead.profession || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ') || t(lang, 'Your area', 'האזור שלך')
  const tierLabels: Record<string, string> = { elite: '🏆 Elite', trusted: '✅ Trusted', verified: '🔵 Verified', new: '🆕 New' }

  // ── Loading ──
  if (loading) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <style>{DARK_ANIM}</style>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 animate-in">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
            <p className="text-sm" style={{ color: '#a1a1a6' }}>{t(lang, 'Loading...', 'טוען...')}</p>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Error ──
  if (error || !job) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <style>{DARK_ANIM}</style>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center animate-in" style={{ background: 'rgba(255,69,58,0.12)' }}>
            <XCircle className="w-10 h-10" style={{ color: '#ff453a' }} />
          </div>
          <h1 className="text-xl font-bold animate-in-1" style={{ color: '#fff', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.03em' }}>{t(lang, 'Link Expired', 'הקישור פג תוקף')}</h1>
          <p className="text-sm text-center animate-in-2" style={{ color: '#a1a1a6', maxWidth: 280 }}>
            {t(lang, 'This job link is no longer valid.', 'קישור העבודה הזה כבר לא תקף.')}
          </p>
        </div>
      </Shell>
    )
  }

  // ── Success ──
  if (signupDone) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <style>{DARK_ANIM}</style>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="w-24 h-24 rounded-full flex items-center justify-center animate-check"
            style={{ background: '#141414', border: `2px solid ${waSendFailed ? 'rgba(255,69,58,0.3)' : 'rgba(255,107,53,0.3)'}` }}>
            <span className="text-5xl">{waSendFailed ? '⚠️' : '💬'}</span>
          </div>

          {waSendFailed ? (
            /* WhatsApp send failed — show fallback */
            <>
              <h1 className="text-2xl font-bold text-center animate-in-1" style={{ color: '#fff', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.03em' }}>
                {t(lang, 'Almost there!', 'כמעט שם!')}
              </h1>
              <p className="text-[15px] text-center animate-in-2" style={{ color: '#a1a1a6', maxWidth: 300, lineHeight: 1.7 }}>
                {t(lang,
                  `Your account is set up, but we couldn't send the WhatsApp link. Contact ${contractorName} to get your login link.`,
                  `החשבון שלך מוכן, אבל לא הצלחנו לשלוח את הלינק בוואטסאפ. פנה ל${contractorName} כדי לקבל לינק כניסה.`
                )}
              </p>
            </>
          ) : !isMobile ? (
            /* Desktop — tell them to check phone */
            <>
              <h1 className="text-2xl font-bold text-center animate-in-1" style={{ color: '#fff', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.03em' }}>
                {t(lang, 'Check your phone! 📱', 'בדוק את הטלפון! 📱')}
              </h1>
              <p className="text-[15px] text-center animate-in-2" style={{ color: '#a1a1a6', maxWidth: 300, lineHeight: 1.7 }}>
                {t(lang,
                  `We sent a login link to your WhatsApp. Open it on your phone to access the dashboard.`,
                  `שלחנו לינק כניסה לוואטסאפ שלך. פתח אותו בטלפון כדי להיכנס לדשבורד.`
                )}
              </p>
            </>
          ) : (
            /* Mobile — normal success */
            <>
              <h1 className="text-2xl font-bold text-center animate-in-1" style={{ color: '#fff', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.03em' }}>
                {t(lang, 'Check your WhatsApp! 🎉', 'בדוק את הוואטסאפ! 🎉')}
              </h1>
              <p className="text-[15px] text-center animate-in-2" style={{ color: '#a1a1a6', maxWidth: 300, lineHeight: 1.7 }}>
                {t(lang,
                  `We sent you a link on WhatsApp to manage the job with ${contractorName}.`,
                  `שלחנו לך לינק בוואטסאפ לניהול העבודה עם ${contractorName}.`
                )}
              </p>
            </>
          )}

          <div className="rounded-2xl px-5 py-4 animate-in-3" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', maxWidth: 300 }}>
            <p className="text-[13px] text-center" style={{ color: '#a1a1a6', lineHeight: 1.6 }}>
              {waSendFailed
                ? t(lang, 'Your account was created successfully. You just need a login link to access it.', 'החשבון נוצר בהצלחה. אתה רק צריך לינק כניסה.')
                : t(lang, 'Tap the link in WhatsApp to log in. The link expires in 24 hours.', 'לחץ על הלינק בוואטסאפ כדי להיכנס. הלינק בתוקף 24 שעות.')
              }
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 px-5 py-2.5 rounded-full animate-in-4" style={{ background: 'rgba(255,107,53,0.15)' }}>
            <Zap className="w-4 h-4" style={{ color: BRAND }} />
            <span className="text-xs font-semibold" style={{ color: BRAND }}>MasterLeadFlow</span>
          </div>
        </div>
      </Shell>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN PAGE
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <Shell lang={lang} toggleLang={toggleLang} sticky>
      <style>{DARK_ANIM}</style>
      <div className="flex-1 pb-28">

        {/* ── Section 1: Hero with Contractor Profile ── */}
        <div className="relative" style={{ background: '#0a0a0a', padding: '16px 20px 20px' }}>
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.08) 0%, transparent 50%)',
          }} />
          <div className="relative max-w-md mx-auto">
            {/* Title */}
            <h1 className="text-[17px] font-bold mb-3 animate-in" style={{ color: '#fff', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.03em' }}>
              {isContractorSignup
                ? t(lang,
                    `${otherPartyName} wants you on this job 🔧`,
                    `${otherPartyName} רוצה אותך בעבודה הזאת 🔧`
                  )
                : t(lang,
                    `${otherPartyName} took your job ✅`,
                    `${otherPartyName} לקח את העבודה שלך ✅`
                  )
              }
            </h1>

            {/* Contractor profile card */}
            <div className="rounded-2xl p-4 animate-in-1" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                {cp?.avatar_url ? (
                  <img src={cp.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                    style={{ background: 'rgba(255,107,53,0.15)', color: BRAND }}>
                    {otherPartyName.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Name + tier */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-white truncate">{otherPartyName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {cp && cp.avg_rating > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3" style={{ fill: BRAND, color: BRAND }} />
                        <span className="text-[11px] font-semibold" style={{ color: BRAND }}>{cp.avg_rating}</span>
                        <span className="text-[10px]" style={{ color: '#636366' }}>({cp.review_count})</span>
                      </span>
                    )}
                    {cp?.tier && cp.tier !== 'new' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,107,53,0.1)', color: BRAND }}>
                        {tierLabels[cp.tier] || cp.tier}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick stats row */}
              {cp && (
                <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {cp.years_experience && (
                    <div className="flex-1 text-center">
                      <p className="text-[14px] font-bold text-white">{cp.years_experience}</p>
                      <p className="text-[9px] uppercase" style={{ color: '#636366', letterSpacing: '0.05em' }}>{t(lang, 'Years', 'שנים')}</p>
                    </div>
                  )}
                  {cp.completion_rate > 0 && (
                    <div className="flex-1 text-center">
                      <p className="text-[14px] font-bold text-white">{cp.completion_rate}%</p>
                      <p className="text-[9px] uppercase" style={{ color: '#636366', letterSpacing: '0.05em' }}>{t(lang, 'Done', 'הושלם')}</p>
                    </div>
                  )}
                  {cp.review_count > 0 && (
                    <div className="flex-1 text-center">
                      <p className="text-[14px] font-bold text-white">{cp.review_count}</p>
                      <p className="text-[9px] uppercase" style={{ color: '#636366', letterSpacing: '0.05em' }}>{t(lang, 'Reviews', 'דירוגים')}</p>
                    </div>
                  )}
                  {cp.professions && cp.professions.length > 0 && !cp.years_experience && !cp.completion_rate && (
                    <div className="flex flex-wrap gap-1">
                      {cp.professions.slice(0, 3).map((p, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#a1a1a6' }}>
                          {p.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Job info inline */}
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {profession && (
                  <span className="text-[11px] font-medium" style={{ color: BRAND }}>{profession}</span>
                )}
                {profession && <span style={{ color: '#2c2c2e' }}>·</span>}
                <span className="text-[11px]" style={{ color: '#636366' }}>{location}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Contact Card — no redundant header ── */}
        <div ref={formRef} className="px-5 pb-4 max-w-md mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{
            background: '#141414',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* ─ Known info ─ */}
            {(lead.summary || lead.description) && (
              <ContactRow
                label={t(lang, 'description', 'תיאור')}
                value={lead.summary || lead.description || ''}
                small
              />
            )}
            {!isContractorSignup && (
              <ContactRow
                label={t(lang, 'sub-contractor', 'קבלן משנה')}
                value={contractorName}
                accent="brand"
              />
            )}
            {isContractorSignup && job?.publisher_name && (
              <ContactRow
                label={t(lang, 'posted by', 'פורסם ע"י')}
                value={job.publisher_name}
                accent="brand"
              />
            )}

            {/* ─ Editable fields with motivation text ─ */}
            <div className="px-5 py-2.5" style={{ background: '#1c1c1e' }}>
              <p className="text-[11px]" style={{ color: '#636366', lineHeight: 1.5 }}>
                {isContractorSignup
                  ? t(lang,
                      'Take this job and get more like it automatically. Join for free.',
                      'קח את העבודה וקבל עוד כאלה אוטומטית. הצטרף בחינם.'
                    )
                  : t(lang,
                      'Fill in the details so you and ' + otherPartyName + ' have everything in one place. No more digging through WhatsApp.',
                      'מלא את הפרטים כדי שלך ול' + otherPartyName + ' יהיה הכל במקום אחד. בלי לחפש בוואטסאפ.'
                    )
                }
              </p>
            </div>
            {!isContractorSignup && (
              <>
                <ContactRowInput
                  label={t(lang, 'address', 'כתובת')}
                  value={leadAddress}
                  onChange={setLeadAddress}
                  placeholder={t(lang, 'Tap to add', 'לחץ להוספה')}
                />
                <ContactRowInput
                  label={t(lang, 'customer phone', 'טלפון לקוח')}
                  value={leadPhone}
                  onChange={setLeadPhone}
                  placeholder={t(lang, 'Tap to add', 'לחץ להוספה')}
                  type="tel"
                  dir="ltr"
                />
                <ContactRowInput
                  label={t(lang, 'my cut', 'העמלה שלי')}
                  value={myEarnings}
                  onChange={setMyEarnings}
                  placeholder={t(lang, 'e.g. $200', 'למשל $200')}
                  dir="ltr"
                />
                <ContactRowInput
                  label={t(lang, 'sub pay', 'תשלום לקבלן')}
                  value={subPay}
                  onChange={setSubPay}
                  placeholder={t(lang, 'e.g. $800', 'למשל $800')}
                  dir="ltr"
                />
              </>
            )}

            {/* Separator */}
            <div style={{ height: 8, background: '#1c1c1e' }} />

            {/* ─ Your details — conditional on existing user ─ */}
            {isExistingUser === null ? (
              /* Still checking... */
              <div className="px-5 py-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#636366' }} />
                <span className="text-[12px]" style={{ color: '#636366' }}>{t(lang, 'Checking...', 'בודק...')}</span>
              </div>
            ) : isExistingUser ? (
              /* Existing user — show greeting, no name/phone fields */
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: 'rgba(255,107,53,0.15)', color: BRAND }}>
                    {existingUserName.charAt(0).toUpperCase() || '✓'}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold" style={{ color: '#fff' }}>
                      {t(lang, `Hey ${existingUserName}!`, `היי ${existingUserName}!`)}
                    </p>
                    <p className="text-[12px]" style={{ color: '#636366' }}>
                      {t(lang, 'We found your account', 'מצאנו את החשבון שלך')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* New user — show name + phone fields */
              <>
                <div className="px-4 py-2" style={{ background: '#2c2c2e' }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: '#636366', letterSpacing: '0.08em' }}>
                    {t(lang, 'Your info', 'הפרטים שלך')}
                  </p>
                </div>
                <ContactRowInput
                  label={t(lang, 'your name', 'השם שלך')}
                  value={signupName}
                  onChange={setSignupName}
                  placeholder={t(lang, 'Required', 'חובה')}
                  required
                />
                <ContactRowInput
                  label={t(lang, 'your phone', 'הטלפון שלך')}
                  value={signupPhone}
                  onChange={setSignupPhone}
                  placeholder={t(lang, 'Required', 'חובה')}
                  type="tel"
                  dir="ltr"
                  required
                  last
                />
              </>
            )}
          </div>
        </div>

        {/* ── Section 3: Why MasterLeadFlow — compact trust strip ── */}
        <div className="px-5 mt-5 pb-4 max-w-md mx-auto">
          <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative">
              <img src="/contractors-team.webp" alt="Team" className="w-full h-full object-cover" style={{ objectPosition: 'center 30%' }} />
              <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.15)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold" style={{ color: '#fff' }}>MasterLeadFlow</p>
              <p className="text-[11px]" style={{ color: '#a1a1a6', lineHeight: 1.4 }}>
                {t(lang,
                  'Used by 500+ contractors · Free forever',
                  'בשימוש 500+ קבלנים · חינם לנצח'
                )}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-2.5 h-2.5" style={{ fill: BRAND, color: BRAND }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50" style={{
        background: 'linear-gradient(transparent, #0a0a0a 20%)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div className="px-5 pt-3 pb-4 max-w-md mx-auto">
          <button
            onClick={handleSignup}
            disabled={signupLoading || !isFormReady}
            className="w-full rounded-2xl py-4 text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.97]"
            style={{
              background: isFormReady ? BRAND : '#2c2c2e',
              color: isFormReady ? '#fff' : '#636366',
              boxShadow: isFormReady
                ? '0 0 30px rgba(255,107,53,0.25)'
                : 'none',
            }}
          >
            {signupLoading
              ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              : <span className="flex items-center justify-center gap-2">
                  {isExistingUser
                    ? t(lang, 'Open my dashboard →', 'פתח את הדשבורד שלי →')
                    : isContractorSignup
                      ? t(lang, 'Take this job & get more 💬', 'קח את העבודה וקבל עוד 💬')
                      : t(lang, 'Save & send me a login link 💬', 'שמור ושלח לי לינק כניסה 💬')
                  }
                </span>}
          </button>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px]" style={{ color: '#636366' }}>
              <Shield className="w-3 h-3" /> {t(lang, 'Secure', 'מאובטח')}
            </span>
            <span className="text-[10px]" style={{ color: '#48484a' }}>·</span>
            <span className="text-[10px]" style={{ color: '#636366' }}>
              {t(lang, 'Free forever', 'חינם לנצח')}
            </span>
            <span className="text-[10px]" style={{ color: '#48484a' }}>·</span>
            <span className="text-[10px]" style={{ color: '#636366' }}>
              {t(lang, 'No credit card', 'ללא כ.א.')}
            </span>
          </div>
        </div>
      </div>
    </Shell>
  )
}

// ── iOS Contact Card: Read-only row ─────────────────────────────────────────
function ContactRow({ label, value, small, accent }: {
  label: string; value: string; small?: boolean; accent?: 'brand'
}) {
  return (
    <div className="flex items-start px-5 py-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
      <span className="text-[13px] shrink-0" style={{ color: '#636366', width: 110 }}>{label}</span>
      <span className={`text-[13px] flex-1 ${small ? '' : 'font-medium'}`} style={{
        color: accent === 'brand' ? BRAND : (small ? '#a1a1a6' : '#fff'),
        lineHeight: 1.45,
      }}>{value}</span>
    </div>
  )
}

// ── iOS Contact Card: Editable row ──────────────────────────────────────────
function ContactRowInput({ label, value, onChange, placeholder, type = 'text', dir, required, suffix, last }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder: string; type?: string; dir?: string; required?: boolean; suffix?: string; last?: boolean
}) {
  return (
    <div className="flex items-center px-5 py-0.5" style={{ borderBottom: last ? 'none' : '0.5px solid rgba(255,255,255,0.06)' }}>
      <span className="text-[13px] shrink-0 flex items-center gap-1" style={{ color: '#636366', width: 110 }}>
        {label}
        {required && <span className="text-[10px]" style={{ color: BRAND }}>*</span>}
      </span>
      <div className="flex-1 flex items-center">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          className="w-full py-3 text-[13px] font-medium bg-transparent focus:outline-none"
          style={{ color: '#fff' }}
        />
        {suffix && value && (
          <span className="text-[13px] font-medium shrink-0" style={{ color: '#fff' }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}

// ── Shell wrapper ───────────────────────────────────────────────────────────
function Shell({ lang, toggleLang, children, sticky }: {
  lang: PortalLang; toggleLang: () => void; children: React.ReactNode; sticky?: boolean
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{
      background: '#0a0a0a',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {/* Glassmorphism nav */}
      <div className={sticky ? 'sticky top-0 z-40' : ''} style={{
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="flex items-center justify-between px-5 py-3 max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: BRAND }}>M</div>
            <span className="text-[13px] font-bold" style={{ color: '#fff', letterSpacing: '-0.02em' }}>MasterLeadFlow</span>
          </div>
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#a1a1a6' }}
          >
            <Globe className="w-3 h-3" />
            {lang === 'en' ? 'עברית' : 'EN'}
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
