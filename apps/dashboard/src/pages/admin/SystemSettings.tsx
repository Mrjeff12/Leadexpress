import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { Settings, Globe, Bell, Key, Clock, Save, Check, Loader2, AlertCircle, X } from 'lucide-react'

export default function SystemSettings() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* -- General -- */
  const [businessName, setBusinessName] = useState('MasterLeadFlow')
  const [defaultLang, setDefaultLang] = useState<'en' | 'he'>('en')

  /* -- Notifications -- */
  const [emailNotif, setEmailNotif] = useState(true)
  const [whatsappNotif, setWhatsappNotif] = useState(true)
  const [telegramNotif, setTelegramNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(false)

  /* -- Timezone -- */
  const [timezone, setTimezone] = useState('America/New_York')

  /* -- Save state -- */
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  /* -- Load settings from DB -- */
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('system_settings')
      .select('key, value')
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    if (data) {
      const map = new Map(data.map((row: { key: string; value: unknown }) => [row.key, row.value]))
      if (map.has('business_name')) setBusinessName(map.get('business_name') as string)
      if (map.has('default_language')) setDefaultLang(map.get('default_language') as 'en' | 'he')
      if (map.has('timezone')) setTimezone(map.get('timezone') as string)
      if (map.has('notifications')) {
        const notifs = map.get('notifications') as Record<string, boolean>
        setEmailNotif(notifs.email ?? true)
        setWhatsappNotif(notifs.whatsapp ?? true)
        setTelegramNotif(notifs.telegram ?? true)
        setSmsNotif(notifs.sms ?? false)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  /* -- Save settings to DB -- */
  async function handleSave() {
    setSaving(true)
    setError(null)
    const settings = [
      { key: 'business_name', value: JSON.stringify(businessName) },
      { key: 'default_language', value: JSON.stringify(defaultLang) },
      { key: 'timezone', value: JSON.stringify(timezone) },
      { key: 'notifications', value: JSON.stringify({ email: emailNotif, whatsapp: whatsappNotif, telegram: telegramNotif, sms: smsNotif }) },
    ]

    for (const s of settings) {
      const { error: err } = await supabase
        .from('system_settings')
        .upsert({ key: s.key, value: JSON.parse(s.value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (err) {
        setError(err.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  /* -- Copy to clipboard helper -- */
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback: do nothing
    }
  }

  /* -- API key display helpers -- */
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  const timezones = [
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'America/Chicago', label: 'America/Chicago' },
    { value: 'America/Denver', label: 'America/Denver' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
    { value: 'America/Phoenix', label: 'America/Phoenix' },
    { value: 'Asia/Jerusalem', label: 'Asia/Jerusalem' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'UTC', label: 'UTC' },
  ]

  const notifications = [
    {
      id: 'email',
      label: he ? 'התראות אימייל' : 'Email notifications',
      desc: he ? 'קבל לידים חדשים באימייל' : 'Receive new leads via email',
      checked: emailNotif,
      onChange: setEmailNotif,
    },
    {
      id: 'whatsapp',
      label: he ? 'התראות WhatsApp' : 'WhatsApp notifications',
      desc: he ? 'קבל לידים חדשים ב-WhatsApp' : 'Receive new leads via WhatsApp',
      checked: whatsappNotif,
      onChange: setWhatsappNotif,
    },
    {
      id: 'telegram',
      label: he ? 'התראות טלגרם' : 'Telegram notifications',
      desc: he ? 'קבל לידים חדשים בטלגרם' : 'Receive new leads via Telegram',
      checked: telegramNotif,
      onChange: setTelegramNotif,
    },
    {
      id: 'sms',
      label: he ? 'התראות SMS' : 'SMS notifications',
      desc: he ? 'קבל לידים חדשים ב-SMS' : 'Receive new leads via SMS',
      checked: smsNotif,
      onChange: setSmsNotif,
    },
  ]

  if (loading) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20" style={{ fontFamily: 'Outfit, sans-serif' }}>
        <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: '#5a8a5e' }} />
        <p className="text-sm" style={{ color: '#6b7c6e' }}>{he ? 'טוען הגדרות...' : 'Loading settings...'}</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8 max-w-3xl" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
        >
          <Settings className="w-5 h-5" style={{ color: '#5a8a5e' }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
            {he ? 'הגדרות מערכת' : 'System Settings'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
            {he ? 'הגדרות פלטפורמה' : 'Platform configuration'}
          </p>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="glass-panel p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(220,38,38,0.05)', borderColor: '#fca5a5' }}>
          <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto btn-ghost p-1">
            <X className="h-4 w-4" style={{ color: '#dc2626' }} />
          </button>
        </div>
      )}

      {/* Section 1: General */}
      <section className="glass-panel p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5" style={{ color: '#5a8a5e' }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'כללי' : 'General'}
            </h2>
            <p className="text-sm" style={{ color: '#6b7c6e' }}>
              {he ? 'שם העסק, לוגו ושפה' : 'Business name, logo, and language'}
            </p>
          </div>
        </div>

        {/* Business Name */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
            {he ? 'שם העסק' : 'Business Name'}
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2"
            style={{
              borderColor: '#9ca89e',
              color: '#2d3a2e',
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
        </div>

        {/* Logo placeholder — removed upload, just a note */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
            {he ? 'לוגו' : 'Logo'}
          </label>
          <div
            className="flex items-center justify-center rounded-lg border-2 border-dashed h-24"
            style={{ borderColor: '#9ca89e', color: '#6b7c6e' }}
          >
            <span className="text-sm">{he ? 'העלאת לוגו תתווסף בקרוב' : 'Logo upload coming soon'}</span>
          </div>
        </div>

        {/* Default Language */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
            {he ? 'שפה ברירת מחדל' : 'Default Language'}
          </label>
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: '#9ca89e' }}>
            <button
              type="button"
              onClick={() => setDefaultLang('en')}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: defaultLang === 'en' ? '#5a8a5e' : 'rgba(255,255,255,0.7)',
                color: defaultLang === 'en' ? '#fff' : '#2d3a2e',
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setDefaultLang('he')}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: defaultLang === 'he' ? '#5a8a5e' : 'rgba(255,255,255,0.7)',
                color: defaultLang === 'he' ? '#fff' : '#2d3a2e',
              }}
            >
              עברית
            </button>
          </div>
        </div>
      </section>

      {/* Section 2: Notifications */}
      <section className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5" style={{ color: '#5a8a5e' }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'התראות' : 'Notifications'}
            </h2>
            <p className="text-sm" style={{ color: '#6b7c6e' }}>
              {he ? 'ערוצי התראות פעילים' : 'Active notification channels'}
            </p>
          </div>
        </div>

        {notifications.map((n) => (
          <label
            key={n.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors hover:bg-white/50"
            style={{ borderColor: '#9ca89e' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: '#2d3a2e' }}>{n.label}</p>
              <p className="text-xs" style={{ color: '#6b7c6e' }}>{n.desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={n.checked}
              onClick={() => n.onChange(!n.checked)}
              className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              style={{ backgroundColor: n.checked ? '#5a8a5e' : '#9ca89e' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: n.checked ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </label>
        ))}
      </section>

      {/* Section 3: API Keys */}
      <section className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-5 h-5" style={{ color: '#5a8a5e' }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'מפתחות API' : 'API Keys'}
            </h2>
            <p className="text-sm" style={{ color: '#6b7c6e' }}>
              {he ? 'מפתחות שירותים חיצוניים' : 'External service credentials'}
            </p>
          </div>
        </div>

        {/* Mapbox Token */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
            Mapbox Token
          </label>
          <div
            className="flex items-center justify-between rounded-lg border px-3 py-2"
            style={{ borderColor: '#9ca89e', backgroundColor: 'rgba(255,255,255,0.5)' }}
          >
            <code className="text-sm" style={{ color: mapboxToken ? '#2d3a2e' : '#9ca89e' }}>
              {mapboxToken ? 'sk-...xxxx' : (he ? 'לא מוגדר' : 'Not configured')}
            </code>
            <button
              type="button"
              onClick={() => mapboxToken && copyToClipboard(mapboxToken)}
              className="text-xs font-medium px-2 py-1 rounded transition-colors hover:bg-[#f0f4f1]"
              style={{ color: '#5a8a5e' }}
            >
              {he ? 'העתק' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Supabase URL */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
            Supabase URL
          </label>
          <div
            className="flex items-center justify-between rounded-lg border px-3 py-2"
            style={{ borderColor: '#9ca89e', backgroundColor: 'rgba(255,255,255,0.5)' }}
          >
            <code className="text-sm truncate" style={{ color: supabaseUrl ? '#2d3a2e' : '#9ca89e' }}>
              {supabaseUrl || (he ? 'לא מוגדר' : 'Not configured')}
            </code>
            <button
              type="button"
              onClick={() => supabaseUrl && copyToClipboard(supabaseUrl)}
              className="text-xs font-medium px-2 py-1 rounded transition-colors shrink-0 hover:bg-[#f0f4f1]"
              style={{ color: '#5a8a5e' }}
            >
              {he ? 'העתק' : 'Copy'}
            </button>
          </div>
        </div>
      </section>

      {/* Section 4: Timezone */}
      <section className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-5 h-5" style={{ color: '#5a8a5e' }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'אזור זמן' : 'Timezone'}
            </h2>
            <p className="text-sm" style={{ color: '#6b7c6e' }}>
              {he ? 'אזור זמן ברירת מחדל של המערכת' : 'Default system timezone'}
            </p>
          </div>
        </div>

        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2"
          style={{
            borderColor: '#9ca89e',
            color: '#2d3a2e',
            backgroundColor: 'rgba(255,255,255,0.7)',
          }}
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </section>

      {/* Save Button */}
      <div className="sticky bottom-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl"
          style={{ backgroundColor: saved ? '#3d7a40' : '#5a8a5e' }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {he ? 'שומר...' : 'Saving...'}
            </>
          ) : saved ? (
            <>
              <Check className="w-4 h-4" />
              {he ? 'נשמר!' : 'Saved!'}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {he ? 'שמור הגדרות' : 'Save Settings'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
