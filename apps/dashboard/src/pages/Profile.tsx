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
  ChevronDown,
  Sparkles,
  ArrowRight,
  Fingerprint,
  Camera,
  Globe,
  Briefcase,
  Image,
  Award,
  Crown,
  BadgeCheck,
  UserCircle,
  TrendingUp,
} from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useIdentityVerification } from '../hooks/useIdentityVerification'
import { useContractorProfile } from '../hooks/useContractorProfile'

const WA_NUMBER = '18623582898'

/* ── Mobile sub-sections ──────────────────────────────── */

function MobileCollapsible({ title, badge, defaultOpen = false, children }: {
  title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 active:scale-[0.97] transition-transform">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-semibold text-zinc-900">{title}</p>
          {badge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              badge === 'Complete' ? 'bg-green-50 text-green-600' : 'bg-[#fee8df] text-[#fe5b25]'
            }`}>{badge}</span>
          )}
        </div>
        <ChevronDown size={16} className={`text-[#a3a3a3] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 border-t border-[#f5f5f5]">{children}</div>}
    </div>
  )
}

function MobileProfSection({ navigate }: { navigate: (path: string) => void }) {
  return (
    <MobileCollapsible title="Professional Info" badge="Complete">
      <div className="space-y-0 mt-3">
        {[
          { Icon: Wrench, label: 'Services', val: 'Locksmith, Rekey, Smart Locks' },
          { Icon: MapPin, label: 'Service Areas', val: 'Miami-Dade, Broward' },
          { Icon: Globe, label: 'Languages', val: 'English, Spanish' },
          { Icon: Briefcase, label: 'Work Preferences', val: 'Fixed, Percentage, Sub-work' },
        ].map((item, i, arr) => (
          <button
            key={i}
            onClick={() => navigate('/profile/edit')}
            className="w-full flex items-center gap-3 py-3 active:scale-[0.97] transition-transform"
            style={{ borderBottom: i < arr.length - 1 ? '1px solid #f5f5f5' : 'none' }}
          >
            <div className="w-8 h-8 rounded-lg bg-[#fafafa] flex items-center justify-center">
              <item.Icon size={15} strokeWidth={1.6} className="text-zinc-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[12px] font-semibold text-zinc-900">{item.label}</p>
              <p className="text-[10px] text-[#737373]">{item.val}</p>
            </div>
            <ChevronRight size={14} className="text-[#a3a3a3]" />
          </button>
        ))}
      </div>
    </MobileCollapsible>
  )
}

function MobilePortfolioSection() {
  return (
    <MobileCollapsible title="Portfolio" badge="4 projects">
      <div className="mt-3">
        <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
          {['Smart Lock Install', 'Commercial Rekey', 'Emergency Lockout', 'Safe Install'].map((p, i) => (
            <div key={i} className="flex-shrink-0 w-[120px] active:scale-[0.97] transition-transform">
              <div className="aspect-[3/4] rounded-xl bg-[#f5f5f5] flex items-center justify-center mb-1.5 relative">
                <Image size={16} className="text-[#a3a3a3]" />
                <span className="absolute bottom-1 left-1 text-[8px] font-semibold bg-zinc-900/70 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">B/A</span>
              </div>
              <p className="text-[10px] font-medium truncate text-zinc-900">{p}</p>
            </div>
          ))}
          <div className="flex-shrink-0 w-[120px] active:scale-[0.97] transition-transform">
            <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-1 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-[#fee8df] flex items-center justify-center">
                <Image size={11} className="text-[#fe5b25]" />
              </div>
              <p className="text-[9px] text-[#fe5b25] font-semibold">Add</p>
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2 bg-blue-50 rounded-lg p-2.5">
          <TrendingUp size={12} className="text-blue-500" />
          <p className="text-[10px] text-blue-700">6+ projects = <strong>40% more inquiries</strong></p>
        </div>
      </div>
    </MobileCollapsible>
  )
}

function MobileCommSection({
  isWhatsAppConnected, whatsappPhone,
  pushStatus, pushLoading, waPolling,
  handleConnectWhatsApp, enablePush, navigate,
}: {
  isWhatsAppConnected: boolean; whatsappPhone: string | null
  pushStatus: string; pushLoading: boolean; waPolling: boolean
  handleConnectWhatsApp: () => void; enablePush: () => void; navigate: (path: string) => void
}) {
  const channels = [
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      bg: 'bg-[#25D366]',
      ok: isWhatsAppConnected,
      status: isWhatsAppConnected ? (whatsappPhone ?? 'Connected') : 'Not connected',
      action: () => handleConnectWhatsApp(),
    },
    {
      icon: Bell,
      label: 'Push Notifications',
      bg: pushStatus === 'granted' ? 'bg-[#fe5b25]' : 'bg-zinc-400',
      ok: pushStatus === 'granted',
      status: pushStatus === 'granted' ? 'Enabled' : pushStatus === 'denied' ? 'Blocked' : pushStatus === 'unsupported' ? 'Not supported' : 'Not enabled',
      action: () => enablePush(),
    },
  ]
  return (
    <MobileCollapsible title="Communication" defaultOpen={true}>
      <div className="space-y-0 mt-3">
        {channels.map((ch, i, arr) => (
          <div key={i} className="flex items-center gap-3 py-3"
            style={{ borderBottom: i < arr.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
            <div className={`w-8 h-8 rounded-lg ${ch.bg} flex items-center justify-center`}>
              <ch.icon size={14} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-zinc-900">{ch.label}</p>
              <p className={`text-[10px] ${ch.ok ? 'text-green-500' : 'text-[#737373]'}`}>{ch.status}</p>
            </div>
            {ch.ok ? (
              <div className="w-2 h-2 rounded-full bg-green-500" />
            ) : (
              <button
                onClick={ch.action}
                disabled={ch.label === 'WhatsApp' ? waPolling : ch.label === 'Push Notifications' ? pushLoading : false}
                className="text-[11px] font-semibold text-[#fe5b25] bg-[#fee8df] px-3 py-1.5 rounded-full active:scale-[0.97] transition-transform disabled:opacity-60"
              >
                {(ch.label === 'WhatsApp' && waPolling) || (ch.label === 'Push Notifications' && pushLoading)
                  ? <Loader2 size={12} className="animate-spin" />
                  : 'Connect'}
              </button>
            )}
          </div>
        ))}
      </div>
    </MobileCollapsible>
  )
}

function MobileWorkingHoursSection() {
  return (
    <MobileCollapsible title="Working Hours">
      <div className="space-y-2 mt-3">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
          <div key={d} className="flex items-center justify-between">
            <span className={`text-[12px] font-semibold w-10 ${i >= 5 ? 'text-[#a3a3a3]' : 'text-zinc-700'}`}>{d}</span>
            {i >= 5 ? (
              <span className="text-[11px] text-[#a3a3a3]">Off</span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[11px] bg-[#fafafa] px-2.5 py-1 rounded-lg text-zinc-600">8:00 AM</span>
                <span className="text-[10px] text-[#a3a3a3]">—</span>
                <span className="text-[11px] bg-[#fafafa] px-2.5 py-1 rounded-lg text-zinc-600">6:00 PM</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </MobileCollapsible>
  )
}

function MobilePreferencesSection() {
  return (
    <MobileCollapsible title="Preferences">
      <div className="space-y-0 mt-3">
        {[{l:'Language',v:'English'},{l:'Distance',v:'Miles'},{l:'Notifications',v:'On'}].map((p, i, arr) => (
          <div key={i} className="flex items-center justify-between py-3"
            style={{ borderBottom: i < arr.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
            <p className="text-[12px] font-semibold text-zinc-900">{p.l}</p>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#737373]">{p.v}</span>
              <ChevronRight size={13} className="text-[#a3a3a3]" />
            </div>
          </div>
        ))}
      </div>
    </MobileCollapsible>
  )
}

export default function Profile() {
  const { user, profile, refreshProfile, effectiveUserId, impersonatedProfile } = useAuth()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const isHe = locale === 'he'

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null)

  const { status: pushStatus, enable: enablePush, isLoading: pushLoading } = usePushNotifications()
  const { isVerified: identityVerified, isPending: identityPending } = useIdentityVerification()
  const { data: contractorData } = useContractorProfile()
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
      .select('full_name, phone, whatsapp_phone')
      .eq('id', effectiveUserId)
      .maybeSingle()

    const activeProfile = impersonatedProfile || profile
    if (data) {
      setFullName(data.full_name ?? '')
      setPhone(data.phone ?? '')
      setWhatsappPhone(data.whatsapp_phone ?? null)
    } else {
      setFullName(activeProfile?.full_name ?? '')
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

  const isWhatsAppConnected = !!whatsappPhone

  // Helper: initials from name
  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  // Profile strength calculation
  const strengthSegments = [
    !!fullName,
    !!phone,
    isWhatsAppConnected,
    pushStatus === 'granted',
    identityVerified,
  ]
  const filledSegments = strengthSegments.filter(Boolean).length
  const strengthPercent = Math.round((filledSegments / 5) * 100)

  return (
    <>
      {/* ===================== MOBILE VIEW ===================== */}
      <div className="md:hidden fixed inset-0 z-30 overflow-y-auto bg-[#fafafa]">
        <div className="px-4 pt-5 pb-24 space-y-5">

        {/* ---- HERO CARD ---- */}
        <div className="bg-[#111] rounded-[20px] p-5 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#fe5b25] rounded-full opacity-[0.08] -translate-y-10 translate-x-10" />

          {/* Avatar + Info */}
          <div className="flex items-center gap-3.5 mb-4 relative">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-white text-[22px] font-bold">
                {initials}
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#fe5b25] rounded-full flex items-center justify-center border-2 border-[#111]">
                <Camera size={10} className="text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[18px] font-bold text-white tracking-tight truncate">{fullName || 'Your Name'}</h2>
                <Shield size={14} className="text-[#fe5b25] flex-shrink-0" />
              </div>
              <p className="text-[12px] text-white/40 truncate">
                {contractorData?.professions?.[0] ?? 'Contractor'}
                {contractorData?.counties?.[0] ? ` · ${contractorData.counties[0]}` : ''}
                {contractorData?.profile?.years_experience ? ` · ${contractorData.profile.years_experience} yrs` : ''}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {contractorData?.profile?.avg_rating ? (
                  <span className="flex items-center gap-0.5 text-[11px] text-amber-400 font-semibold">
                    <Star size={10} fill="#fbbf24" /> {contractorData.profile.avg_rating.toFixed(1)} <span className="text-white/25 font-normal">({contractorData.profile.review_count ?? 0})</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-white/30">{isHe ? 'אין דירוג עדיין' : 'No rating yet'}</span>
                )}
              </div>
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

          {/* Tier journey */}
          {(() => {
            const tierDefs = [
              { name: 'New', Icon: UserCircle, reached: true },
              { name: 'Verified', Icon: BadgeCheck, reached: identityVerified },
              { name: 'Trusted', Icon: Award, reached: false, current: !identityVerified },
              { name: 'Elite', Icon: Crown, reached: false },
            ]
            return (
              <div className="flex items-center gap-1 mb-4">
                {tierDefs.map((t, i, arr) => (
                  <div key={i} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                        t.reached ? 'bg-green-500/20' : t.current ? 'bg-[#fe5b25]/20 ring-[1.5px] ring-[#fe5b25]' : 'bg-white/5'
                      }`}>
                        <t.Icon size={15} strokeWidth={1.8} className={
                          t.reached ? 'text-green-400' : t.current ? 'text-[#fe5b25]' : 'text-white/15'
                        } />
                      </div>
                      <span className={`text-[9px] font-medium ${
                        t.reached ? 'text-green-400' : t.current ? 'text-[#fe5b25]' : 'text-white/15'
                      }`}>{t.name}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`h-0.5 w-full mt-[-14px] ${t.reached ? 'bg-green-500/30' : 'bg-white/5'}`} />
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

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
            <span className="text-[13px] font-medium text-white/60">Preview my public profile</span>
          </button>
        </div>

        {/* ---- UNLOCK TRUSTED CARD ---- */}
        <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-zinc-900">Unlock <span className="text-green-600">Trusted</span></p>
              <p className="text-[11px] text-[#737373]">3x more leads & featured placement</p>
            </div>
          </div>

          {/* Incomplete steps */}
          <div className="space-y-2">
            {!identityVerified && (
              <button
                onClick={() => navigate('/verify-identity')}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#fafafa] active:scale-[0.97] transition-transform"
              >
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <Fingerprint size={15} className="text-zinc-900" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-semibold text-zinc-900">Identity Verification</p>
                  <p className="text-[10px] text-[#737373]">ID + selfie · Get verified badge ✓</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold text-green-600">+30% more leads</span>
                  <ArrowRight size={12} className="text-[#a3a3a3]" />
                </div>
              </button>
            )}
            <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#fafafa] active:scale-[0.97] transition-transform">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <Shield size={15} className="text-zinc-900" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[13px] font-semibold text-zinc-900">Trade License</p>
                <p className="text-[10px] text-[#737373]">Upload license (optional)</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-bold text-green-600">+10% more leads</span>
                <ArrowRight size={12} className="text-[#a3a3a3]" />
              </div>
            </button>
          </div>

          {/* Done items */}
          <div className="flex items-center gap-2 mt-3 px-1">
            {!!fullName && (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-green-500" />
                <span className="text-[10px] text-green-600">Profile Photo</span>
              </div>
            )}
            {!!phone && (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-green-500" />
                <span className="text-[10px] text-green-600">Phone Verified</span>
              </div>
            )}
          </div>
        </div>

        {/* ---- TAB SWITCHER ---- */}
        <div className="flex bg-[#f5f5f5] rounded-xl p-1 mb-5">
          <button
            onClick={() => setMobileTab('profile')}
            className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
              mobileTab === 'profile' ? 'bg-white shadow-sm text-zinc-900' : 'text-[#737373]'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setMobileTab('settings')}
            className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
              mobileTab === 'settings' ? 'bg-white shadow-sm text-zinc-900' : 'text-[#737373]'
            }`}
          >
            Settings
          </button>
        </div>

        {mobileTab === 'profile' ? (
          <div className="space-y-3">

            {/* Professional Info collapsible */}
            <MobileProfSection navigate={navigate} />

            {/* Portfolio */}
            <MobilePortfolioSection />

            {/* Reviews */}
            <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-semibold text-zinc-900">{isHe ? 'ביקורות' : 'Reviews'}</p>
                <span className="text-[11px] text-[#737373]">{contractorData?.profile?.review_count ?? 0} {isHe ? 'סה״כ' : 'total'}</span>
              </div>
              {contractorData?.profile?.avg_rating ? (
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <p className="text-[26px] font-bold tracking-tight">{contractorData.profile.avg_rating.toFixed(1)}</p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={9} className={i <= Math.round(contractorData.profile!.avg_rating!) ? 'text-amber-400' : 'text-gray-200'} fill={i <= Math.round(contractorData.profile!.avg_rating!) ? '#fbbf24' : '#e5e7eb'} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Star size={24} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-[12px] text-[#737373]">{isHe ? 'אין ביקורות עדיין' : 'No reviews yet'}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">

            {/* Communication section */}
            <MobileCommSection
              isWhatsAppConnected={isWhatsAppConnected}
              whatsappPhone={whatsappPhone}
              pushStatus={pushStatus}
              pushLoading={pushLoading}
              waPolling={waPolling}
              handleConnectWhatsApp={handleConnectWhatsApp}
              enablePush={enablePush}
              navigate={navigate}
            />

            {/* Working Hours */}
            <MobileWorkingHoursSection />

            {/* Preferences */}
            <MobilePreferencesSection />

            {/* Premium Plan */}
            <button
              onClick={() => navigate('/subscription')}
              className="w-full bg-white rounded-[20px] border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-center gap-3 active:scale-[0.97] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-[#fe5b25] flex items-center justify-center">
                <Star size={14} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[13px] font-semibold text-zinc-900">Premium Plan</p>
                <p className="text-[10px] text-[#737373]">$79/mo · Renews Apr 15</p>
              </div>
              <ChevronRight size={14} className="text-[#a3a3a3]" />
            </button>
          </div>
        )}

        </div>
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
