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

const BRAND = '#fe5b25'
const BRAND_DARK = '#e04d1c'
const BG = '#faf9f6'

// ── CSS keyframes injected once ─────────────────────────────────────────────
const ANIM_STYLES = `
@keyframes portalFadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes portalPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes portalBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes portalCheckIn {
  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(0deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.portal-fade-up { animation: portalFadeUp 0.5s ease-out both; }
.portal-fade-up-1 { animation: portalFadeUp 0.5s ease-out 0.1s both; }
.portal-fade-up-2 { animation: portalFadeUp 0.5s ease-out 0.2s both; }
.portal-fade-up-3 { animation: portalFadeUp 0.5s ease-out 0.3s both; }
.portal-fade-up-4 { animation: portalFadeUp 0.5s ease-out 0.4s both; }
.portal-check-in { animation: portalCheckIn 0.6s ease-out 0.3s both; }
.portal-bounce { animation: portalBounce 2s ease-in-out infinite; }
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
  const [commissionPct, setCommissionPct] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null) // null = checking
  const [existingUserName, setExistingUserName] = useState('')
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
    // Existing users don't need a name
    if (!isExistingUser && !signupName.trim()) return
    if (!signupPhone.trim()) return
    setSignupLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          name: isExistingUser ? existingUserName : signupName.trim(),
          phone: signupPhone.trim(),
          job_order_id: job?.id,
          lead_address: leadAddress.trim() || undefined,
          lead_phone: leadPhone.trim() || undefined,
          commission_pct: commissionPct.trim() || undefined,
        }),
      })
      if (res.ok) setSignupDone(true)
      else alert(t(lang, 'Something went wrong. Try again.', 'משהו השתבש. נסה שוב.'))
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
  const contractorName = job?.contractor_name || t(lang, 'A contractor', 'קבלן')
  const lead = job?.lead || { city: null, zip_code: null, urgency: null, summary: null, description: null, sender_id: null, profession: null }
  const profession = (lead.profession || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const location = [lead.city, lead.zip_code].filter(Boolean).join(', ') || t(lang, 'Your area', 'האזור שלך')

  // ── Loading ──
  if (loading) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <style>{ANIM_STYLES}</style>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 portal-fade-up">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
            <p className="text-sm" style={{ color: '#9a9590' }}>{t(lang, 'Loading...', 'טוען...')}</p>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Error ──
  if (error || !job) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <style>{ANIM_STYLES}</style>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center portal-fade-up" style={{ background: '#fef2ef' }}>
            <XCircle className="w-10 h-10" style={{ color: '#e8a99a' }} />
          </div>
          <h1 className="text-xl font-bold portal-fade-up-1" style={{ color: '#1a1614' }}>{t(lang, 'Link Expired', 'הקישור פג תוקף')}</h1>
          <p className="text-sm text-center portal-fade-up-2" style={{ color: '#9a9590', maxWidth: 280 }}>
            {t(lang, 'This job link is no longer valid.', 'קישור העבודה הזה כבר לא תקף.')}
          </p>
        </div>
      </Shell>
    )
  }

  // ── Success ──
  if (signupDone) {
    return (
      <Shell lang={lang} toggleLang={toggleLang}>
        <style>{ANIM_STYLES}</style>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          {/* WhatsApp icon */}
          <div className="w-24 h-24 rounded-full flex items-center justify-center portal-check-in" style={{ background: '#dcfce7' }}>
            <span className="text-5xl">💬</span>
          </div>
          <h1 className="text-2xl font-bold text-center portal-fade-up-1" style={{ color: '#1a1614', letterSpacing: '-0.04em' }}>
            {t(lang, 'Check your WhatsApp! 🎉', 'בדוק את הוואטסאפ! 🎉')}
          </h1>
          <p className="text-[15px] text-center portal-fade-up-2" style={{ color: '#5a5450', maxWidth: 300, lineHeight: 1.7 }}>
            {t(lang,
              `We sent you a link on WhatsApp to manage the job with ${contractorName}.`,
              `שלחנו לך לינק בוואטסאפ לניהול העבודה עם ${contractorName}.`
            )}
          </p>
          <div className="rounded-2xl px-5 py-4 portal-fade-up-3" style={{ background: '#fff', border: '1px solid #efece8', maxWidth: 300 }}>
            <p className="text-[13px] text-center" style={{ color: '#7a7570', lineHeight: 1.6 }}>
              {t(lang,
                'Tap the link in WhatsApp to log in to your dashboard. The link expires in 24 hours.',
                'לחץ על הלינק בוואטסאפ כדי להיכנס לדשבורד שלך. הלינק בתוקף ל-24 שעות.'
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 px-5 py-2.5 rounded-full portal-fade-up-4" style={{ background: '#fff4ef' }}>
            <Zap className="w-4 h-4" style={{ color: BRAND }} />
            <span className="text-xs font-semibold" style={{ color: BRAND_DARK }}>MasterLeadFlow</span>
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
      <style>{ANIM_STYLES}</style>
      <div className="flex-1 pb-28">

        {/* ── Section 1: Hero ── */}
        <div className="relative overflow-hidden" style={{
          background: `linear-gradient(145deg, ${BRAND} 0%, ${BRAND_DARK} 60%, #b83510 100%)`,
          padding: '36px 20px 56px',
        }}>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-[0.08]" style={{ background: '#fff', transform: 'translate(35%, -55%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: '#fff', transform: 'translate(-35%, 45%)' }} />

          <div className="relative max-w-md mx-auto text-center">
            {/* Avatar with pulse ring */}
            <div className="relative w-[72px] h-[72px] mx-auto mb-5">
              <div className="absolute inset-0 rounded-2xl animate-ping opacity-20" style={{ background: '#fff' }} />
              <div className="relative w-full h-full rounded-2xl flex items-center justify-center text-2xl font-bold portal-fade-up"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(12px)', border: '2px solid rgba(255,255,255,0.3)' }}>
                {contractorName.charAt(0).toUpperCase()}
              </div>
            </div>

            <h1 className="text-[24px] font-bold text-white mb-1 portal-fade-up-1" style={{ letterSpacing: '-0.04em', lineHeight: 1.25 }}>
              {t(lang,
                `${contractorName} took your job ✅`,
                `${contractorName} לקח את העבודה שלך ✅`
              )}
            </h1>

            {/* Job badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 portal-fade-up-2">
              {profession && (
                <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
                  style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                  <Wrench className="w-3.5 h-3.5 text-white/80" />
                  <span className="text-[13px] text-white font-semibold">{profession}</span>
                </div>
              )}
              <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
                <MapPin className="w-3.5 h-3.5 text-white/70" />
                <span className="text-[13px] text-white/80 font-medium">{location}</span>
              </div>
            </div>

            <p className="text-[13px] text-white/50 mt-4 portal-fade-up-3" style={{ lineHeight: 1.6 }}>
              {t(lang,
                "The deal is set. Let's manage it in one place.",
                'העבודה סגורה. בוא ננהל אותה במקום אחד.'
              )}
            </p>

            {/* Scroll hint */}
            <button onClick={scrollToForm} className="mt-5 mx-auto flex flex-col items-center gap-1 portal-bounce" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <span className="text-[10px] uppercase tracking-widest">{t(lang, 'Scroll', 'גלול')}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Section 2: Value Cards — horizontal scroll ── */}
        <div className="-mt-5 max-w-md mx-auto portal-fade-up-2">
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {[
              {
                icon: <ClipboardList className="w-5 h-5" style={{ color: BRAND }} />,
                bg: '#fff4ef',
                titleEn: 'Track this job',
                titleHe: 'עקוב אחרי העבודה',
                descEn: 'Status, commission, contacts — one place',
                descHe: 'סטטוס, עמלה, פרטי קשר — הכל ביחד',
              },
              {
                icon: <RefreshCw className="w-5 h-5" style={{ color: '#3b82f6' }} />,
                bg: '#eff6ff',
                titleEn: 'Auto next time',
                titleHe: 'אוטומטי בפעם הבאה',
                descEn: 'AI finds you a sub-contractor in minutes',
                descHe: 'AI מוצא לך קבלן משנה תוך דקות',
              },
              {
                icon: <Award className="w-5 h-5" style={{ color: '#16a34a' }} />,
                bg: '#ecfdf5',
                titleEn: 'Build reputation',
                titleHe: 'בנה מוניטין',
                descEn: 'Ratings help you get better subs',
                descHe: 'דירוגים עוזרים לך למצוא קבלני משנה טובים',
              },
            ].map((card, i) => (
              <div key={i} className="flex-shrink-0 w-[260px] snap-center rounded-2xl p-4"
                style={{ background: '#fff', border: '1px solid #efece8', boxShadow: '0 4px 16px rgba(26,22,20,0.06)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: card.bg }}>
                  {card.icon}
                </div>
                <p className="text-[14px] font-bold mb-1" style={{ color: '#1a1614' }}>
                  {t(lang, card.titleEn, card.titleHe)}
                </p>
                <p className="text-[12px]" style={{ color: '#7a7570', lineHeight: 1.5 }}>
                  {t(lang, card.descEn, card.descHe)}
                </p>
              </div>
            ))}
          </div>
          {/* Scroll dots hint */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="w-5 h-1 rounded-full" style={{ background: BRAND }} />
            <div className="w-1.5 h-1 rounded-full" style={{ background: '#ddd' }} />
            <div className="w-1.5 h-1 rounded-full" style={{ background: '#ddd' }} />
          </div>
        </div>

        {/* ── Section 3: Trust — compact ── */}
        <div className="px-5 mt-6 max-w-md mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #efece8' }}>
            <img
              src="/contractors-team.webp"
              alt="Contractor team"
              className="w-full h-36 object-cover"
              style={{ objectPosition: 'center 30%' }}
            />
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#fff' }}>
              <div>
                <p className="text-[13px] font-bold" style={{ color: '#1a1614' }}>MasterLeadFlow</p>
                <p className="text-[11px]" style={{ color: '#9a9590' }}>
                  {t(lang, 'Connecting GCs with subs', 'מחברים קבלנים ראשיים וקבלני משנה')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-[10px] ml-0.5" style={{ color: '#b5b0ab' }}>4.9</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: iOS Contact Card ── */}
        <div ref={formRef} className="px-5 mt-6 pb-4 max-w-md mx-auto">

          {/* Card header — like iOS contact top */}
          <div className="rounded-t-2xl px-5 pt-5 pb-4 text-center" style={{
            background: '#fff',
            borderLeft: '1px solid #efece8', borderRight: '1px solid #efece8', borderTop: '1px solid #efece8',
          }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold"
              style={{ background: '#fff4ef', color: BRAND }}>
              <ClipboardList className="w-6 h-6" />
            </div>
            <p className="text-[15px] font-bold" style={{ color: '#1a1614' }}>
              {profession || t(lang, 'Job', 'עבודה')}
            </p>
            <p className="text-[12px]" style={{ color: '#9a9590' }}>{location}</p>
          </div>

          {/* Unified contact-card rows */}
          <div className="rounded-b-2xl overflow-hidden" style={{
            background: '#fff',
            border: '1px solid #efece8', borderTop: 'none',
            boxShadow: '0 4px 24px rgba(26,22,20,0.06)',
          }}>
            {/* ─ Known info ─ */}
            {(lead.summary || lead.description) && (
              <ContactRow
                label={t(lang, 'description', 'תיאור')}
                value={lead.summary || lead.description || ''}
                small
              />
            )}
            <ContactRow
              label={t(lang, 'sub-contractor', 'קבלן משנה')}
              value={contractorName}
              accent="emerald"
            />

            {/* ─ Editable fields — same visual language ─ */}
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
              label={t(lang, 'commission', 'עמלה')}
              value={commissionPct}
              onChange={setCommissionPct}
              placeholder={t(lang, 'Tap to add %', 'לחץ להוספת %')}
              type="number"
              dir="ltr"
              suffix="%"
            />

            {/* Separator */}
            <div style={{ height: 8, background: '#f5f3f0' }} />

            {/* ─ Your details — conditional on existing user ─ */}
            {isExistingUser === null ? (
              /* Still checking... */
              <div className="px-5 py-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#b5b0ab' }} />
                <span className="text-[12px]" style={{ color: '#b5b0ab' }}>{t(lang, 'Checking...', 'בודק...')}</span>
              </div>
            ) : isExistingUser ? (
              /* Existing user — show greeting, no name/phone fields */
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: '#ecfdf5', color: '#059669' }}>
                    {existingUserName.charAt(0).toUpperCase() || '✓'}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold" style={{ color: '#1a1614' }}>
                      {t(lang, `Hey ${existingUserName}!`, `היי ${existingUserName}!`)}
                    </p>
                    <p className="text-[12px]" style={{ color: '#9a9590' }}>
                      {t(lang, 'We found your account', 'מצאנו את החשבון שלך')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* New user — show name + phone fields */
              <>
                <div className="px-4 py-2" style={{ background: '#f5f3f0' }}>
                  <p className="text-[10px] font-bold uppercase" style={{ color: '#9a9590', letterSpacing: '0.08em' }}>
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
      </div>

      {/* ── Sticky bottom CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50" style={{
        background: `linear-gradient(transparent, ${BG} 20%)`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div className="px-5 pt-3 pb-4 max-w-md mx-auto">
          <button
            onClick={handleSignup}
            disabled={signupLoading || !isFormReady}
            className="w-full rounded-2xl py-4 text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.97]"
            style={{
              background: isFormReady
                ? `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`
                : '#d5d0cb',
              boxShadow: isFormReady
                ? '0 8px 24px rgba(254,91,37,0.4)'
                : '0 2px 8px rgba(0,0,0,0.08)',
              transform: isFormReady ? undefined : 'none',
            }}
          >
            {signupLoading
              ? <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              : <span className="flex items-center justify-center gap-2">
                  {isExistingUser
                    ? t(lang, 'Send me a WhatsApp link 💬', 'שלח לי לינק בוואטסאפ 💬')
                    : t(lang, 'Get a WhatsApp link to manage this job 💬', 'קבל לינק בוואטסאפ לניהול העבודה 💬')
                  }
                </span>}
          </button>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px]" style={{ color: '#b5b0ab' }}>
              <Shield className="w-3 h-3" /> {t(lang, 'Secure', 'מאובטח')}
            </span>
            <span className="text-[10px]" style={{ color: '#d5d0cb' }}>·</span>
            <span className="text-[10px]" style={{ color: '#b5b0ab' }}>
              {t(lang, 'Free forever', 'חינם לנצח')}
            </span>
            <span className="text-[10px]" style={{ color: '#d5d0cb' }}>·</span>
            <span className="text-[10px]" style={{ color: '#b5b0ab' }}>
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
  label: string; value: string; small?: boolean; accent?: 'emerald'
}) {
  return (
    <div className="flex items-start px-5 py-3" style={{ borderBottom: '0.5px solid #f0ece8' }}>
      <span className="text-[13px] shrink-0" style={{ color: '#8e8e93', width: 110 }}>{label}</span>
      <span className={`text-[13px] flex-1 ${small ? '' : 'font-medium'}`} style={{
        color: accent === 'emerald' ? '#059669' : (small ? '#5a5450' : '#1a1614'),
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
    <div className="flex items-center px-5 py-0.5" style={{ borderBottom: last ? 'none' : '0.5px solid #f0ece8' }}>
      <span className="text-[13px] shrink-0 flex items-center gap-1" style={{ color: '#8e8e93', width: 110 }}>
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
          style={{ color: '#1a1614' }}
        />
        {suffix && value && (
          <span className="text-[13px] font-medium shrink-0" style={{ color: '#1a1614' }}>{suffix}</span>
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
      background: BG,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {/* Glassmorphism nav */}
      <div className={sticky ? 'sticky top-0 z-40' : ''} style={{
        background: sticky ? 'rgba(255,255,255,0.85)' : '#fff',
        backdropFilter: sticky ? 'blur(12px) saturate(180%)' : undefined,
        WebkitBackdropFilter: sticky ? 'blur(12px) saturate(180%)' : undefined,
        borderBottom: '1px solid rgba(234,230,226,0.8)',
      }}>
        <div className="flex items-center justify-between px-5 py-3 max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: BRAND }}>M</div>
            <span className="text-[13px] font-bold" style={{ color: '#1a1614', letterSpacing: '-0.02em' }}>MasterLeadFlow</span>
          </div>
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-95"
            style={{ background: 'rgba(245,243,240,0.8)', color: '#9a9590' }}
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
