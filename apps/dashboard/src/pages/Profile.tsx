import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import {
  User,
  Phone,
  Mail,
  Save,
  CheckCircle,
  CheckCircle2,
  Send,
  MessageCircle,
  Radio,
  ExternalLink,
  Loader2,
  Bell,
  Shield,
  Star,
  Wrench,
  MapPin,
  Eye,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Fingerprint,
} from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useIdentityVerification } from '../hooks/useIdentityVerification'

const WA_NUMBER = '18623582898'

export default function Profile() {
  const { user, profile, refreshProfile, effectiveUserId, impersonatedProfile } = useAuth()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const isHe = locale === 'he'

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [telegramChatId, setTelegramChatId] = useState<number | null>(null)
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null)

  const { status: pushStatus, enable: enablePush, isLoading: pushLoading } = usePushNotifications()
  const { isVerified: identityVerified, isPending: identityPending } = useIdentityVerification()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [waPolling, setWaPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [mobileTab, setMobileTab] = useState<'profile' | 'settings'>('profile')

  const loadProfile = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)

    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, telegram_chat_id, whatsapp_phone')
      .eq('id', effectiveUserId)
      .maybeSingle()

    const activeProfile = impersonatedProfile || profile
    if (data) {
      setFullName(data.full_name ?? '')
      setPhone(data.phone ?? '')
      setTelegramChatId(data.telegram_chat_id ?? null)
      setWhatsappPhone(data.whatsapp_phone ?? null)
    } else {
      setFullName(activeProfile?.full_name ?? '')
      setTelegramChatId(activeProfile?.telegram_chat_id ?? null)
    }

    setLoading(false)
  }, [effectiveUserId, profile, impersonatedProfile])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function getWhatsAppCode(): string {
    return effectiveUserId ? effectiveUserId.slice(0, 8) : 'unknown'
  }

  function handleConnectWhatsApp() {
    const code = getWhatsAppCode()
    const message = encodeURIComponent(`Hey! Connect my account. Code: LE-${code}`)
    window.open(`https://wa.me/${WA_NUMBER}?text=${message}`, '_blank')

    // Start polling for connection
    setWaPolling(true)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (!effectiveUserId) return
      const { data } = await supabase
        .from('profiles')
        .select('whatsapp_phone')
        .eq('id', effectiveUserId)
        .maybeSingle()

      if (data?.whatsapp_phone) {
        setWhatsappPhone(data.whatsapp_phone)
        setWaPolling(false)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 3000)

    // Stop polling after 2 minutes
    setTimeout(() => {
      setWaPolling(false)
      if (pollRef.current) clearInterval(pollRef.current)
    }, 120_000)
  }

  async function handleSave() {
    if (!effectiveUserId) return
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: effectiveUserId,
        full_name: fullName.trim(),
        phone: phone.trim(),
      })

    if (!error) {
      setSaved(true)
      await refreshProfile()
      setTimeout(() => setSaved(false), 3000)
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[#fe5b25] border-t-transparent" />
      </div>
    )
  }

  const isTelegramConnected = telegramChatId !== null && telegramChatId !== 0
  const isWhatsAppConnected = !!whatsappPhone

  // Helper: initials from name
  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  // Profile strength calculation
  const strengthSegments = [
    !!fullName,
    !!phone,
    isWhatsAppConnected || isTelegramConnected,
    pushStatus === 'granted',
    identityVerified,
  ]
  const filledSegments = strengthSegments.filter(Boolean).length
  const strengthPercent = Math.round((filledSegments / 5) * 100)

  return (
    <>
      {/* ===================== MOBILE VIEW ===================== */}
      <div className={`md:hidden px-4 pt-4 pb-24 space-y-5 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>

        {/* ---- HERO CARD ---- */}
        <div className="bg-[#111] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#fe5b25] rounded-full opacity-[0.08] -translate-y-10 translate-x-10" />

          {/* Avatar + Info */}
          <div className="flex items-center gap-3.5 mb-4 relative">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-white text-[22px] font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[18px] font-bold text-white tracking-tight truncate">{fullName || (isHe ? 'לא צוין' : 'Not set')}</h2>
                {identityVerified && <Shield size={14} className="text-[#fe5b25] flex-shrink-0" />}
              </div>
              <p className="text-[12px] text-white/40 truncate">{user?.email ?? ''}</p>
              {identityVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 mt-1">
                  <CheckCircle2 size={10} /> {isHe ? 'זהות מאומתת' : 'Identity Verified'}
                </span>
              )}
              {identityPending && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 mt-1">
                  <Loader2 size={10} className="animate-spin" /> {isHe ? 'בבדיקה' : 'Verification pending'}
                </span>
              )}
            </div>
          </div>

          {/* Profile Strength */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 flex gap-0.5">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${i < filledSegments ? 'bg-[#fe5b25]' : 'bg-white/10'}`} />
              ))}
            </div>
            <span className="text-[12px] font-bold text-[#fe5b25]">{strengthPercent}%</span>
          </div>

          <button
            onClick={() => navigate('/profile/public')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 active:scale-[0.97] transition-transform"
          >
            <Eye size={14} className="text-white/60" />
            <span className="text-[13px] font-medium text-white/60">{isHe ? 'תצוגה מקדימה של הפרופיל' : 'Preview public profile'}</span>
          </button>
        </div>

        {/* ---- UNLOCK / VERIFICATION CTA ---- */}
        {!identityVerified && (
          <div className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-zinc-900">{isHe ? 'קבל תג מאומת' : 'Get Verified Badge'}</p>
                <p className="text-[11px] text-zinc-400">{isHe ? 'קבל יותר לידים ואמינות' : 'Get more leads & build trust'}</p>
              </div>
            </div>

            {/* Identity verification CTA */}
            <Link
              to="/verify-identity"
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-50 active:scale-[0.97] transition-transform"
            >
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <Fingerprint size={15} className="text-zinc-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-zinc-900">{isHe ? 'אימות זהות' : 'Identity Verification'}</p>
                <p className="text-[10px] text-zinc-400">{isHe ? 'תעודת זהות + סלפי' : 'ID + selfie verification'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold text-green-600">+30%</span>
                <ArrowRight size={12} className="text-zinc-300" />
              </div>
            </Link>

            {/* What's already done */}
            <div className="flex items-center gap-3 mt-3 px-1">
              {!!phone && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-500" />
                  <span className="text-[10px] text-green-600">{isHe ? 'טלפון מאומת' : 'Phone Verified'}</span>
                </div>
              )}
              {!!fullName && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-500" />
                  <span className="text-[10px] text-green-600">{isHe ? 'שם מלא' : 'Full Name'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- TAB SWITCHER ---- */}
        <div className="flex bg-zinc-100 rounded-xl p-1">
          <button
            onClick={() => setMobileTab('profile')}
            className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
              mobileTab === 'profile' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400'
            }`}
          >
            {isHe ? 'פרופיל' : 'Profile'}
          </button>
          <button
            onClick={() => setMobileTab('settings')}
            className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
              mobileTab === 'settings' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400'
            }`}
          >
            {isHe ? 'הגדרות' : 'Settings'}
          </button>
        </div>

        {mobileTab === 'profile' ? (
          <div className="space-y-3">
            {/* ---- Personal Info ---- */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <p className="text-[14px] font-semibold text-zinc-900">{isHe ? 'מידע אישי' : 'Personal Info'}</p>
                <Link to="/profile/edit" className="text-[12px] font-semibold text-[#fe5b25] active:scale-[0.97] transition-transform">
                  {isHe ? 'ערוך' : 'Edit'}
                </Link>
              </div>
              <div className="px-4 pb-4 space-y-0">
                {/* Name */}
                <div className="flex items-center gap-3 py-3 border-b border-zinc-100">
                  <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
                    <User size={15} strokeWidth={1.6} className="text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-900">{isHe ? 'שם מלא' : 'Full Name'}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{fullName || (isHe ? 'לא צוין' : 'Not set')}</p>
                  </div>
                </div>
                {/* Phone */}
                <div className="flex items-center gap-3 py-3 border-b border-zinc-100">
                  <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
                    <Phone size={15} strokeWidth={1.6} className="text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-900">{isHe ? 'טלפון' : 'Phone'}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{phone || (isHe ? 'לא צוין' : 'Not set')}</p>
                  </div>
                </div>
                {/* Email */}
                <div className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
                    <Mail size={15} strokeWidth={1.6} className="text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-900">{isHe ? 'אימייל' : 'Email'}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{user?.email ?? ''}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Professional Info ---- */}
            <Link
              to="/profile/edit"
              className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3 active:scale-[0.97] transition-transform block"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-50 flex items-center justify-center">
                <Wrench size={16} className="text-zinc-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-zinc-900">{isHe ? 'מידע מקצועי' : 'Professional Info'}</p>
                <p className="text-[10px] text-zinc-400">{isHe ? 'שירותים, אזורים, העדפות' : 'Services, areas, preferences'}</p>
              </div>
              <ChevronRight size={14} className="text-zinc-300 flex-shrink-0" />
            </Link>

            {/* ---- Communication Channels ---- */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5">
                <p className="text-[14px] font-semibold text-zinc-900">{isHe ? 'ערוצי תקשורת' : 'Communication'}</p>
              </div>
              <div className="px-4 pb-4 space-y-0">
                {/* WhatsApp */}
                <div className="flex items-center gap-3 py-3 border-b border-zinc-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isWhatsAppConnected ? 'bg-[#25D366]' : 'bg-[#25D366]'}`}>
                    <MessageCircle size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-900">WhatsApp</p>
                    <p className={`text-[10px] ${isWhatsAppConnected ? 'text-green-500' : 'text-zinc-400'}`}>
                      {isWhatsAppConnected ? (whatsappPhone ?? (isHe ? 'מחובר' : 'Connected')) : (isHe ? 'לא מחובר' : 'Not connected')}
                    </p>
                  </div>
                  {isWhatsAppConnected ? (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  ) : (
                    <button
                      onClick={handleConnectWhatsApp}
                      disabled={waPolling}
                      className="text-[11px] font-semibold text-[#fe5b25] bg-[#fee8df] px-3 py-1.5 rounded-full active:scale-[0.97] transition-transform"
                    >
                      {waPolling ? <Loader2 size={12} className="animate-spin" /> : (isHe ? 'חבר' : 'Connect')}
                    </button>
                  )}
                </div>

                {/* Telegram */}
                <div className="flex items-center gap-3 py-3 border-b border-zinc-100">
                  <div className="w-8 h-8 rounded-lg bg-[#0088CC] flex items-center justify-center">
                    <Send size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-900">Telegram</p>
                    <p className={`text-[10px] ${isTelegramConnected ? 'text-green-500' : 'text-zinc-400'}`}>
                      {isTelegramConnected ? (isHe ? 'מחובר' : 'Connected') : (isHe ? 'לא מחובר' : 'Not connected')}
                    </p>
                  </div>
                  {isTelegramConnected ? (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  ) : (
                    <button
                      onClick={() => navigate('/telegram')}
                      className="text-[11px] font-semibold text-[#fe5b25] bg-[#fee8df] px-3 py-1.5 rounded-full active:scale-[0.97] transition-transform"
                    >
                      {isHe ? 'חבר' : 'Connect'}
                    </button>
                  )}
                </div>

                {/* Push */}
                <div className="flex items-center gap-3 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pushStatus === 'granted' ? 'bg-[#fe5b25]' : 'bg-zinc-400'}`}>
                    <Bell size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-900">{isHe ? 'התראות פוש' : 'Push Alerts'}</p>
                    <p className={`text-[10px] ${pushStatus === 'granted' ? 'text-green-500' : pushStatus === 'denied' ? 'text-red-500' : 'text-zinc-400'}`}>
                      {pushStatus === 'granted'
                        ? (isHe ? 'מופעל' : 'Enabled')
                        : pushStatus === 'denied'
                          ? (isHe ? 'חסום' : 'Blocked')
                          : pushStatus === 'unsupported'
                            ? (isHe ? 'לא נתמך' : 'Not supported')
                            : (isHe ? 'כבוי' : 'Not enabled')}
                    </p>
                  </div>
                  {pushStatus === 'granted' ? (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  ) : pushStatus === 'denied' || pushStatus === 'unsupported' ? (
                    <span className="text-[10px] text-zinc-400">{pushStatus === 'denied' ? (isHe ? 'חסום בדפדפן' : 'Blocked') : (isHe ? 'לא נתמך' : 'N/A')}</span>
                  ) : (
                    <button
                      onClick={enablePush}
                      disabled={pushLoading}
                      className="text-[11px] font-semibold text-[#fe5b25] bg-[#fee8df] px-3 py-1.5 rounded-full active:scale-[0.97] transition-transform disabled:opacity-60"
                    >
                      {pushLoading ? <Loader2 size={12} className="animate-spin" /> : (isHe ? 'הפעל' : 'Enable')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ---- Save Button (mobile) ---- */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#fe5b25] text-white text-[14px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : saved ? (
                <>
                  <CheckCircle size={16} />
                  {t('profile.saved')}
                </>
              ) : (
                <>
                  <Save size={16} />
                  {t('profile.save')}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* ---- Working Hours ---- */}
            <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3.5">
                <p className="text-[14px] font-semibold text-zinc-900">{isHe ? 'שעות עבודה' : 'Working Hours'}</p>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {(isHe
                  ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
                  : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                ).map((d, i) => (
                  <div key={d} className="flex items-center justify-between">
                    <span className={`text-[12px] font-semibold w-12 ${i >= 5 ? 'text-zinc-300' : 'text-zinc-700'}`}>{d}</span>
                    {i >= 5 ? (
                      <span className="text-[11px] text-zinc-300">{isHe ? 'חופש' : 'Off'}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] bg-zinc-50 px-2.5 py-1 rounded-lg text-zinc-600">8:00 AM</span>
                        <span className="text-[10px] text-zinc-300">&mdash;</span>
                        <span className="text-[11px] bg-zinc-50 px-2.5 py-1 rounded-lg text-zinc-600">6:00 PM</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ---- Subscription Card ---- */}
            <Link
              to="/subscription"
              className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3 active:scale-[0.97] transition-transform block"
            >
              <div className="w-9 h-9 rounded-xl bg-[#fe5b25] flex items-center justify-center">
                <Star size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-zinc-900">{isHe ? 'מנוי' : 'Subscription'}</p>
                <p className="text-[10px] text-zinc-400">{isHe ? 'נהל את התוכנית שלך' : 'Manage your plan'}</p>
              </div>
              <ChevronRight size={14} className="text-zinc-300 flex-shrink-0" />
            </Link>
          </div>
        )}
      </div>

      {/* ===================== DESKTOP VIEW ===================== */}
      <div className="hidden md:block">
        <div className="animate-fade-in max-w-3xl mx-auto space-y-6 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-[#fee8df] text-[#c43d10]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">{t('profile.title')}</h1>
              <p className="text-sm text-zinc-500">Manage your personal information</p>
            </div>
          </div>

          <div className="stagger-children space-y-5">
            {/* --- Personal Info --- */}
            <section className="glass-panel p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <User className="h-4 w-4 text-[#e04d1c]" />
                Personal Information
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setSaved(false) }}
                      placeholder="John Doe"
                      className="w-full rounded-xl border border-zinc-200 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fee8df] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-500">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="email"
                      value={user?.email ?? ''}
                      readOnly
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-500">Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setSaved(false) }}
                      placeholder="+1 (555) 123-4567"
                      className="w-full rounded-xl border border-zinc-200 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#fe5b25] focus:ring-2 focus:ring-[#fee8df] transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* --- Communication Channels --- */}
            <section className="glass-panel p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <Radio className="h-4 w-4 text-[#e04d1c]" />
                Communication Channels
              </div>
              <p className="text-xs text-zinc-400">Choose how you want to receive leads and updates</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* WhatsApp Channel */}
                <div className={`rounded-xl border p-5 transition-all ${
                  isWhatsAppConnected
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-zinc-200 bg-white hover:border-[#fe5b25]/30 hover:shadow-sm'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isWhatsAppConnected ? 'bg-green-500' : 'bg-[#25D366]'
                    }`}>
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-zinc-900">WhatsApp</p>
                      {isWhatsAppConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                        </span>
                      ) : (
                        <p className="text-[10px] text-zinc-400">Receive leads on WhatsApp</p>
                      )}
                    </div>
                  </div>

                  {isWhatsAppConnected ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-500">
                        Connected as: <span className="font-mono font-semibold text-zinc-700">{whatsappPhone}</span>
                      </p>
                      <p className="text-[10px] text-zinc-400">Leads will be sent to this number</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-zinc-500 mb-3">
                        Send us a message on WhatsApp to connect your account instantly.
                      </p>
                      <button
                        type="button"
                        onClick={handleConnectWhatsApp}
                        disabled={waPolling}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-[#25D366] text-white hover:bg-[#1da851] shadow-sm disabled:opacity-70"
                      >
                        {waPolling ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Waiting for message...
                          </>
                        ) : (
                          <>
                            <MessageCircle className="h-4 w-4" />
                            Connect WhatsApp
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Telegram Channel */}
                <div className={`rounded-xl border p-5 transition-all ${
                  isTelegramConnected
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-zinc-200 bg-white hover:border-[#fe5b25]/30 hover:shadow-sm'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isTelegramConnected ? 'bg-blue-500' : 'bg-[#0088CC]'
                    }`}>
                      <Send className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-zinc-900">Telegram</p>
                      {isTelegramConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                        </span>
                      ) : (
                        <p className="text-[10px] text-zinc-400">Receive leads via Telegram bot</p>
                      )}
                    </div>
                  </div>

                  {isTelegramConnected ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-500">
                        Chat ID: <span className="font-mono font-semibold text-zinc-700">{telegramChatId}</span>
                      </p>
                      <p className="text-[10px] text-zinc-400">Leads are sent to your Telegram</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-zinc-500 mb-3">
                        Connect our Telegram bot to get instant lead notifications.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/telegram')}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-[#0088CC] text-white hover:bg-[#006da8] shadow-sm"
                      >
                        <Send className="h-4 w-4" />
                        Connect Telegram
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Push Notifications Channel */}
                <div className={`rounded-xl border p-5 transition-all ${
                  pushStatus === 'granted'
                    ? 'border-orange-200 bg-orange-50/50'
                    : 'border-zinc-200 bg-white hover:border-[#fe5b25]/30 hover:shadow-sm'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      pushStatus === 'granted' ? 'bg-[#fe5b25]' : 'bg-zinc-400'
                    }`}>
                      <Bell className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-zinc-900">Push Alerts</p>
                      {pushStatus === 'granted' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#e04d1c] bg-orange-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Enabled
                        </span>
                      ) : pushStatus === 'denied' ? (
                        <p className="text-[10px] text-red-500">Blocked by browser</p>
                      ) : pushStatus === 'unsupported' ? (
                        <p className="text-[10px] text-zinc-400">Not supported on this browser</p>
                      ) : (
                        <p className="text-[10px] text-zinc-400">Get instant alerts on this device</p>
                      )}
                    </div>
                  </div>

                  {pushStatus === 'granted' ? (
                    <p className="text-xs text-zinc-500">You'll receive instant alerts when new leads match your preferences.</p>
                  ) : pushStatus === 'denied' ? (
                    <p className="text-xs text-zinc-500">Notifications are blocked. Open your browser settings to allow notifications for this site.</p>
                  ) : pushStatus === 'unsupported' ? (
                    <p className="text-xs text-zinc-500">Try using Chrome or Safari for push notification support.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={enablePush}
                      disabled={pushLoading}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-[#fe5b25] text-white hover:brightness-110 shadow-sm disabled:opacity-70"
                    >
                      {pushLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Enabling...</>
                      ) : (
                        <><Bell className="h-4 w-4" /> Enable Push Alerts</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* --- Save Button --- */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#e04d1c] animate-fade-in">
                  <CheckCircle className="h-4 w-4" />
                  {t('profile.saved')}
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {saving ? (
                  <div className="animate-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('profile.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
