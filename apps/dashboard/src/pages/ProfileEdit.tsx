import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { useContractorProfile } from '../hooks/useContractorProfile'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/hooks/use-toast'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Save,
  Loader2,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Briefcase,
  MapPin,
  ArrowRight,
  Sparkles,
  User,
  ShieldCheck,
  Eye,
  Camera,
  Download,
  Fingerprint,
  CheckCircle2,
} from 'lucide-react'
import { useIdentityVerification } from '../hooks/useIdentityVerification'

/* ── Language options ──────────────────────────────── */

const LANGUAGE_OPTIONS = [
  { value: 'English',  label: 'English',  labelHe: 'אנגלית' },
  { value: 'Hebrew',   label: 'Hebrew',   labelHe: 'עברית' },
  { value: 'Spanish',  label: 'Spanish',  labelHe: 'ספרדית' },
  { value: 'Russian',  label: 'Russian',  labelHe: 'רוסית' },
  { value: 'Arabic',   label: 'Arabic',   labelHe: 'ערבית' },
]

/* ── Section wrapper ──────────────────────────────── */

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-[#fe5b25]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#fe5b25]" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

/* ── Field helpers ─────────────────────────────────── */

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
    </label>
  )
}

function InputField({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  maxLength,
  minLength,
  pattern,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
  maxLength?: number
  minLength?: number
  pattern?: string
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      minLength={minLength}
      pattern={pattern}
      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60
                 text-sm text-gray-800 placeholder:text-gray-400
                 focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/30 focus:border-[#fe5b25]/50
                 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

/* ── Main component ───────────────────────────────── */

export default function ProfileEdit() {
  const { locale } = useI18n()
  const isHe = locale === 'he'
  const { data, isLoading, save, isSaving, publishProfile, isPublishing, refetch } = useContractorProfile()
  const { effectiveUserId } = useAuth()
  const { toast } = useToast()
  const { isVerified: idVerified, isPending: idPending, status: idStatus } = useIdentityVerification()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  /* ── Local form state ── */
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [acceptsPercentage, setAcceptsPercentage] = useState(true)
  const [acceptsFixed, setAcceptsFixed] = useState(true)
  const [acceptsSubwork, setAcceptsSubwork] = useState(true)
  const [minJobValue, setMinJobValue] = useState('')
  const [maxJobValue, setMaxJobValue] = useState('')

  /* ── Seed form from fetched data ── */
  useEffect(() => {
    if (!data) return
    setHeadline(data.profile.headline ?? '')
    setBio(data.profile.bio ?? '')
    setYearsExperience(data.profile.years_experience != null ? String(data.profile.years_experience) : '')
    setBusinessName(data.profile.business_name ?? '')
    setTeamSize(data.profile.team_size != null ? String(data.profile.team_size) : '')
    setLicenseNumber(data.profile.license_number ?? '')
    setLanguages(data.profile.languages ?? [])
    setWebsiteUrl(data.profile.website_url ?? '')
    setAcceptsPercentage(data.profile.accepts_percentage ?? true)
    setAcceptsFixed(data.profile.accepts_fixed ?? true)
    setAcceptsSubwork(data.profile.accepts_subwork ?? true)
    setMinJobValue(data.profile.min_job_value != null ? String(data.profile.min_job_value) : '')
    setMaxJobValue(data.profile.max_job_value != null ? String(data.profile.max_job_value) : '')
  }, [data])

  /* ── Handlers ── */
  const handleSave = async () => {
    try {
      await save({
        headline: headline || null,
        bio: bio || null,
        years_experience: yearsExperience ? Number(yearsExperience) : null,
        business_name: businessName || null,
        team_size: teamSize ? Number(teamSize) : 1,
        license_number: licenseNumber || null,
        languages,
        website_url: websiteUrl || null,
        accepts_percentage: acceptsPercentage,
        accepts_fixed: acceptsFixed,
        accepts_subwork: acceptsSubwork,
        min_job_value: minJobValue ? Number(minJobValue) : null,
        max_job_value: maxJobValue ? Number(maxJobValue) : null,
      })
      toast({
        title: isHe ? 'הפרופיל נשמר בהצלחה' : 'Profile saved successfully',
        description: isHe ? 'השינויים עודכנו.' : 'Your changes have been updated.',
      })
    } catch {
      toast({
        title: isHe ? 'שגיאה בשמירה' : 'Error saving profile',
        description: isHe ? 'נסה שוב מאוחר יותר.' : 'Please try again later.',
        variant: 'destructive',
      })
    }
  }

  const handlePublish = async () => {
    try {
      const slug = await publishProfile()
      toast({
        title: isHe ? 'הפרופיל פורסם!' : 'Profile published!',
        description: isHe
          ? `הפרופיל שלך זמין כעת בכתובת: masterleadflow.com/pro/${slug}`
          : `Your profile is now live at masterleadflow.com/pro/${slug}`,
      })
    } catch {
      toast({
        title: isHe ? 'שגיאה בפרסום' : 'Error publishing',
        description: isHe ? 'נסה שוב.' : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleCopyUrl = () => {
    if (!data?.profile.slug) return
    navigator.clipboard.writeText(`https://masterleadflow.com/pro/${data.profile.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleLanguage = (lang: string) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang],
    )
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !effectiveUserId) return
    setAvatarUploading(true)
    try {
      const path = `avatars/${effectiveUserId}.webp`
      const { error } = await supabase.storage
        .from('portfolio-images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('portfolio-images').getPublicUrl(path)
      await save({ avatar_url: urlData.publicUrl })
      refetch()
      toast({
        title: isHe ? 'התמונה עודכנה' : 'Photo updated',
        description: isHe ? 'תמונת הפרופיל שלך עודכנה בהצלחה.' : 'Your profile photo has been updated.',
      })
    } catch {
      toast({
        title: isHe ? 'שגיאה בהעלאה' : 'Upload failed',
        description: isHe ? 'נסה שוב מאוחר יותר.' : 'Please try again later.',
        variant: 'destructive',
      })
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#fe5b25] animate-spin" />
      </div>
    )
  }

  const bioLen = bio.length
  const bioTarget = 50

  const publicUrl = data?.profile.slug
    ? `https://masterleadflow.com/pro/${data.profile.slug}`
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#fe5b25]/10 flex items-center justify-center">
          <User className="w-5 h-5 text-[#fe5b25]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isHe ? 'עריכת פרופיל' : 'Edit Profile'}
          </h1>
          <p className="text-sm text-gray-500">
            {isHe
              ? 'פרופיל מלא עוזר לך לקבל יותר לידים איכותיים.'
              : 'A complete profile helps you get more quality leads.'}
          </p>
        </div>
      </div>

      {/* ── Avatar Upload ── */}
      <div className="glass-panel p-6 flex flex-col items-center gap-3">
        <div className="relative">
          <div
            className="w-32 h-32 rounded-full border-[3px] border-white shadow-lg flex items-center justify-center
                        text-3xl font-bold text-white ring-2 ring-gray-100 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #fe5b25, #ff7a4d)' }}
          >
            {data?.profile.avatar_url ? (
              <img src={data.profile.avatar_url} alt={data.full_name ?? ''} className="w-full h-full object-cover" />
            ) : (
              getInitials(data?.full_name ?? '')
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-[#fe5b25] text-white
                       flex items-center justify-center shadow-md hover:bg-[#e5501f]
                       transition-colors disabled:opacity-50"
          >
            {avatarUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
        </div>
        <p className="text-sm text-gray-500">
          {isHe ? 'לחץ על הכפתור כדי לעדכן תמונה' : 'Tap to update your photo'}
        </p>
      </div>

      {/* ── Section 1: Professional Details ── */}
      <Section
        icon={Briefcase}
        title={isHe ? 'פרטים מקצועיים' : 'Professional Details'}
      >
        <div className="space-y-4">
          {/* Headline */}
          <div>
            <FieldLabel htmlFor="headline">
              {isHe ? 'כותרת מקצועית' : 'Professional Headline'}
            </FieldLabel>
            <InputField
              id="headline"
              value={headline}
              onChange={setHeadline}
              placeholder="Licensed HVAC Tech | 12 Years Experience"
              maxLength={120}
            />
          </div>

          {/* Bio */}
          <div>
            <FieldLabel htmlFor="bio">
              {isHe ? 'ביוגרפיה' : 'Bio'}
            </FieldLabel>
            <textarea
              id="bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder={
                isHe
                  ? 'ספר ללקוחות פוטנציאליים על הניסיון והשירותים שלך...'
                  : 'Tell potential clients about your experience and services...'
              }
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white/60
                         text-sm text-gray-800 placeholder:text-gray-400 resize-none
                         focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/30 focus:border-[#fe5b25]/50
                         transition-all"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs ${bioLen >= bioTarget ? 'text-green-600' : 'text-gray-400'}`}>
                {bioLen} / {bioTarget}{' '}
                {isHe ? 'תווים מינימום' : 'chars minimum'}
              </span>
              {bioLen >= bioTarget && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {isHe ? 'מעולה!' : 'Great!'}
                </span>
              )}
            </div>
          </div>

          {/* Years + Business name row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="years">{isHe ? 'שנות ניסיון' : 'Years Experience'}</FieldLabel>
              <InputField
                id="years"
                type="number"
                value={yearsExperience}
                onChange={setYearsExperience}
                placeholder="e.g. 8"
                pattern="[0-9]*"
                maxLength={2}
              />
            </div>
            <div>
              <FieldLabel htmlFor="team">{isHe ? 'גודל צוות' : 'Team Size'}</FieldLabel>
              <InputField
                id="team"
                type="number"
                value={teamSize}
                onChange={setTeamSize}
                placeholder="e.g. 3"
                pattern="[0-9]*"
                maxLength={4}
              />
            </div>
          </div>

          {/* Business name */}
          <div>
            <FieldLabel htmlFor="business">{isHe ? 'שם העסק' : 'Business Name'}</FieldLabel>
            <InputField
              id="business"
              value={businessName}
              onChange={setBusinessName}
              placeholder={isHe ? 'שם העסק שלך' : 'Your business name'}
              maxLength={100}
            />
          </div>
        </div>
      </Section>

      {/* ── Section 2: Credentials ── */}
      <Section
        icon={ShieldCheck}
        title={isHe ? 'אישורים ומסמכים' : 'Credentials'}
      >
        <div className="space-y-4">
          {/* License */}
          <div>
            <FieldLabel htmlFor="license">{isHe ? 'מספר רישיון' : 'License Number'}</FieldLabel>
            <InputField
              id="license"
              value={licenseNumber}
              onChange={setLicenseNumber}
              placeholder={isHe ? 'מספר רישיון מקצועי' : 'Professional license number'}
              maxLength={50}
            />
          </div>

          {/* Languages */}
          <div>
            <FieldLabel>{isHe ? 'שפות' : 'Languages'}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(lang => {
                const selected = languages.includes(lang.value)
                return (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => toggleLanguage(lang.value)}
                    className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all
                      ${
                        selected
                          ? 'bg-[#fe5b25] text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {isHe ? lang.labelHe : lang.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Website */}
          <div>
            <FieldLabel htmlFor="website">{isHe ? 'אתר אינטרנט' : 'Website URL'}</FieldLabel>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rtl:left-auto rtl:right-3" />
              <input
                id="website"
                type="url"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://yoursite.com"
                maxLength={200}
                className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-xl border border-gray-200
                           bg-white/60 text-sm text-gray-800 placeholder:text-gray-400
                           focus:outline-none focus:ring-2 focus:ring-[#fe5b25]/30 focus:border-[#fe5b25]/50
                           transition-all"
              />
            </div>
          </div>
          {/* Identity Verification */}
          <div>
            <FieldLabel>{isHe ? 'אימות זהות' : 'Identity Verification'}</FieldLabel>
            <Link
              to="/verify-identity"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                idVerified
                  ? 'bg-green-50 border-green-200 hover:bg-green-100'
                  : idPending
                    ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {idVerified ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : (
                <Fingerprint className={`w-5 h-5 flex-shrink-0 ${idPending ? 'text-yellow-600' : 'text-gray-400'}`} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${idVerified ? 'text-green-800' : 'text-gray-700'}`}>
                  {idVerified
                    ? (isHe ? 'זהות מאומתת' : 'Identity Verified')
                    : idPending
                      ? (isHe ? 'אימות בתהליך...' : 'Verification in progress...')
                      : (isHe ? 'אמת את הזהות שלך' : 'Verify your identity')
                  }
                </p>
                {!idVerified && !idPending && (
                  <p className="text-xs text-gray-500">
                    {isHe ? 'הגדל אמון עם לקוחות וקבלנים אחרים' : 'Build trust with clients and other contractors'}
                  </p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </Section>

      {/* ── Section 3: Service Areas (display only) ── */}
      <Section
        icon={MapPin}
        title={isHe ? 'מקצועות ואזורי שירות' : 'Service Areas'}
      >
        <div className="space-y-4">
          {/* Professions */}
          <div>
            <FieldLabel>{isHe ? 'מקצועות' : 'Professions'}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {data?.professions && data.professions.length > 0 ? (
                data.professions.map(prof => (
                  <span key={prof} className={`prof-pill prof-${prof}`}>
                    {prof}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">
                  {isHe ? 'לא הוגדרו מקצועות' : 'No professions set'}
                </span>
              )}
            </div>
          </div>

          {/* Zip codes */}
          <div>
            <FieldLabel>{isHe ? 'אזורי שירות (מיקוד)' : 'Service Zip Codes'}</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {data?.zip_codes && data.zip_codes.length > 0 ? (
                data.zip_codes.map(zip => (
                  <span
                    key={zip}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 text-xs text-gray-600 font-mono"
                  >
                    {zip}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">
                  {isHe ? 'לא הוגדרו אזורים' : 'No areas set'}
                </span>
              )}
            </div>
          </div>

          {/* Edit link */}
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 text-sm text-[#fe5b25] font-medium
                       hover:underline transition-all"
          >
            {isHe ? 'עריכת מקצועות ואזורים' : 'Edit professions & areas'}
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </Section>

      {/* ── Section 4: Work Preferences ── */}
      <Section
        icon={Briefcase}
        title={isHe ? 'העדפות עבודה' : 'Work Preferences'}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <FieldLabel>{isHe ? 'סוגי עבודה שאתה מקבל' : 'Types of work you accept'}</FieldLabel>
            <div className="space-y-2">
              <ToggleRow label={isHe ? 'עבודות באחוזים' : 'Percentage-based jobs'} checked={acceptsPercentage} onChange={setAcceptsPercentage} />
              <ToggleRow label={isHe ? 'מחיר קבוע' : 'Fixed price jobs'} checked={acceptsFixed} onChange={setAcceptsFixed} />
              <ToggleRow label={isHe ? 'עבודה כקבלן משנה' : 'Sub-contractor work'} checked={acceptsSubwork} onChange={setAcceptsSubwork} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="minJob">{isHe ? 'מינימום ($)' : 'Min job value ($)'}</FieldLabel>
              <InputField
                id="minJob"
                type="number"
                value={minJobValue}
                onChange={setMinJobValue}
                placeholder="500"
                pattern="[0-9]*"
                maxLength={8}
              />
            </div>
            <div>
              <FieldLabel htmlFor="maxJob">{isHe ? 'מקסימום ($)' : 'Max job value ($)'}</FieldLabel>
              <InputField
                id="maxJob"
                type="number"
                value={maxJobValue}
                onChange={setMaxJobValue}
                placeholder="50000"
                pattern="[0-9]*"
                maxLength={8}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Section 5: Profile Visibility ── */}
      <Section
        icon={Eye}
        title={isHe ? 'נראות הפרופיל' : 'Profile Visibility'}
      >
        {publicUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {isHe
                ? 'הפרופיל הציבורי שלך זמין בכתובת:'
                : 'Your public profile is live at:'}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 font-mono truncate">
                {publicUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="flex items-center justify-center w-10 h-10 rounded-xl
                           bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-10 h-10 rounded-xl
                           bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Open profile"
              >
                <ExternalLink className="w-4 h-4 text-gray-500" />
              </a>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium">
                {isHe ? 'קוד QR לפרופיל שלך' : 'Your profile QR code'}
              </p>
              <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-sm">
                <QRCodeCanvas
                  id="profile-qr"
                  value={publicUrl}
                  size={160}
                  level="H"
                  imageSettings={{
                    src: '/icon.png',
                    height: 32,
                    width: 32,
                    excavate: true,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const canvas = document.getElementById('profile-qr') as HTMLCanvasElement
                  const url = canvas.toDataURL('image/png')
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'my-profile-qr.png'
                  a.click()
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                           text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                {isHe ? 'הורד QR' : 'Download QR'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <Sparkles className="w-8 h-8 text-[#fe5b25]/60 mx-auto" />
            <p className="text-sm text-gray-600">
              {isHe
                ? 'פרסם את הפרופיל שלך כדי לקבל קישור ציבורי שתוכל לשתף עם לקוחות.'
                : 'Publish your profile to get a public link you can share with clients.'}
            </p>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                         bg-[#fe5b25] text-white font-medium text-sm
                         hover:bg-[#e5501f] transition-colors shadow-sm
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              {isHe ? 'פרסם את הפרופיל שלי' : 'Publish My Profile'}
            </button>
          </div>
        )}
      </Section>

      {/* ── Sticky save bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/80 backdrop-blur-lg border-t border-gray-200/50">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 w-full py-3 px-6
                       rounded-2xl bg-[#fe5b25] text-white font-semibold text-base
                       hover:bg-[#e5501f] active:scale-[0.98] transition-all shadow-lg shadow-[#fe5b25]/20
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isHe ? 'שמור שינויים' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Toggle row for work preferences ── */

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#fe5b25]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  )
}
