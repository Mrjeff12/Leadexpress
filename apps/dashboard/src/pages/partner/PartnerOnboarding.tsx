import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/hooks/use-toast'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Handshake,
  User,
  MessageSquare,
  Loader2,
  Sparkles,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react'

export default function PartnerOnboarding() {
  const navigate = useNavigate()
  const { effectiveUserId, profile } = useAuth()
  const { locale } = useI18n()
  const he = locale === 'he'
  const { toast } = useToast()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 2 form data
  const [displayName, setDisplayName] = useState(profile?.full_name || '')
  const [slug, setSlug] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  // Step 3 group link
  const [groupLink, setGroupLink] = useState('')

  // Slide animation
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animating, setAnimating] = useState(false)
  const [visibleStep, setVisibleStep] = useState(0)

  const steps = [
    { label: he ? 'ברוכים הבאים' : 'Welcome', icon: Handshake },
    { label: he ? 'פרופיל' : 'Profile', icon: User },
    { label: he ? 'קבוצה' : 'Group', icon: MessageSquare },
  ]

  function goToStep(target: number) {
    if (target === step || animating) return
    setSlideDir(target > step ? 'left' : 'right')
    setAnimating(true)
    setTimeout(() => {
      setStep(target)
      setVisibleStep(target)
      setTimeout(() => setAnimating(false), 30)
    }, 200)
  }

  function canNext(): boolean {
    if (step === 0) return true
    if (step === 1) return displayName.trim().length > 0 && slug.trim().length > 0 && slugAvailable !== false
    return true
  }

  async function checkSlug(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
    setSlug(cleaned)
    if (cleaned.length < 3) { setSlugAvailable(null); return }

    setCheckingSlug(true)
    const { data } = await supabase
      .from('community_partners')
      .select('id')
      .eq('slug', cleaned)
      .maybeSingle()
    setSlugAvailable(!data)
    setCheckingSlug(false)
  }

  async function handleFinish() {
    if (!effectiveUserId) return
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke('partner-signup', {
        body: {
          display_name: displayName.trim(),
          slug: slug.trim(),
          location: location.trim() || null,
          bio: bio.trim() || null,
          group_link: groupLink.trim() || null,
        },
      })

      if (error) throw error

      toast({
        title: he ? 'ברוכים הבאים!' : 'Welcome aboard!',
        description: he ? 'חשבון השותף שלך נוצר בהצלחה' : 'Your partner account has been created successfully.',
      })

      navigate('/partner', { replace: true })
    } catch (err: any) {
      console.error('Partner signup failed:', err)
      toast({
        title: he ? 'שגיאה' : 'Error',
        description: err?.message || (he ? 'לא הצלחנו ליצור את החשבון. נסה שוב.' : 'Could not create partner account. Please try again.'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const slideStyle: React.CSSProperties = {
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: animating ? 0 : 1,
    transform: animating
      ? `translateX(${slideDir === 'left' ? '-24px' : '24px'})`
      : 'translateX(0)',
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-[11px]"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
          >
            <img src="/icon.png" alt="Lead Express" className="w-full h-full rounded-lg" />
          </div>
          <span className="text-sm font-bold text-zinc-800">
            {he ? 'תוכנית שותפים' : 'Partner Program'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Handshake className="w-3.5 h-3.5 text-[#fe5b25]" />
          <span>{he ? '~60 שניות' : '~60 seconds'}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-100">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${((step + 1) / 3) * 100}%`,
            background: 'linear-gradient(90deg, #fe5b25, #ff8a5c)',
          }}
        />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 py-4 px-4">
        {steps.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <div key={i} className="flex items-center">
              {i > 0 && (
                <div
                  className="h-[2px] transition-all duration-500"
                  style={{
                    width: 48,
                    background: i <= step ? 'linear-gradient(90deg, #fe5b25, #ff8a5c)' : '#e4e4e7',
                  }}
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    done ? 'bg-[#fe5b25] text-white' : active ? 'text-white shadow-lg shadow-[#fe5b25]/30 scale-110' : 'bg-zinc-100 text-zinc-400'
                  }`}
                  style={active ? { background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' } : undefined}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[11px] font-semibold whitespace-nowrap ${active ? 'text-zinc-800' : done ? 'text-[#fe5b25]' : 'text-zinc-400'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="mx-auto max-w-2xl" style={slideStyle}>
          {/* Step 0: Value Prop */}
          {visibleStep === 0 && (
            <div className="space-y-8 text-center pt-4">
              <div>
                <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6"
                  style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}>
                  <Handshake className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-zinc-900 mb-3">
                  {he ? 'הפוך לשותף קהילה' : 'Become a Community Partner'}
                </h1>
                <p className="text-base text-zinc-500 max-w-md mx-auto">
                  {he
                    ? 'הרוויח 15% עמלה חוזרת מכל קבלן שנרשם דרכך. אתה מביא את הקהילה, אנחנו מביאים את הטכנולוגיה.'
                    : 'Earn 15% recurring commission on every contractor that subscribes through you. You provide the community, we provide the technology.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: DollarSign, label: he ? '15% עמלה' : '15% Commission', desc: he ? 'חוזרת כל חודש' : 'Every month, forever' },
                  { icon: Users, label: he ? 'ללא מאמץ' : 'Zero Effort', desc: he ? 'שתף קישור, זהו' : 'Share a link, done' },
                  { icon: Zap, label: he ? 'בזמן אמת' : 'Real-time', desc: he ? 'עקוב אחרי הכנסות' : 'Track your earnings' },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <item.icon className="w-6 h-6 text-[#fe5b25] mx-auto mb-2" />
                    <p className="text-xs font-bold text-zinc-800">{item.label}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Profile */}
          {visibleStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'הפרופיל שלך' : 'Your Partner Profile'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {he ? 'איך קבלנים יראו אותך' : 'How contractors will see you'}
                </p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5">
                    {he ? 'שם תצוגה' : 'Display Name'} *
                  </label>
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder={he ? 'השם שלך או שם העסק' : 'Your name or business name'}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5">
                    {he ? 'כתובת ייחודית' : 'Unique Slug'} *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 shrink-0">leadexpress.co/join/</span>
                    <input
                      value={slug}
                      onChange={e => checkSlug(e.target.value)}
                      placeholder="your-slug"
                      className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
                    />
                  </div>
                  {checkingSlug && <p className="text-xs text-zinc-400 mt-1">{he ? 'בודק...' : 'Checking...'}</p>}
                  {slugAvailable === true && slug.length >= 3 && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {he ? 'זמין!' : 'Available!'}
                    </p>
                  )}
                  {slugAvailable === false && (
                    <p className="text-xs text-red-500 mt-1">{he ? 'הכתובת תפוסה' : 'This slug is taken'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5">
                    {he ? 'מיקום' : 'Location'}
                  </label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder={he ? 'לדוגמה: ניו ג\'רזי' : 'e.g. New Jersey, NY'}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1.5">
                    {he ? 'תיאור קצר' : 'Short Bio'}
                  </label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={3}
                    placeholder={he ? 'ספר על עצמך ועל הקהילה שלך' : 'Tell us about yourself and your community'}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Link Group */}
          {visibleStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-zinc-900">
                  {he ? 'חבר קבוצה' : 'Link Your First Group'}
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {he ? 'אופציונלי - אפשר לדלג ולהוסיף אחר כך' : 'Optional - you can skip and add later'}
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <MessageSquare className="w-8 h-8 text-[#25D366] mb-3" />
                  <h3 className="text-sm font-bold text-zinc-800 mb-1">
                    {he ? 'קישור לקבוצת WhatsApp' : 'WhatsApp Group Link'}
                  </h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    {he ? 'הדבק את קישור ההזמנה של הקבוצה שלך' : 'Paste your group invite link'}
                  </p>
                  <input
                    value={groupLink}
                    onChange={e => setGroupLink(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fe5b25]/10 transition-all"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#fff4ef] border border-[#fee8df]">
                  <p className="text-xs text-[#c43d10]">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                    {he
                      ? 'אפשר לחבר קבוצות נוספות בכל זמן מדף הקהילות'
                      : 'You can link more groups anytime from the Communities page'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-zinc-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              {he ? 'חזרה' : 'Back'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:bg-zinc-50 transition-all"
            >
              {he ? 'ביטול' : 'Cancel'}
            </button>
          )}

          {step < 2 ? (
            <button
              type="button"
              disabled={!canNext() || animating}
              onClick={() => goToStep(step + 1)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all shadow-md shadow-[#fe5b25]/20"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {step === 0 ? (he ? 'בוא נתחיל' : 'Get Started') : (he ? 'הבא' : 'Next')}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-[#fe5b25]/30"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #e04d1c)' }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {he ? 'סיום והתחלה' : 'Finish & Launch'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
