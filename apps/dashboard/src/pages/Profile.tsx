import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import {
  User,
  Phone,
  Mail,
  Briefcase,
  MapPin,
  Plus,
  X,
  Save,
  CheckCircle,
  Send,
  Link2,
} from 'lucide-react'

/* ─── Profession metadata ─── */
const PROFESSIONS = [
  { id: 'hvac',       label: 'HVAC',            emoji: '❄️', color: '#3b82f6', borderClass: 'border-l-blue-500'    },
  { id: 'renovation', label: 'Renovation',       emoji: '🔨', color: '#f59e0b', borderClass: 'border-l-amber-500'  },
  { id: 'fencing',    label: 'Fencing',          emoji: '🏗️', color: '#10b981', borderClass: 'border-l-emerald-500' },
  { id: 'cleaning',   label: 'Garage Cleaning',  emoji: '🧹', color: '#8b5cf6', borderClass: 'border-l-violet-500' },
] as const

type ProfessionId = (typeof PROFESSIONS)[number]['id']

/* ─── Helper: placeholder token ─── */
function generatePlaceholderToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/* ─── Component ─── */
export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useI18n()

  // Form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [professions, setProfessions] = useState<ProfessionId[]>([])
  const [zipCodes, setZipCodes] = useState<string[]>([])
  const [zipInput, setZipInput] = useState('')
  const [telegramChatId, setTelegramChatId] = useState<number | null>(null)
  const [telegramToken, setTelegramToken] = useState<string | null>(null)

  // UI state
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  /* ─── Load profile data ─── */
  const loadProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, professions, zip_codes, telegram_chat_id, telegram_token')
      .eq('id', user.id)
      .maybeSingle()

    if (data) {
      setFullName(data.full_name ?? '')
      setPhone(data.phone ?? '')
      setProfessions((data.professions as ProfessionId[]) ?? [])
      setZipCodes((data.zip_codes as string[]) ?? [])
      setTelegramChatId(data.telegram_chat_id ?? null)
      setTelegramToken(data.telegram_token ?? null)
    } else {
      // Fallback to auth context
      setFullName(profile?.full_name ?? '')
      setTelegramChatId(profile?.telegram_chat_id ?? null)
    }

    setLoading(false)
  }, [user, profile])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  /* ─── Profession toggle ─── */
  function toggleProfession(id: ProfessionId) {
    setProfessions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
    setSaved(false)
  }

  /* ─── Zip codes ─── */
  function addZipCode() {
    const cleaned = zipInput.trim().replace(/\D/g, '')
    if (!cleaned || zipCodes.includes(cleaned)) return
    setZipCodes((prev) => [...prev, cleaned])
    setZipInput('')
    setSaved(false)
  }

  function removeZipCode(zip: string) {
    setZipCodes((prev) => prev.filter((z) => z !== zip))
    setSaved(false)
  }

  function handleZipKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addZipCode()
    }
  }

  /* ─── Telegram deep-link ─── */
  function generateTelegramLink(): string {
    const token = telegramToken || generatePlaceholderToken()
    if (!telegramToken) setTelegramToken(token)
    return `https://t.me/LeadExpressBot?start=${token}`
  }

  /* ─── Save ─── */
  async function handleSave() {
    if (!user) return
    setSaving(true)
    setSaved(false)

    const token = telegramToken || generatePlaceholderToken()

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        professions,
        zip_codes: zipCodes,
        telegram_token: token,
      })

    if (!error) {
      setSaved(true)
      setTelegramToken(token)
      await refreshProfile()
      setTimeout(() => setSaved(false), 3000)
    }

    setSaving(false)
  }

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  const isTelegramConnected = telegramChatId !== null && telegramChatId !== 0

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{t('profile.title')}</h1>
          <p className="text-sm text-zinc-500">Configure your lead preferences</p>
        </div>
      </div>

      <div className="stagger-children space-y-5">
        {/* ─── Personal Info ─── */}
        <section className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <User className="h-4 w-4 text-emerald-600" />
            Personal Information
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setSaved(false) }}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-zinc-200 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
            </div>

            {/* Email (readonly) */}
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

            {/* Phone */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setSaved(false) }}
                  placeholder="+1 (555) 123-4567"
                  className="w-full rounded-xl border border-zinc-200 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Professions ─── */}
        <section className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <Briefcase className="h-4 w-4 text-emerald-600" />
            {t('profile.professions')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROFESSIONS.map((prof) => {
              const isActive = professions.includes(prof.id)
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => toggleProfession(prof.id)}
                  className={[
                    'flex items-center gap-3 rounded-xl border-l-4 px-4 py-3 text-left transition-all duration-200',
                    prof.borderClass,
                    isActive
                      ? 'bg-white shadow-sm ring-2 ring-emerald-200'
                      : 'bg-white/60 hover:bg-white/80 hover:shadow-sm',
                  ].join(' ')}
                >
                  <span className="text-xl">{prof.emoji}</span>
                  <span className="flex-1 text-sm font-medium text-zinc-800">{prof.label}</span>
                  <div
                    className={[
                      'flex items-center justify-center h-5 w-5 rounded-md border-2 transition-colors',
                      isActive
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-zinc-300 bg-white',
                    ].join(' ')}
                  >
                    {isActive && (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* ─── Service Areas ─── */}
        <section className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <MapPin className="h-4 w-4 text-emerald-600" />
            {t('profile.zip_codes')}
          </div>

          {/* Input row */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              onKeyDown={handleZipKeyDown}
              placeholder="Enter zip code"
              maxLength={10}
              className="flex-1 rounded-xl border border-zinc-200 bg-white/80 py-2.5 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
            <button
              type="button"
              onClick={addZipCode}
              disabled={!zipInput.trim()}
              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {/* Zip badges */}
          {zipCodes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {zipCodes.map((zip) => (
                <span
                  key={zip}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-sm font-medium text-emerald-700"
                >
                  <MapPin className="h-3 w-3" />
                  {zip}
                  <button
                    type="button"
                    onClick={() => removeZipCode(zip)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200 transition-colors"
                    aria-label={`Remove ${zip}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 italic">No zip codes added yet.</p>
          )}
        </section>

        {/* ─── Telegram Connection ─── */}
        <section className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <Send className="h-4 w-4 text-emerald-600" />
            {t('profile.telegram_status')}
          </div>

          {isTelegramConnected ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50/80 border border-emerald-200 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <div className="flex-1">
                <span className="badge-green inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {t('profile.connected')}
                </span>
                <p className="text-xs text-zinc-500 mt-1">
                  Chat ID: <code className="font-mono text-zinc-700">{telegramChatId}</code>
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50/60 border border-amber-200 px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <Link2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-zinc-700">Telegram is not connected</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Connect your Telegram account to receive leads instantly.
                  </p>
                </div>
              </div>
              <a
                href={generateTelegramLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
              >
                <Send className="h-4 w-4" />
                Connect Telegram
              </a>
            </div>
          )}
        </section>

        {/* ─── Save Button ─── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 animate-fade-in">
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
  )
}
