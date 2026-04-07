import { useState, useEffect, useRef } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { PROFESSIONS } from '../lib/professions'
import { supabase } from '../lib/supabase'

const US_STATES = [
  { code: 'AL', name: 'Alabama', fips: '01' }, { code: 'AK', name: 'Alaska', fips: '02' },
  { code: 'AZ', name: 'Arizona', fips: '04' }, { code: 'AR', name: 'Arkansas', fips: '05' },
  { code: 'CA', name: 'California', fips: '06' }, { code: 'CO', name: 'Colorado', fips: '08' },
  { code: 'CT', name: 'Connecticut', fips: '09' }, { code: 'DE', name: 'Delaware', fips: '10' },
  { code: 'FL', name: 'Florida', fips: '12' }, { code: 'GA', name: 'Georgia', fips: '13' },
  { code: 'HI', name: 'Hawaii', fips: '15' }, { code: 'ID', name: 'Idaho', fips: '16' },
  { code: 'IL', name: 'Illinois', fips: '17' }, { code: 'IN', name: 'Indiana', fips: '18' },
  { code: 'IA', name: 'Iowa', fips: '19' }, { code: 'KS', name: 'Kansas', fips: '20' },
  { code: 'KY', name: 'Kentucky', fips: '21' }, { code: 'LA', name: 'Louisiana', fips: '22' },
  { code: 'ME', name: 'Maine', fips: '23' }, { code: 'MD', name: 'Maryland', fips: '24' },
  { code: 'MA', name: 'Massachusetts', fips: '25' }, { code: 'MI', name: 'Michigan', fips: '26' },
  { code: 'MN', name: 'Minnesota', fips: '27' }, { code: 'MS', name: 'Mississippi', fips: '28' },
  { code: 'MO', name: 'Missouri', fips: '29' }, { code: 'MT', name: 'Montana', fips: '30' },
  { code: 'NE', name: 'Nebraska', fips: '31' }, { code: 'NV', name: 'Nevada', fips: '32' },
  { code: 'NH', name: 'New Hampshire', fips: '33' }, { code: 'NJ', name: 'New Jersey', fips: '34' },
  { code: 'NM', name: 'New Mexico', fips: '35' }, { code: 'NY', name: 'New York', fips: '36' },
  { code: 'NC', name: 'North Carolina', fips: '37' }, { code: 'ND', name: 'North Dakota', fips: '38' },
  { code: 'OH', name: 'Ohio', fips: '39' }, { code: 'OK', name: 'Oklahoma', fips: '40' },
  { code: 'OR', name: 'Oregon', fips: '41' }, { code: 'PA', name: 'Pennsylvania', fips: '42' },
  { code: 'RI', name: 'Rhode Island', fips: '44' }, { code: 'SC', name: 'South Carolina', fips: '45' },
  { code: 'SD', name: 'South Dakota', fips: '46' }, { code: 'TN', name: 'Tennessee', fips: '47' },
  { code: 'TX', name: 'Texas', fips: '48' }, { code: 'UT', name: 'Utah', fips: '49' },
  { code: 'VT', name: 'Vermont', fips: '50' }, { code: 'VA', name: 'Virginia', fips: '51' },
  { code: 'WA', name: 'Washington', fips: '53' }, { code: 'WV', name: 'West Virginia', fips: '54' },
  { code: 'WI', name: 'Wisconsin', fips: '55' }, { code: 'WY', name: 'Wyoming', fips: '56' },
]

const DAYS = [
  { idx: 0, en: 'Sun', he: 'א' }, { idx: 1, en: 'Mon', he: 'ב' }, { idx: 2, en: 'Tue', he: 'ג' },
  { idx: 3, en: 'Wed', he: 'ד' }, { idx: 4, en: 'Thu', he: 'ה' }, { idx: 5, en: 'Fri', he: 'ו' },
  { idx: 6, en: 'Sat', he: 'ש' },
]

