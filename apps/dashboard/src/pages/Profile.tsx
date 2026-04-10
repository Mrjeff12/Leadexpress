import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { PROFESSIONS } from '../lib/professions'
import { PROFESSION_ICONS } from '../lib/profession-icons'
import ProfessionGrid from '../components/settings/ProfessionGrid'
import ServiceAreaSelector, { type SelectedArea } from '../components/settings/ServiceAreaSelector'
import { QRCodeCanvas } from 'qrcode.react'
import {
  User, Phone, Mail, Save, CheckCircle2,
  MessageCircle, ExternalLink, Loader2, Bell, Star,
  MapPin, Eye, Sparkles, Fingerprint,
  Camera, Globe, Briefcase, Award, Crown, BadgeCheck, UserCircle,
  Copy, Download, ShieldCheck, ChevronRight, X, Settings, Radio, Clock,
} from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useIdentityVerification } from '../hooks/useIdentityVerification'
import { useContractorProfile } from '../hooks/useContractorProfile'
import { useToast } from '../components/hooks/use-toast'

const WA_NUMBER = '18623582898'
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const dayIdxToKey = (i: number) => DAY_KEYS[i] ?? 'mon'
const dayKeyToIdx = (k: string) => DAY_KEYS.indexOf(k as typeof DAY_KEYS[number])

const LANGUAGE_OPTIONS = [
  { value: 'English', label: 'English', labelHe: 'אנגלית' },
  { value: 'Hebrew', label: 'Hebrew', labelHe: 'עברית' },
  { value: 'Spanish', label: 'Spanish', labelHe: 'ספרדית' },
  { value: 'Russian', label: 'Russian', labelHe: 'רוסית' },
  { value: 'Arabic', label: 'Arabic', labelHe: 'ערבית' },
]

/* ═══════════════════════════════════════════════════
   Bottom Sheet
   ═══════════════════════════════════════════════════ */

