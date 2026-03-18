import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import {
  Users,
  CheckCircle2,
  XCircle,
  Search,
  QrCode,
  X,
  Copy,
  Check,
  ExternalLink,
  Download,
  UserPlus,
  Send,
  Eye,
} from 'lucide-react'

const BOT_NAME = 'LeadExpressBot'

interface Contractor {
  user_id: string
  professions: string[]
  zip_codes: string[]
  is_active: boolean
  profiles: {
    full_name: string | null
    telegram_chat_id: number | null
    phone: string | null
  }
  subscriptions: {
    status: string
    plans: { name: string }
  } | null
}

const PROF_EMOJI: Record<string, string> = {
  hvac: '❄️',
  renovation: '🔨',
  fencing: '🧱',
  cleaning: '✨',
  locksmith: '🔑',
  plumbing: '🚰',
  electrical: '⚡',
  other: '📋',
}

function qrUrl(data: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=FAFAF8&color=2D6A4F&margin=10`
}

export default function AdminContractors() {
  const { locale } = useI18n()
  const { impersonate } = useAuth()
  const navigate = useNavigate()
  const isRtl = locale === 'he'

  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // QR Modal state
  const [qrModal, setQrModal] = useState<{
    contractor: Contractor
    token: string
    url: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchContractors = useCallback(async () => {
    const { data, error } = await supabase
      .from('contractors')
      .select(`
        user_id, professions, zip_codes, is_active,
        profiles!inner(full_name, telegram_chat_id, phone),
        subscriptions(status, plans(name))
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setContractors(data as unknown as Contractor[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchContractors()
  }, [fetchContractors])

  const filtered = contractors.filter((c) => {
    if (!search) return true
    const name = c.profiles?.full_name?.toLowerCase() ?? ''
    return name.includes(search.toLowerCase())
  })

  const connectedCount = contractors.filter((c) => c.profiles?.telegram_chat_id).length
  const activeCount = contractors.filter((c) => c.is_active).length

  async function generateQr(contractor: Contractor) {
    // TODO: In production, call Supabase Edge Function:
    // const { data } = await supabase.functions.invoke('create-telegram-link', {
    //   body: { userId: contractor.user_id }
    // })
    // const token = data.token

    // Dev mode — generate a placeholder token
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const url = `https://t.me/${BOT_NAME}?start=${token}`
    setQrModal({ contractor, token, url })
    setCopied(false)
  }

  async function copyLink() {
    if (!qrModal) return
    await navigator.clipboard.writeText(qrModal.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function downloadQr() {
    if (!qrModal) return
    const name = qrModal.contractor.profiles?.full_name ?? 'contractor'
    const imgUrl = qrUrl(qrModal.url, 600) // higher res for download
    const res = await fetch(imgUrl)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leadexpress-qr-${name.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header + Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
            {isRtl ? 'קבלנים' : 'Contractors'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
            {isRtl ? 'ניהול קבלנים ויצירת קישורי טלגרם' : 'Manage contractors and generate Telegram links'}
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm">
          <UserPlus className="w-4 h-4" />
          {isRtl ? 'הוסף קבלן' : 'Add Contractor'}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: isRtl ? 'סה״כ קבלנים' : 'Total',
            value: contractors.length,
            icon: <Users className="w-4 h-4" />,
          },
          {
            label: isRtl ? 'פעילים' : 'Active',
            value: activeCount,
            icon: <CheckCircle2 className="w-4 h-4" style={{ color: 'hsl(155 44% 30%)' }} />,
          },
          {
            label: isRtl ? 'טלגרם מחובר' : 'Telegram Connected',
            value: connectedCount,
            icon: <Send className="w-4 h-4" style={{ color: '#0088cc' }} />,
          },
        ].map((kpi, i) => (
          <div key={i} className="glass-panel p-4 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'hsl(40 15% 96%)' }}
            >
              {kpi.icon}
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
                {kpi.value}
              </div>
              <div className="text-xs" style={{ color: 'hsl(40 4% 55%)' }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="glass-panel p-3 flex items-center gap-2">
        <Search className="w-4 h-4" style={{ color: 'hsl(40 4% 42%)' }} />
        <input
          type="text"
          placeholder={isRtl ? 'חפש לפי שם...' : 'Search by name...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-0 text-sm outline-none"
          style={{ color: 'hsl(40 8% 10%)' }}
        />
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-sticky">
            <thead>
              <tr className="border-b border-black/[0.04]">
                {[
                  isRtl ? 'שם' : 'Name',
                  isRtl ? 'מסלול' : 'Plan',
                  isRtl ? 'מקצועות' : 'Professions',
                  isRtl ? 'אזורים' : 'Areas',
                  'Telegram',
                  isRtl ? 'סטטוס' : 'Status',
                  isRtl ? 'פעולות' : 'Actions',
                ].map((col, i) => (
                  <th
                    key={i}
                    className="text-start px-4 py-3 font-medium text-xs uppercase tracking-wider"
                    style={{ color: 'hsl(40 4% 55%)' }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'hsl(40 4% 42%)' }}>
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'hsl(40 4% 55%)' }} />
                    <p className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>
                      {isRtl ? 'אין קבלנים' : 'No contractors found'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.user_id}
                    className="border-b border-black/[0.03] hover:bg-black/[0.01] transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: 'hsl(40 8% 10%)' }}>
                        {c.profiles?.full_name ?? '—'}
                      </div>
                      {c.profiles?.phone && (
                        <div className="text-xs mt-0.5" style={{ color: 'hsl(40 4% 55%)' }}>
                          {c.profiles.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-green text-xs">
                        {c.subscriptions?.plans?.name ?? 'None'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {c.professions.map((p) => (
                          <span key={p} title={p} className="text-base">
                            {PROF_EMOJI[p] ?? '📋'}
                          </span>
                        ))}
                        {c.professions.length === 0 && (
                          <span className="text-xs" style={{ color: 'hsl(40 4% 55%)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
                      {c.zip_codes.length > 0
                        ? <>
                            {c.zip_codes.slice(0, 3).join(', ')}
                            {c.zip_codes.length > 3 && (
                              <span style={{ color: 'hsl(40 4% 55%)' }}> +{c.zip_codes.length - 3}</span>
                            )}
                          </>
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3">
                      {c.profiles?.telegram_chat_id ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" style={{ color: 'hsl(155 44% 30%)' }} />
                          <span className="text-xs" style={{ color: 'hsl(155 44% 30%)' }}>
                            {isRtl ? 'מחובר' : 'Connected'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" style={{ color: 'hsl(0 60% 50%)' }} />
                          <span className="text-xs" style={{ color: 'hsl(0 60% 50%)' }}>
                            {isRtl ? 'לא מחובר' : 'Not linked'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${c.is_active ? 'badge-green' : 'badge-red'}`}>
                        {c.is_active
                          ? isRtl ? 'פעיל' : 'Active'
                          : isRtl ? 'מושבת' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await impersonate(c.user_id)
                            navigate('/')
                          }}
                          title={isRtl ? 'התחבר בתור קבלן' : 'Login As'}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]"
                          style={{
                            background: 'hsl(220 60% 50%)',
                            color: 'white',
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {isRtl ? 'צפה' : 'View As'}
                        </button>
                        {!c.profiles?.telegram_chat_id && (
                          <button
                            onClick={() => generateQr(c)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02]"
                            style={{
                              background: 'hsl(155 44% 30%)',
                              color: 'white',
                            }}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            {isRtl ? 'צור QR' : 'Generate QR'}
                          </button>
                        )}
                        {c.profiles?.telegram_chat_id && (
                          <span className="text-xs" style={{ color: 'hsl(40 4% 55%)' }}>
                            ID: {c.profiles.telegram_chat_id}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── QR Modal ── */}
      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setQrModal(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative glass-panel rounded-2xl p-6 w-full max-w-md animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setQrModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/5 transition"
              style={{ color: 'hsl(40 4% 42%)' }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="text-center mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
                {isRtl ? 'QR לטלגרם' : 'Telegram QR Code'}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
                {isRtl ? 'עבור' : 'For'}{' '}
                <span className="font-medium" style={{ color: 'hsl(40 8% 10%)' }}>
                  {qrModal.contractor.profiles?.full_name ?? 'Contractor'}
                </span>
              </p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-5">
              <div
                className="rounded-2xl p-2.5 shadow-lg"
                style={{ background: '#FAFAF8', border: '2px solid hsl(155 44% 30% / 0.15)' }}
              >
                <img
                  src={qrUrl(qrModal.url)}
                  alt="Telegram QR"
                  width={300}
                  height={300}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Instructions */}
            <div
              className="rounded-xl p-3 mb-4 text-xs text-center"
              style={{ background: 'hsl(40 15% 96%)', color: 'hsl(40 4% 42%)' }}
            >
              {isRtl
                ? 'הקבלן סורק את הקוד → הטלגרם נפתח → הבוט מדריך אותו להגדרות'
                : 'Contractor scans QR → Telegram opens → Bot guides setup'}
            </div>

            {/* Link */}
            <div
              className="flex items-center gap-2 rounded-xl p-3 mb-4"
              style={{ background: 'hsl(152 46% 85% / 0.2)' }}
            >
              <code
                className="flex-1 truncate text-xs"
                style={{ color: 'hsl(155 44% 30%)' }}
              >
                {qrModal.url}
              </code>
              <button
                onClick={copyLink}
                className="shrink-0 p-1.5 rounded-lg hover:bg-white/50 transition"
                style={{ color: 'hsl(155 44% 30%)' }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={downloadQr}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all hover:scale-[1.01]"
                style={{
                  background: 'hsl(40 15% 96%)',
                  color: 'hsl(40 8% 10%)',
                  border: '1px solid hsl(35 15% 88%)',
                }}
              >
                <Download className="w-4 h-4" />
                {isRtl ? 'הורד QR' : 'Download QR'}
              </button>
              <a
                href={qrModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all hover:scale-[1.01]"
                style={{ background: 'hsl(155 44% 30%)', color: 'white' }}
              >
                <ExternalLink className="w-4 h-4" />
                {isRtl ? 'פתח בטלגרם' : 'Open in TG'}
              </a>
            </div>

            {/* Expiration notice */}
            <p className="text-center text-xs mt-3" style={{ color: 'hsl(40 4% 55%)' }}>
              {isRtl
                ? 'הקישור תקף ל-24 שעות'
                : 'Link expires in 24 hours'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