const DASHBOARD_URL = 'https://app.masterleadflow.com'
const REBECA_PHONE = '18623582898'

const Check = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className}><path d="M20 6L9 17l-5-5"/></svg>
)
const WA = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
)

// Steps: 0=Name+Phone, 1=Email+Password, 2=Professions, 3=Areas, 4=Days, 5=WhatsApp CTA
const FORM_STEPS = 5

const TITLES = (he: boolean) => [
  { icon: '👤', title: he ? 'הפרטים שלך' : 'Your details', sub: he ? 'נשתמש בWhatsApp שלך לשלוח לידים' : "We'll send leads to your WhatsApp" },
  { icon: '🔐', title: he ? 'צור חשבון' : 'Create your account', sub: he ? 'כדי שתוכל להתחבר אחר כך' : 'So you can log in later' },
  { icon: '🔧', title: he ? 'מה אתה עושה?' : 'What do you do?', sub: he ? 'בחר את כל השירותים שלך' : 'Select all your services' },
  { icon: '📍', title: he ? 'איפה אתה עובד?' : 'Where do you work?', sub: he ? 'בחר את האזורים שלך' : 'Pick the areas you serve' },
  { icon: '📅', title: he ? 'מתי אתה זמין?' : 'When are you available?', sub: he ? 'בחר את ימי העבודה שלך' : 'Pick your working days' },
]