function BottomSheet({ open, onClose, title, children, fullScreen = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; fullScreen?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        className={`absolute bg-white rounded-t-[20px] shadow-2xl animate-slide-up overflow-hidden flex flex-col
          ${fullScreen
            ? 'inset-0 rounded-none'
            : 'bottom-0 left-0 right-0 max-h-[85vh]'
          }`}
      >
        {/* Handle + header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
          {!fullScreen && (
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-3">
            <h3 className="text-[16px] font-bold text-zinc-900">{title}</h3>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Summary Card — Neumorphic 3D raised style
   ═══════════════════════════════════════════════════ */

function SummaryCard({ icon: Icon, customIcon, title, children, onClick, accent = '#fe5b25', complete, wide }: {
  icon?: React.ElementType; customIcon?: ReactNode; title: string; children: ReactNode; onClick: () => void
  accent?: string; complete?: boolean; wide?: boolean
}) {
  return (
    <button onClick={onClick}
      className={`w-full rounded-[24px] p-4 pb-5 text-left active:scale-[0.97]
                 hover:translate-y-[-3px] transition-all duration-300 group relative
                 animate-fade-in ${wide ? 'col-span-2 md:col-span-3' : ''}`}
      style={{
        background: 'linear-gradient(165deg, #ffffff 0%, #faf9f7 50%, #f5f3f0 100%)',
        boxShadow: `
          0 1px 2px rgba(0,0,0,0.04),
          0 4px 8px rgba(0,0,0,0.04),
          0 12px 24px rgba(0,0,0,0.06),
          0 24px 48px rgba(0,0,0,0.04),
          inset 0 1px 0 rgba(255,255,255,1),
          inset 0 -1px 2px rgba(0,0,0,0.02)
        `,
        border: '1px solid rgba(0,0,0,0.06)',
      }}>
      {/* Status dot */}
      {complete !== undefined && (
        <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3">
          <div className={`w-2.5 h-2.5 rounded-full ${complete ? 'bg-green-400' : 'bg-amber-400'}`}
            style={{ boxShadow: complete ? '0 0 6px rgba(74,222,128,0.4)' : '0 0 6px rgba(251,191,36,0.4)' }} />
        </div>
      )}
      {/* Icon + content layout */}
      <div className={wide ? 'flex items-start gap-4' : ''}>
        {/* Icon — neumorphic raised bubble */}
        <div className={`${wide ? '' : 'mb-3'} flex items-center ${wide ? '' : 'justify-between'}`}>
          <div className={`${wide ? 'w-14 h-14' : 'w-12 h-12'} rounded-[16px] flex items-center justify-center flex-shrink-0`}
            style={{
              background: `linear-gradient(145deg, ${accent}18 0%, ${accent}08 100%)`,
              boxShadow: `0 2px 8px ${accent}15, inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 2px ${accent}10`,
              border: `1px solid ${accent}15`,
            }}>
            {customIcon
              ? <div style={{ color: accent, width: wide ? 28 : 24, height: wide ? 28 : 24 }}>{customIcon}</div>
              : Icon && <Icon size={wide ? 24 : 20} style={{ color: accent }} strokeWidth={2} />
            }
          </div>
          {!wide && (
            <div className="w-7 h-7 rounded-full flex items-center justify-center group-hover:translate-x-0.5 transition-transform"
              style={{ background: 'linear-gradient(145deg, #f5f3f0, #eae8e4)', boxShadow: '0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)' }}>
              <ChevronRight size={13} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`${wide ? 'text-[17px]' : 'text-[15px]'} font-bold text-zinc-800 tracking-tight mb-1.5`}>{title}</h3>
            {wide && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center group-hover:translate-x-0.5 transition-transform"
                style={{ background: 'linear-gradient(145deg, #f5f3f0, #eae8e4)', boxShadow: '0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)' }}>
                <ChevronRight size={13} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
              </div>
            )}
          </div>
          <div className="text-[12px] text-zinc-500 leading-relaxed">{children}</div>
        </div>
      </div>
    </button>
  )
}

/* ═══════════════════════════════════════════════════
   Sheet form helpers
   ═══════════════════════════════════════════════════ */

function SheetLabel({ children }: { children: ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1.5">{children}</label>
}

function SheetInput({ value, onChange, placeholder, type = 'text', disabled = false, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; disabled?: boolean; maxLength?: number
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled} maxLength={maxLength}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white
                 text-sm text-gray-800 placeholder:text-gray-400
                 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/30 focus:border-[#fe5b25]/50
                 transition-all disabled:opacity-50 disabled:bg-gray-50" />
  )
}

function SheetToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#fe5b25]' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

function SheetSaveButton({ onClick, saving, isHe }: { onClick: () => void; saving: boolean; isHe: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={saving}
      className="w-full mt-4 py-3 rounded-2xl bg-[#fe5b25] text-white font-semibold text-sm
                 flex items-center justify-center gap-2
                 hover:bg-[#e5501f] active:scale-[0.98] transition-all shadow-lg shadow-[#fe5b25]/20
                 disabled:opacity-50">
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {isHe ? 'שמור' : 'Save'}
    </button>
  )
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export default function Profile() {
  const { user, profile, refreshProfile, effectiveUserId, impersonatedProfile } = useAuth()
  const { t, locale } = useI18n()
  const isHe = locale === 'he'
  const { toast } = useToast()

  const { status: pushStatus, enable: enablePush, isLoading: pushLoading } = usePushNotifications()
  const { isVerified: identityVerified, isPending: identityPending } = useIdentityVerification()
  const {
    data: contractorData, isLoading: profileLoading,
    save: saveContractorProfile, isSaving: cpSaving,
    publishProfile, isPublishing, refetch,
  } = useContractorProfile()

  /* ── State ── */
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [acceptsPercentage, setAcceptsPercentage] = useState(true)
  const [acceptsFixed, setAcceptsFixed] = useState(true)
  const [acceptsSubwork, setAcceptsSubwork] = useState(true)
  const [minJobValue, setMinJobValue] = useState('')
  const [maxJobValue, setMaxJobValue] = useState('')
  const [availableToday, setAvailableToday] = useState(false)
  const [workingDays, setWorkingDays] = useState<string[]>(['mon','tue','wed','thu','fri'])
  const [workingHoursStart, setWorkingHoursStart] = useState('08:00')
  const [workingHoursEnd, setWorkingHoursEnd] = useState('18:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [waPolling, setWaPolling] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
  const [editProfessions, setEditProfessions] = useState<string[]>([])
  const [editAreas, setEditAreas] = useState<SelectedArea[]>([])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Load personal info ── */
  const loadProfile = useCallback(async () => {
    if (!effectiveUserId) return
    setLoading(true)
    const { data } = await supabase
      .from('profiles').select('full_name, phone, whatsapp_phone')
      .eq('id', effectiveUserId).maybeSingle()
    const active = impersonatedProfile || profile
    if (data) {
      setFullName(data.full_name ?? '')
      setPhone(data.phone ?? '')
      setWhatsappPhone(data.whatsapp_phone ?? null)
    } else {
      setFullName(active?.full_name ?? '')
    }
    setLoading(false)
  }, [effectiveUserId, profile, impersonatedProfile])

  useEffect(() => { loadProfile() }, [loadProfile])

  /* ── Seed contractor profile ── */
  useEffect(() => {
    if (!contractorData) return
    const p = contractorData.profile
    setBusinessName(p.business_name ?? '')
    setLicenseNumber(p.license_number ?? '')
    setLanguages(p.languages ?? [])
    setWebsiteUrl(p.website_url ?? '')
    setAcceptsPercentage(p.accepts_percentage ?? true)
    setAcceptsFixed(p.accepts_fixed ?? true)
    setAcceptsSubwork(p.accepts_subwork ?? true)
    setMinJobValue(p.min_job_value != null ? String(p.min_job_value) : '')
    setMaxJobValue(p.max_job_value != null ? String(p.max_job_value) : '')
  }, [contractorData])

  /* ── Load availability from contractors table ── */
  useEffect(() => {
    if (!effectiveUserId) return
    ;(async () => {
      const { data } = await supabase
        .from('contractors')
        .select('available_today, working_days, working_hours')
        .eq('user_id', effectiveUserId)
        .maybeSingle()
      if (data) {
        setAvailableToday(data.available_today ?? false)
        if (data.working_days?.length) setWorkingDays(
          typeof data.working_days[0] === 'number'
            ? data.working_days.map((d: number) => dayIdxToKey(d))
            : data.working_days.map(String)
        )
        if (data.working_hours) {
          setWorkingHoursStart(data.working_hours.start ?? '08:00')
          setWorkingHoursEnd(data.working_hours.end ?? '18:00')
        }
      }
    })()
  }, [effectiveUserId])

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current) } }, [])

  /* ── Handlers ── */

  function handleConnectWhatsApp() {
    const code = effectiveUserId ? effectiveUserId.slice(0, 8) : 'unknown'
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hey! Connect my account. Code: LE-${code}`)}`, '_blank')
    setWaPolling(true)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (!effectiveUserId) return
      const { data } = await supabase.from('profiles').select('whatsapp_phone').eq('id', effectiveUserId).maybeSingle()
      if (data?.whatsapp_phone) {
        setWhatsappPhone(data.whatsapp_phone)
        setWaPolling(false)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 3000)
    setTimeout(() => { setWaPolling(false); if (pollRef.current) clearInterval(pollRef.current) }, 120_000)
  }

  async function saveCredentials() {
    if (!effectiveUserId) return
    setSaving(true)
    try {
      await saveContractorProfile({
        business_name: businessName || null,
        license_number: licenseNumber || null,
        languages, website_url: websiteUrl || null,
      })
      toast({ title: isHe ? 'נשמר' : 'Saved' })
      setActiveSheet(null)
    } catch { toast({ title: isHe ? 'שגיאה' : 'Error', variant: 'destructive' }) }
    setSaving(false)
  }

  async function saveWorkPrefs() {
    if (!effectiveUserId) return
    setSaving(true)
    try {
      await saveContractorProfile({
        accepts_percentage: acceptsPercentage, accepts_fixed: acceptsFixed, accepts_subwork: acceptsSubwork,
        min_job_value: minJobValue ? Number(minJobValue) : null,
        max_job_value: maxJobValue ? Number(maxJobValue) : null,
      })
      // Save availability to contractors table
      await supabase
        .from('contractors')
        .update({
          available_today: availableToday,
          working_days: workingDays.map(dayKeyToIdx).filter(i => i >= 0),
          working_hours: { start: workingHoursStart, end: workingHoursEnd },
        })
        .eq('user_id', effectiveUserId)
      toast({ title: isHe ? 'נשמר' : 'Saved' })
      setActiveSheet(null)
    } catch { toast({ title: isHe ? 'שגיאה' : 'Error', variant: 'destructive' }) }
    setSaving(false)
  }

  async function saveAccount() {
    if (!effectiveUserId) return
    setSaving(true)
    try {
      await supabase.from('profiles').upsert({ id: effectiveUserId, full_name: fullName.trim(), phone: phone.trim() })
      await refreshProfile()
      toast({ title: isHe ? 'נשמר' : 'Saved' })
      setActiveSheet(null)
    } catch { toast({ title: isHe ? 'שגיאה' : 'Error', variant: 'destructive' }) }
    setSaving(false)
  }

  async function saveProfessions() {
    if (!effectiveUserId) return
    setSaving(true)
    try {
      await supabase.from('contractors').update({ professions: editProfessions }).eq('user_id', effectiveUserId)
      await refetch()
      toast({ title: isHe ? 'נשמר' : 'Saved' })
      setActiveSheet(null)
    } catch { toast({ title: isHe ? 'שגיאה' : 'Error', variant: 'destructive' }) }
    setSaving(false)
  }

  async function saveAreas() {
    if (!effectiveUserId) return
    setSaving(true)
    try {
      const allZips = editAreas.flatMap(a => a.zips)
      const allCounties = editAreas.map(a => a.county)
      await supabase.from('contractors').update({ zip_codes: allZips }).eq('user_id', effectiveUserId)
      await supabase.from('profiles').update({ counties: allCounties }).eq('id', effectiveUserId)
      await refetch()
      toast({ title: isHe ? 'נשמר' : 'Saved' })
      setActiveSheet(null)
    } catch { toast({ title: isHe ? 'שגיאה' : 'Error', variant: 'destructive' }) }
    setSaving(false)
  }

  async function handlePublish() {
    try {
      const slug = await publishProfile()
      toast({ title: isHe ? 'פורסם!' : 'Published!', description: `masterleadflow.com/pro/${slug}` })
    } catch { toast({ title: isHe ? 'שגיאה' : 'Error', variant: 'destructive' }) }
  }

  function handleCopyUrl() {
    if (!contractorData?.profile.slug) return
    navigator.clipboard.writeText(`https://masterleadflow.com/pro/${contractorData.profile.slug}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !effectiveUserId) return
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: isHe ? 'גדול מדי' : 'File too large', variant: 'destructive' }); return
    }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `avatars/${effectiveUserId}.${ext}`
      const { error } = await supabase.storage.from('portfolio-images').upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('portfolio-images').getPublicUrl(path)
      const bustUrl = `${urlData.publicUrl}?v=${Date.now()}`
      await saveContractorProfile({ avatar_url: bustUrl }); refetch()
      toast({ title: isHe ? 'עודכן' : 'Updated' })
    } catch { toast({ title: isHe ? 'שגיאה' : 'Error', variant: 'destructive' }) }
    finally { setAvatarUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  function openSheet(sheet: string) {
    if (sheet === 'services') setEditProfessions([...(contractorData?.professions ?? [])])
    if (sheet === 'areas') {
      // Build SelectedArea[] from current counties + zips
      const currentCounties = contractorData?.counties ?? []
      const currentZips = contractorData?.zip_codes ?? []
      // Group zips by county isn't possible without extra data, so create one entry per county with all zips
      // This is a simplification — the selector will let user re-pick properly
      setEditAreas(currentCounties.map(c => ({ state: '', stateName: '', county: c, zips: [] })))
    }
    setActiveSheet(sheet)
  }

  /* ── Computed ── */
  const initials = fullName ? fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??'
  const isWhatsAppConnected = !!whatsappPhone
  const filledSegments = [!!fullName, !!phone, isWhatsAppConnected, pushStatus === 'granted', identityVerified].filter(Boolean).length
  const strengthPercent = Math.round((filledSegments / 5) * 100)
  const publicUrl = contractorData?.profile.slug ? `https://masterleadflow.com/pro/${contractorData.profile.slug}` : null
  const professions = contractorData?.professions ?? []
  const counties = contractorData?.counties ?? []
  const zipCodes = contractorData?.zip_codes ?? []

  const tierDefs = [
    { name: 'New', Icon: UserCircle, reached: true, color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
    { name: 'Verified', Icon: BadgeCheck, reached: identityVerified, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    { name: 'Trusted', Icon: Award, reached: false, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    { name: 'Elite', Icon: Crown, reached: false, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  ]
  const currentTierIdx = identityVerified ? 1 : 0

  /* ── Loading ── */
  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#fe5b25] animate-spin" />
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════ */

  /* Card completeness indicators */
  const cardStatus = {
    services: professions.length > 0,
    areas: counties.length > 0 || zipCodes.length > 0,
    credentials: !!(businessName || licenseNumber || identityVerified),
    workprefs: true, // always has defaults
    comms: isWhatsAppConnected || pushStatus === 'granted',
    account: !!(fullName && phone),
  }

  return (
    <div className="w-full px-4 md:px-0 md:max-w-4xl md:mx-auto pb-8"
      dir={isHe ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(180deg, #faf8f5 0%, transparent 400px)' }}>

      {/* ━━━━━━━━━━━━━━━ HERO CARD ━━━━━━━━━━━━━━━ */}
      <div className="rounded-[24px] p-5 md:p-7 relative overflow-hidden mb-5"
        style={{
          background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          boxShadow: '0 8px 32px rgba(15,52,96,0.35), 0 2px 8px rgba(0,0,0,0.2)',
        }}>
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-[200px] h-[200px] pointer-events-none"
          style={{ background: 'radial-gradient(circle at top right, rgba(254,91,37,0.12) 0%, transparent 60%)' }} />
        <div className="absolute bottom-0 left-0 w-[150px] h-[150px] pointer-events-none"
          style={{ background: 'radial-gradient(circle at bottom left, rgba(254,91,37,0.08) 0%, transparent 60%)' }} />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Avatar + info */}
        <div className="flex items-center gap-4 mb-5 relative">
          <div className="relative">
            <div className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center text-white text-[22px] font-bold overflow-hidden"
              style={{
                background: contractorData?.profile.avatar_url ? 'transparent' : 'linear-gradient(135deg, #fe5b25 0%, #ff7a4d 100%)',
                boxShadow: '0 4px 20px rgba(254,91,37,0.3), 0 0 0 2px rgba(254,91,37,0.2)',
              }}>
              {contractorData?.profile.avatar_url
                ? <img src={contractorData.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : initials}
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)', boxShadow: '0 2px 8px rgba(254,91,37,0.4)' }}>
              {avatarUploading ? <Loader2 size={11} className="text-white animate-spin" /> : <Camera size={11} className="text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-extrabold text-white tracking-tight truncate">
                {fullName || (isHe ? 'השם שלך' : 'Your Name')}
              </h2>
              {/* Verified badge — Instagram-style blue check */}
              {identityVerified && (
                <BadgeCheck size={18} fill="#1d9bf0" className="text-white shrink-0" />
              )}
            </div>
            <p className="text-[13px] text-white/50 truncate mt-0.5">
              {professions[0] ? (isHe ? PROFESSIONS.find(p => p.id === professions[0])?.he : PROFESSIONS.find(p => p.id === professions[0])?.en) : 'Contractor'}
              {counties[0] ? ` · ${counties[0]}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {contractorData?.profile?.avg_rating ? (
                <span className="flex items-center gap-0.5 text-[11px] text-white/80 font-semibold">
                  <Star size={10} fill="#fe5b25" className="text-[#fe5b25]" /> {contractorData.profile.avg_rating.toFixed(1)}
                  <span className="text-white/30 font-normal">({contractorData.profile.review_count ?? 0})</span>
                </span>
              ) : (
                <span className="text-[11px] text-white/30">{isHe ? 'אין דירוג' : 'No rating'}</span>
              )}
              {/* Verified text removed — blue checkmark shown next to name */}
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex gap-2.5">
          {contractorData?.profile?.slug && (
            <Link to={`/pro/${contractorData.profile.slug}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-[13px] text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)',
                boxShadow: '0 4px 16px rgba(254,91,37,0.3)',
              }}>
              <Eye size={14} />
              {isHe ? 'פרופיל ציבורי' : 'View Profile'}
            </Link>
          )}
          <button onClick={() => setActiveSheet('account')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-[13px] text-white/70
                       hover:text-white hover:bg-white/10 transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Settings size={14} />
            {isHe ? 'הגדרות' : 'Settings'}
          </button>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━ CARDS GRID ━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger-children">

        {/* 1. My Services */}
        <SummaryCard wide
          customIcon={professions.length > 0 ? PROFESSION_ICONS[professions[0]] : undefined}
          icon={professions.length === 0 ? Briefcase : undefined}
          title={isHe ? 'השירותים שלי' : 'My Services'}
          onClick={() => openSheet('services')}
          complete={cardStatus.services}>
          {professions.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {professions.slice(0, 3).map(p => {
                const prof = PROFESSIONS.find(pr => pr.id === p)
                const icon = PROFESSION_ICONS[p]
                return prof ? (
                  <span key={p} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium text-zinc-600"
                    style={{ background: 'linear-gradient(145deg, #f5f3f0, #eae8e4)', boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)' }}>
                    {icon && <span style={{ color: '#fe5b25', width: 14, height: 14, display: 'inline-flex', flexShrink: 0 }} className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>}
                    {isHe ? prof.he : prof.en}
                  </span>
                ) : null
              })}
              {professions.length > 3 && (
                <span className="text-[10px] text-[#fe5b25] font-semibold">+{professions.length - 3}</span>
              )}
            </div>
          ) : (
            <span className="text-gray-400">{isHe ? 'הגדר מקצועות' : 'Set up services'}</span>
          )}
        </SummaryCard>

        {/* 2. Service Areas */}
        <SummaryCard icon={MapPin} title={isHe ? 'אזורי שירות' : 'Service Areas'} onClick={() => openSheet('areas')}
          accent="#3b82f6" complete={cardStatus.areas}>
          {counties.length > 0 || zipCodes.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1 mt-1">
                {counties.slice(0, 2).map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-zinc-600"
                    style={{ background: 'linear-gradient(145deg, #f5f3f0, #eae8e4)', boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)' }}>
                    📍 {c}
                  </span>
                ))}
                {counties.length > 2 && <span className="text-[10px] text-blue-500 font-semibold">+{counties.length - 2}</span>}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{zipCodes.length} zip codes</p>
            </>
          ) : (
            <span className="text-gray-400">{isHe ? 'הגדר אזורים' : 'Set up areas'}</span>
          )}
        </SummaryCard>

        {/* 3. Credentials */}
        <SummaryCard icon={ShieldCheck} title={isHe ? 'אישורים' : 'Credentials'} onClick={() => setActiveSheet('credentials')}
          accent="#22c55e" complete={cardStatus.credentials}>
          <div className="space-y-0.5 mt-1">
            {businessName && <p className="truncate">{businessName}</p>}
            {licenseNumber && <p className="truncate">License #{licenseNumber}</p>}
            {languages.length > 0 && <p>{languages.join(' · ')}</p>}
            {identityVerified && <p className="text-green-600 font-semibold">✓ ID {isHe ? 'מאומת' : 'Verified'}</p>}
            {!businessName && !licenseNumber && <span className="text-gray-400">{isHe ? 'הוסף פרטים' : 'Add details'}</span>}
          </div>
        </SummaryCard>

        {/* 4. Availability */}
        <SummaryCard icon={Clock} title={isHe ? 'זמינות' : 'Availability'} onClick={() => setActiveSheet('workprefs')}
          accent="#a855f7" complete={workingDays.length > 0}>
          <div className="space-y-0.5 mt-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${availableToday ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>{availableToday ? (isHe ? 'זמין היום' : 'Available today') : (isHe ? 'לא זמין' : 'Not available')}</span>
            </div>
            <p>{workingHoursStart} – {workingHoursEnd}</p>
            <p className="text-[10px]">{workingDays.map(d => String(d).slice(0,2).toUpperCase()).join(' · ')}</p>
          </div>
        </SummaryCard>

        {/* 5. Channels */}
        <SummaryCard icon={Radio} title={isHe ? 'ערוצים' : 'Channels'} onClick={() => setActiveSheet('comms')}
          accent="#10b981" complete={cardStatus.comms}>
          <div className="space-y-1 mt-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isWhatsAppConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>WhatsApp</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${pushStatus === 'granted' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Push</span>
            </div>
          </div>
        </SummaryCard>

        {/* 6. Profile & Account */}
        <SummaryCard icon={User} title={isHe ? 'חשבון' : 'Account'} onClick={() => setActiveSheet('account')}
          accent="#6366f1" complete={cardStatus.account}>
          <div className="space-y-0.5 mt-1">
            <p className="truncate">{fullName || '—'}</p>
            <p className="truncate">{phone || '—'}</p>
            {publicUrl && <p className="text-[#fe5b25] font-semibold">{isHe ? '🔗 מפורסם' : '🔗 Published'}</p>}
          </div>
        </SummaryCard>
      </div>

      {/* ━━━━━━━━━━━━━━━ BOTTOM SHEETS ━━━━━━━━━━━━━━━ */}

      {/* --- My Services --- */}
      <BottomSheet open={activeSheet === 'services'} onClose={() => setActiveSheet(null)}
        title={isHe ? 'השירותים שלי' : 'My Services'}>
        <p className="text-sm text-gray-500 mb-4">
          {isHe ? 'בחר את המקצועות שלך' : 'Select your professions'}
        </p>
        <ProfessionGrid
          selected={editProfessions as any}
          onToggle={(id) => setEditProfessions(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
          )}
        />
        <SheetSaveButton onClick={saveProfessions} saving={saving} isHe={isHe} />
      </BottomSheet>

      {/* --- Service Areas (full-screen overlay) --- */}
      <BottomSheet open={activeSheet === 'areas'} onClose={() => setActiveSheet(null)}
        title={isHe ? 'אזורי שירות' : 'Service Areas'} fullScreen>

        {/* Mini map preview */}
        {zipCodes.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-gray-200 mb-4">
            <ServiceAreaMapLazy zipCodes={zipCodes} height="180px" />
          </div>
        )}

        {/* Current selected areas */}
        {editAreas.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">{isHe ? 'אזורים נבחרים' : 'Selected areas'}</p>
            <div className="flex flex-wrap gap-1.5">
              {editAreas.map(a => (
                <span key={`${a.state}-${a.county}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs font-medium text-zinc-700">
                  <MapPin size={10} className="text-blue-400" /> {a.county}
                  <button onClick={() => setEditAreas(prev => prev.filter(p => p.county !== a.county))}
                    className="ml-0.5 text-gray-400 hover:text-red-500"><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>
        )}

        <ServiceAreaSelector
          selectedAreas={editAreas}
          onAddArea={(area) => setEditAreas(prev => [...prev, area])}
          onRemoveArea={(state, county) => setEditAreas(prev => prev.filter(a => !(a.state === state && a.county === county)))}
        />

        <SheetSaveButton onClick={saveAreas} saving={saving} isHe={isHe} />
      </BottomSheet>

      {/* --- Credentials --- */}
      <BottomSheet open={activeSheet === 'credentials'} onClose={() => setActiveSheet(null)}
        title={isHe ? 'אישורים ומסמכים' : 'Credentials'}>
        <div className="space-y-4">
          <div>
            <SheetLabel>{isHe ? 'שם העסק' : 'Business Name'}</SheetLabel>
            <SheetInput value={businessName} onChange={setBusinessName}
              placeholder={isHe ? 'שם העסק שלך' : 'Your business name'} maxLength={100} />
          </div>
          <div>
            <SheetLabel>{isHe ? 'מספר רישיון' : 'License Number'}</SheetLabel>
            <SheetInput value={licenseNumber} onChange={setLicenseNumber}
              placeholder={isHe ? 'מספר רישיון מקצועי' : 'Professional license #'} maxLength={50} />
          </div>
          <div>
            <SheetLabel>{isHe ? 'שפות' : 'Languages'}</SheetLabel>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(lang => (
                <button key={lang.value} type="button"
                  onClick={() => setLanguages(prev => prev.includes(lang.value) ? prev.filter(l => l !== lang.value) : [...prev, lang.value])}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    languages.includes(lang.value)
                      ? 'bg-[#fe5b25] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {isHe ? lang.labelHe : lang.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <SheetLabel>{isHe ? 'אתר אינטרנט' : 'Website'}</SheetLabel>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rtl:left-auto rtl:right-3" />
              <input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://yoursite.com" maxLength={200}
                className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 rounded-xl border border-gray-200
                           bg-white text-sm text-gray-800 placeholder:text-gray-400
                           focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/30 focus:border-[#fe5b25]/50 transition-all" />
            </div>
          </div>
          <div>
            <SheetLabel>{isHe ? 'אימות זהות' : 'Identity Verification'}</SheetLabel>
            <Link to="/verify-identity"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                identityVerified ? 'bg-green-50 border-green-200'
                : identityPending ? 'bg-yellow-50 border-yellow-200'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}>
              {identityVerified
                ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                : <Fingerprint className={`w-5 h-5 ${identityPending ? 'text-yellow-600' : 'text-gray-400'}`} />}
              <p className={`text-sm font-medium flex-1 ${identityVerified ? 'text-green-800' : 'text-gray-700'}`}>
                {identityVerified ? (isHe ? 'זהות מאומתת ✓' : 'Identity Verified ✓')
                  : identityPending ? (isHe ? 'בתהליך...' : 'In progress...')
                  : (isHe ? 'אמת זהות' : 'Verify your identity')}
              </p>
            </Link>
          </div>
          <SheetSaveButton onClick={saveCredentials} saving={saving} isHe={isHe} />
        </div>
      </BottomSheet>

      {/* --- Availability --- */}
      <BottomSheet open={activeSheet === 'workprefs'} onClose={() => setActiveSheet(null)}
        title={isHe ? 'זמינות' : 'Availability'}>
        <div className="space-y-5">
          {/* Available Today toggle */}
          <div className={`rounded-xl border p-4 ${availableToday ? 'border-green-200 bg-green-50/50' : 'border-zinc-200'}`}>
            <SheetToggle
              label={isHe ? 'זמין היום' : 'Available today'}
              checked={availableToday}
              onChange={setAvailableToday}
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              {isHe ? 'מראה ללקוחות שאתה זמין לעבודות היום' : 'Shows clients you\'re available for jobs today'}
            </p>
          </div>

          {/* Working Days */}
          <div>
            <SheetLabel>{isHe ? 'ימי עבודה' : 'Working days'}</SheetLabel>
            <div className="flex gap-2 mt-2">
              {[
                { key: 'sun', en: 'S', he: 'א' },
                { key: 'mon', en: 'M', he: 'ב' },
                { key: 'tue', en: 'T', he: 'ג' },
                { key: 'wed', en: 'W', he: 'ד' },
                { key: 'thu', en: 'T', he: 'ה' },
                { key: 'fri', en: 'F', he: 'ו' },
                { key: 'sat', en: 'S', he: 'ש' },
              ].map(d => {
                const active = workingDays.includes(d.key)
                return (
                  <button
                    key={d.key}
                    onClick={() => setWorkingDays(prev =>
                      active ? prev.filter(x => x !== d.key) : [...prev, d.key]
                    )}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                      active
                        ? 'bg-[#fe5b25] text-white shadow-sm'
                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                    }`}
                  >
                    {isHe ? d.he : d.en}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Working Hours */}
          <div>
            <SheetLabel>{isHe ? 'שעות עבודה' : 'Working hours'}</SheetLabel>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{isHe ? 'מ-' : 'From'}</label>
                <input
                  type="time"
                  value={workingHoursStart}
                  onChange={e => setWorkingHoursStart(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-900 outline-none focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25]/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{isHe ? 'עד' : 'Until'}</label>
                <input
                  type="time"
                  value={workingHoursEnd}
                  onChange={e => setWorkingHoursEnd(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-900 outline-none focus:border-[#fe5b25] focus:ring-1 focus:ring-[#fe5b25]/20"
                />
              </div>
            </div>
          </div>

          {/* Work type toggles (kept but secondary) */}
          <div className="space-y-1 pt-2 border-t border-zinc-100">
            <SheetLabel>{isHe ? 'סוגי עבודה' : 'Work types'}</SheetLabel>
            <SheetToggle label={isHe ? 'מחיר קבוע' : 'Fixed price'} checked={acceptsFixed} onChange={setAcceptsFixed} />
            <SheetToggle label={isHe ? 'אחוזים' : 'Percentage'} checked={acceptsPercentage} onChange={setAcceptsPercentage} />
            <SheetToggle label={isHe ? 'קבלן משנה' : 'Sub-contractor'} checked={acceptsSubwork} onChange={setAcceptsSubwork} />
          </div>

          <SheetSaveButton onClick={saveWorkPrefs} saving={saving} isHe={isHe} />
        </div>
      </BottomSheet>

      {/* --- Channels --- */}
      <BottomSheet open={activeSheet === 'comms'} onClose={() => setActiveSheet(null)}
        title={isHe ? 'ערוצים' : 'Channels'}>
        <div className="space-y-4">
          {/* WhatsApp */}
          <div className={`rounded-xl border p-4 ${isWhatsAppConnected ? 'border-green-200 bg-green-50/50' : 'border-zinc-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isWhatsAppConnected ? 'bg-green-500' : 'bg-[#25D366]'}`}>
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-zinc-900">WhatsApp</p>
                {isWhatsAppConnected
                  ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-2.5 w-2.5" /> Connected</span>
                  : <p className="text-[10px] text-zinc-400">Receive leads via WhatsApp</p>}
              </div>
            </div>
            {isWhatsAppConnected ? (
              <p className="text-xs text-zinc-500">Connected: <span className="font-mono font-semibold">{whatsappPhone}</span></p>
            ) : (
              <button onClick={handleConnectWhatsApp} disabled={waPolling}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-[#25D366] text-white hover:bg-[#1da851] disabled:opacity-70">
                {waPolling ? <><Loader2 className="h-4 w-4 animate-spin" /> Waiting...</> : <><MessageCircle className="h-4 w-4" /> Connect</>}
              </button>
            )}
          </div>

          {/* Push */}
          <div className={`rounded-xl border p-4 ${pushStatus === 'granted' ? 'border-orange-200 bg-orange-50/50' : 'border-zinc-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pushStatus === 'granted' ? 'bg-[#fe5b25]' : 'bg-zinc-400'}`}>
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-zinc-900">Push Alerts</p>
                {pushStatus === 'granted'
                  ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#e04d1c] bg-orange-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-2.5 w-2.5" /> Enabled</span>
                  : pushStatus === 'denied'
                    ? <p className="text-[10px] text-red-500">{isHe ? 'חסום' : 'Blocked'}</p>
                    : <p className="text-[10px] text-zinc-400">{isHe ? 'התראות מיידיות' : 'Instant alerts'}</p>}
              </div>
            </div>
            {pushStatus === 'granted' ? (
              <p className="text-xs text-zinc-500">{isHe ? 'התראות מיידיות על לידים חדשים.' : 'Instant alerts for new leads.'}</p>
            ) : pushStatus !== 'denied' ? (
              <button onClick={enablePush} disabled={pushLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-[#fe5b25] text-white hover:brightness-110 disabled:opacity-70">
                {pushLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> {isHe ? 'מפעיל...' : 'Enabling...'}</> : <><Bell className="h-4 w-4" /> {isHe ? 'הפעל' : 'Enable'}</>}
              </button>
            ) : (
              <p className="text-xs text-zinc-500">{isHe ? 'חסום. שנה בהגדרות הדפדפן.' : 'Blocked. Change in browser settings.'}</p>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* --- Profile & Account --- */}
      <BottomSheet open={activeSheet === 'account'} onClose={() => setActiveSheet(null)}
        title={isHe ? 'חשבון ופרופיל' : 'Profile & Account'}>
        <div className="space-y-4">
          <div>
            <SheetLabel>{isHe ? 'שם מלא' : 'Full Name'}</SheetLabel>
            <SheetInput value={fullName} onChange={setFullName} placeholder="John Doe" />
          </div>
          <div>
            <SheetLabel>{isHe ? 'טלפון' : 'Phone'}</SheetLabel>
            <SheetInput type="tel" value={phone} onChange={setPhone} placeholder="+1 (555) 123-4567" />
          </div>
          <div>
            <SheetLabel>{isHe ? 'אימייל' : 'Email'}</SheetLabel>
            <SheetInput value={user?.email ?? ''} onChange={() => {}} disabled />
          </div>

          {/* Profile Visibility */}
          <div className="pt-3 border-t border-gray-100">
            <SheetLabel>{isHe ? 'נראות פרופיל' : 'Profile Visibility'}</SheetLabel>
            {publicUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 font-mono truncate">
                    {publicUrl}
                  </div>
                  <button onClick={handleCopyUrl}
                    className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <QRCodeCanvas id="profile-qr" value={publicUrl} size={100} level="H"
                      imageSettings={{ src: '/icon.png', height: 20, width: 20, excavate: true }} />
                  </div>
                  <button onClick={() => {
                    const canvas = document.getElementById('profile-qr') as HTMLCanvasElement
                    const url = canvas.toDataURL('image/png')
                    const a = document.createElement('a'); a.href = url; a.download = 'my-profile-qr.png'; a.click()
                  }} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                    <Download className="w-3.5 h-3.5" /> {isHe ? 'הורד QR' : 'Download QR'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                <Sparkles className="w-6 h-6 text-[#fe5b25]/60 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-3">{isHe ? 'פרסם פרופיל ציבורי' : 'Publish your public profile'}</p>
                <button onClick={handlePublish} disabled={isPublishing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fe5b25] text-white text-sm font-medium hover:bg-[#e5501f] disabled:opacity-50">
                  {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  {isHe ? 'פרסם' : 'Publish'}
                </button>
              </div>
            )}
          </div>

          <SheetSaveButton onClick={saveAccount} saving={saving} isHe={isHe} />
        </div>
      </BottomSheet>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Lazy-loaded ServiceAreaMap to avoid mapbox bundle
   when not needed
   ═══════════════════════════════════════════════════ */

import { lazy, Suspense } from 'react'
const ServiceAreaMapComponent = lazy(() => import('../components/ServiceAreaMap'))

function ServiceAreaMapLazy({ zipCodes, height }: { zipCodes: string[]; height: string }) {
  return (
    <Suspense fallback={<div style={{ height }} className="bg-gray-100 animate-pulse rounded-xl" />}>
      <ServiceAreaMapComponent zipCodes={zipCodes} height={height} />
    </Suspense>
  )
}
