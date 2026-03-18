import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
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
} from 'lucide-react'

const WA_NUMBER = '18623582898'

export default function Profile() {
  const { user, profile, refreshProfile, effectiveUserId, impersonatedProfile } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [telegramChatId, setTelegramChatId] = useState<number | null>(null)
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [waPolling, setWaPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  return (
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
        {/* ─── Personal Info ─── */}
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

        {/* ─── Communication Channels ─── */}
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
          </div>
        </section>

        {/* ─── Save Button ─── */}
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
  )
}