export default function Signup() {
  const { lang } = useLang()
  const he = lang === 'he'

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState<'+1' | '+972'>(he ? '+972' : '+1')
  const [professions, setProfessions] = useState<string[]>([])
  const [selectedState, setSelectedState] = useState<typeof US_STATES[0] | null>(null)
  const [counties, setCounties] = useState<string[]>([])
  const [availableCounties, setAvailableCounties] = useState<string[]>([])
  const [loadingCounties, setLoadingCounties] = useState(false)
  const [stateSearch, setStateSearch] = useState('')
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [_loginUrl, _setLoginUrl] = useState('') // kept for type safety
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (step === 0) setTimeout(() => nameRef.current?.focus(), 400) }, [step])
  useEffect(() => { if (step === 1) setTimeout(() => emailRef.current?.focus(), 400) }, [step])

  useEffect(() => {
    if (!selectedState) { setAvailableCounties([]); return }
    setLoadingCounties(true)
    fetch(`https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${selectedState.fips}`)
      .then(r => r.json())
      .then((rows: string[][]) => setAvailableCounties(rows.slice(1).map(r => r[0]).sort()))
      .catch(() => setAvailableCounties([]))
      .finally(() => setLoadingCounties(false))
  }, [selectedState])

  const toggleProfession = (id: string) => setProfessions(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleCounty = (c: string) => setCounties(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])
  const toggleDay = (d: number) => setWorkingDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort())

  const digits = phone.replace(/\D/g, '')
  const minLen = countryCode === '+972' ? 9 : 10
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canNext = [
    name.trim().length >= 2 && digits.length >= minLen, // step 0
    emailOk && password.length >= 6,                     // step 1
    professions.length > 0,                              // step 2
    counties.length > 0,                                 // step 3
    workingDays.length > 0,                              // step 4
  ][step] ?? false

  function go(target: number) { setDir(target > step ? 1 : -1); setStep(target) }

  async function handleSubmit() {
    if (!supabase || submitting) return
    setSubmitting(true); setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('web-signup', {
        body: { name: name.trim(), email: email.trim(), password, phone: digits, country_code: countryCode, professions, counties, state: selectedState?.code, working_days: workingDays },
      })
      if (fnErr || data?.error) {
        setError(he ? 'נכשל, נסה שוב' : 'Failed, try again')
        setSubmitting(false); return
      }
      if (data?.login_url) { window.location.href = data.login_url }
    } catch {
      setError(he ? 'שגיאה, נסה שוב' : 'Error, try again')
      setSubmitting(false)
    }
  }

  const filteredStates = stateSearch ? US_STATES.filter(s => s.name.toLowerCase().includes(stateSearch.toLowerCase()) || s.code.toLowerCase().includes(stateSearch.toLowerCase())) : US_STATES
  const titles = TITLES(he)

  const inputCls = "w-full h-[52px] px-5 rounded-2xl bg-white border border-dark/[0.08] text-dark placeholder:text-dark/20 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all text-[16px] shadow-sm"

  return (
    <Shell>
      {/* Top bar */}
      <div className="relative z-20 flex-shrink-0 px-5 pt-[max(env(safe-area-inset-top),12px)] md:pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-dark flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <span className="text-dark/50 text-sm font-medium tracking-[-0.01em]">MasterLeadFlow</span>
          </a>
          {step > 0 ? (
            <button onClick={() => go(step - 1)} className="text-dark/30 text-sm font-medium hover:text-dark/60 transition-colors">{he ? 'חזור' : 'Back'}</button>
          ) : (
            <a href={`${DASHBOARD_URL}/login`} className="text-dark/30 text-sm font-medium hover:text-primary transition-colors">{he ? 'התחבר' : 'Log in'}</a>
          )}
        </div>
        {/* Progress */}
        <div className="flex gap-1.5">
          {Array.from({ length: FORM_STEPS }).map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-500 ${i < step ? 'bg-primary' : i === step ? 'bg-primary/40' : 'bg-dark/[0.06]'}`} />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-hidden relative">
        <div key={step} className="absolute inset-0 flex flex-col signup-step-enter" style={{ '--dir': dir } as React.CSSProperties}>
          {/* Hero image on step 0 */}
          {step === 0 && (
            <div className="flex-shrink-0 mx-6 mt-3 mb-2 rounded-2xl overflow-hidden h-32 md:h-40 relative">
              <img src="/contractors-team.webp" alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/40 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-white text-[13px] font-semibold drop-shadow-sm">{he ? 'הצטרף ל-500+ קבלנים שמקבלים לידים' : 'Join 500+ contractors getting leads'}</p>
              </div>
            </div>
          )}
          {/* Step header */}
          <div className="flex-shrink-0 px-6 pt-4 pb-3">
            {step > 0 && <div className="text-[32px] mb-3">{titles[step].icon}</div>}
            <h1 className="text-[24px] font-medium tracking-[-0.03em] text-dark leading-tight mb-1">{titles[step].title}</h1>
            <p className="text-dark/35 text-[14px]">{titles[step].sub}</p>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 pb-36">

            {/* Step 0: Name + Phone */}
            {step === 0 && (
              <div className="space-y-4 pt-3">
                <div>
                  <label className="block text-[12px] font-semibold text-dark/40 uppercase tracking-wide mb-1.5">{he ? 'שם מלא' : 'Full name'}</label>
                  <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)} placeholder={he ? 'ישראל ישראלי' : 'John Smith'} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-dark/40 uppercase tracking-wide mb-1.5">{he ? 'מספר WHATSAPP' : 'WHATSAPP NUMBER'}</label>
                  <div className="flex gap-2">
                    <select value={countryCode} onChange={e => setCountryCode(e.target.value as '+1' | '+972')}
                      className="h-[52px] px-3 rounded-2xl bg-white border border-dark/[0.08] text-dark text-sm font-medium focus:border-primary/40 outline-none transition-all cursor-pointer shadow-sm min-w-[72px]">
                      <option value="+1">+1</option>
                      <option value="+972">+972</option>
                    </select>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={countryCode === '+972' ? '050-123-4567' : '(555) 123-4567'}
                      className={`flex-1 ${inputCls.replace('w-full ', '')}`} />
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-[#25D366]/[0.06] rounded-xl px-4 py-3 mt-2">
                  <WA className="w-5 h-5 text-[#25D366] flex-shrink-0" />
                  <p className="text-[13px] text-[#1a8d4e] leading-snug">{he ? 'לידים נשלחים ישירות לWhatsApp שלך' : 'Leads are sent directly to your WhatsApp'}</p>
                </div>
              </div>
            )}

            {/* Step 1: Email + Password */}
            {step === 1 && (
              <div className="space-y-4 pt-3">
                <div>
                  <label className="block text-[12px] font-semibold text-dark/40 uppercase tracking-wide mb-1.5">{he ? 'אימייל' : 'EMAIL'}</label>
                  <input ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-dark/40 uppercase tracking-wide mb-1.5">{he ? 'סיסמא' : 'PASSWORD'}</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={he ? '6 תווים לפחות' : '6+ characters'} className={inputCls} />
                  {password.length > 0 && password.length < 6 && (
                    <p className="text-[12px] text-primary/70 mt-1.5">{he ? `${6 - password.length} תווים נוספים` : `${6 - password.length} more characters`}</p>
                  )}
                </div>
                <div className="bg-dark/[0.02] rounded-xl px-4 py-3 mt-2">
                  <p className="text-[13px] text-dark/30 leading-snug">{he ? 'תוכל להתחבר עם האימייל והסיסמא שלך בכתובת app.masterleadflow.com' : "You'll use this email and password to log in at app.masterleadflow.com"}</p>
                </div>
              </div>
            )}

            {/* Step 2: Professions */}
            {step === 2 && (
              <div className="grid grid-cols-2 gap-2 pt-3">
                {PROFESSIONS.map(p => {
                  const sel = professions.includes(p.id)
                  return (
                    <button key={p.id} type="button" onClick={() => toggleProfession(p.id)}
                      className={`relative flex items-center gap-2.5 px-3.5 py-3.5 rounded-2xl text-[13px] font-medium transition-all border ${
                        sel ? 'bg-primary/[0.07] border-primary/30 text-dark' : 'bg-white border-dark/[0.06] text-dark/50 active:bg-cream-dark'
                      } shadow-sm`}>
                      <span className="text-lg">{p.emoji}</span>
                      <span className="truncate">{he ? p.he : p.en}</span>
                      {sel && <div className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 3: Service Area */}
            {step === 3 && (
              <div className="pt-3">
                {!selectedState ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/20"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      <input type="text" value={stateSearch} onChange={e => setStateSearch(e.target.value)} placeholder={he ? 'חפש מדינה...' : 'Search state...'}
                        className={`pl-11 ${inputCls.replace('px-5 ', '')}`} />
                    </div>
                    <div className="bg-white rounded-2xl border border-dark/[0.06] shadow-sm overflow-hidden">
                      <div className="max-h-[45vh] overflow-y-auto divide-y divide-dark/[0.04]">
                        {filteredStates.map(s => (
                          <button key={s.code} type="button" onClick={() => { setSelectedState(s); setStateSearch(''); setCounties([]) }}
                            className="w-full text-left flex items-center justify-between px-4 py-3 text-dark/60 hover:bg-cream active:bg-cream-dark transition-colors text-[14px]">
                            <span className="font-medium text-dark/70">{s.name}</span><span className="text-dark/20 text-xs">{s.code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-primary/[0.04] rounded-2xl px-4 py-3 border border-primary/10">
                      <div className="flex items-center gap-2"><span className="text-lg">📍</span><span className="text-dark font-medium text-[14px]">{selectedState.name}</span></div>
                      <button type="button" onClick={() => { setSelectedState(null); setCounties([]); setAvailableCounties([]) }} className="text-[12px] font-medium text-dark/25 hover:text-primary transition-colors">{he ? 'שנה' : 'Change'}</button>
                    </div>
                    {loadingCounties ? (
                      <div className="flex flex-col items-center py-16 gap-3">
                        <div className="w-8 h-8 border-[3px] border-dark/[0.06] border-t-primary rounded-full animate-spin" />
                        <span className="text-[13px] text-dark/25">{he ? 'טוען...' : 'Loading...'}</span>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-dark/[0.06] shadow-sm overflow-hidden">
                        <div className="max-h-[45vh] overflow-y-auto divide-y divide-dark/[0.03]">
                          {availableCounties.map(c => {
                            const sel = counties.includes(c)
                            return (
                              <button key={c} type="button" onClick={() => toggleCounty(c)}
                                className={`w-full text-left flex items-center gap-3 px-4 py-3 text-[14px] transition-all ${sel ? 'bg-primary/[0.04] text-dark font-medium' : 'text-dark/45 active:bg-cream'}`}>
                                <div className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-primary border-primary' : 'border-dark/12 bg-cream'}`}>
                                  {sel && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className="truncate">{c}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Working Days */}
            {step === 4 && (
              <div className="pt-4 space-y-5">
                <div className="flex gap-2 justify-center">
                  {DAYS.map(d => {
                    const sel = workingDays.includes(d.idx)
                    return (
                      <button key={d.idx} type="button" onClick={() => toggleDay(d.idx)}
                        className={`w-11 h-12 rounded-xl flex items-center justify-center text-[13px] font-bold transition-all ${
                          sel ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-white border border-dark/[0.08] text-dark/30'
                        }`}>
                        {he ? d.he : d.en}
                      </button>
                    )
                  })}
                </div>
                <div className="bg-dark/[0.02] rounded-xl px-4 py-3">
                  <p className="text-dark/30 text-[13px] text-center">{he ? 'נשלח לידים רק בימים שבחרת. אפשר לשנות מהדאשבורד.' : "We'll only send leads on selected days. Change anytime."}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-20 flex-shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),12px)] md:pb-5 pt-2" style={{ background: 'linear-gradient(to top, var(--tw-gradient-from) 60%, transparent)', ['--tw-gradient-from' as string]: 'rgb(250 249 246)' }}>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 rounded-xl px-4 py-2.5 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}

        {/* Selection pills */}
        {step === 2 && professions.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            {professions.map(id => { const p = PROFESSIONS.find(x => x.id === id)!; return (
              <span key={id} className="flex-shrink-0 inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[11px] font-semibold">{p.emoji} {he ? p.he : p.en}</span>
            )})}
          </div>
        )}
        {step === 3 && counties.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            {counties.slice(0, 4).map(c => (<span key={c} className="flex-shrink-0 inline-flex items-center bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[11px] font-semibold truncate max-w-[160px]">{c}</span>))}
            {counties.length > 4 && <span className="text-dark/20 text-[11px] font-medium flex-shrink-0">+{counties.length - 4}</span>}
          </div>
        )}

        <button type="button"
          onClick={() => { if (step < 4) go(step + 1); else handleSubmit() }}
          disabled={!canNext}
          className={`w-full h-[52px] rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
            canNext ? 'bg-dark text-white hover:bg-primary active:scale-[0.97] shadow-lg shadow-dark/10' : 'bg-dark/[0.05] text-dark/15 cursor-not-allowed'
          }`}>
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : step === 4 ? (
            <>{he ? 'סיום הרשמה' : 'Create My Account'}</>
          ) : (
            <>{he ? 'המשך' : 'Continue'}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>
          )}
        </button>
      </div>

      <style>{`
        @keyframes stepIn { from { opacity: 0; transform: translateX(calc(var(--dir) * 40px)); } to { opacity: 1; transform: translateX(0); } }
        .signup-step-enter { animation: stepIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream flex justify-center">
      <div className="w-full max-w-lg flex flex-col min-h-screen md:min-h-0 md:my-8 md:max-h-[calc(100vh-64px)] md:rounded-3xl md:border md:border-dark/[0.06] md:shadow-xl md:shadow-dark/[0.03] md:bg-white/80 md:backdrop-blur-xl md:overflow-hidden">
        {children}
      </div>
    </div>
  )
}
