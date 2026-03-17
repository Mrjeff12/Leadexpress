import { useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import {
  MapPin,
  Clock,
  Flame,
  Zap,
  Snowflake,
  Search,
  Loader2,
  Hash,
  DollarSign,
  Send,
  Wrench,
  Thermometer,
  Key,
  Paintbrush,
  Droplets,
  Fence,
  Sparkles,
  ChevronDown,
  Eye,
  Radio,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────────── */
interface Lead {
  id: string
  group_id: string
  profession: string
  parsed_summary: string
  raw_message: string
  city: string | null
  zip_code: string | null
  budget_range: string | null
  urgency: 'hot' | 'warm' | 'cold'
  status: string
  sent_to_count: number
  sender_id: string | null
  created_at: string
}

/* ── Profession + Urgency config ───────────────────────────────────── */
const PROF: Record<string, { icon: typeof Wrench; label: string; he: string; color: string; bg: string }> = {
  hvac:       { icon: Thermometer, label: 'HVAC',       he: 'מיזוג',     color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
  renovation: { icon: Wrench,      label: 'Renovation', he: 'שיפוץ',     color: '#c2410c', bg: 'rgba(194,65,12,0.08)' },
  fencing:    { icon: Fence,       label: 'Fencing',    he: 'גדרות',     color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  cleaning:   { icon: Sparkles,    label: 'Cleaning',   he: 'ניקיון',    color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  locksmith:  { icon: Key,         label: 'Locksmith',  he: 'מנעולן',    color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
  plumbing:   { icon: Droplets,    label: 'Plumbing',   he: 'אינסטלציה', color: '#0369a1', bg: 'rgba(3,105,161,0.08)' },
  electrical: { icon: Zap,         label: 'Electrical', he: 'חשמל',      color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  painting:   { icon: Paintbrush,  label: 'Painting',   he: 'צביעה',     color: '#be185d', bg: 'rgba(190,24,93,0.08)' },
  other:      { icon: Wrench,      label: 'Service',    he: 'שירות',     color: '#5a8a5e', bg: 'rgba(90,138,94,0.08)' },
}

const URG = {
  hot:  { icon: Flame,     label: 'Hot',  he: 'דחוף', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.15)' },
  warm: { icon: Zap,       label: 'Warm', he: 'חם',   color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.15)' },
  cold: { icon: Snowflake, label: 'Cold', he: 'קר',   color: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.15)' },
}

function getProf(p: string) { return PROF[p] ?? PROF.other }

function timeAgo(d: string, he: boolean) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return he ? 'עכשיו' : 'now'
  if (m < 60) return he ? `${m} דק׳` : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return he ? `${h} שע׳` : `${h}h ago`
  return he ? `${Math.floor(h / 24)} ימים` : `${Math.floor(h / 24)}d ago`
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function AdminLeads() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProf, setFilterProf] = useState('all')
  const [filterUrg, setFilterUrg] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Fetch leads
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, group_id, profession, parsed_summary, raw_message, city, zip_code, budget_range, urgency, status, sent_to_count, sender_id, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (data) setLeads(data as Lead[])
      setLoading(false)
    })()

    const ch = supabase
      .channel('leads-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (p) => {
        setLeads(prev => [p.new as Lead, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Filter
  const filtered = leads.filter(l => {
    if (filterProf !== 'all' && l.profession !== filterProf) return false
    if (filterUrg !== 'all' && l.urgency !== filterUrg) return false
    if (search) {
      const q = search.toLowerCase()
      return l.parsed_summary?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) || l.zip_code?.includes(q) ||
        l.profession.toLowerCase().includes(q)
    }
    return true
  })

  const hot = leads.filter(l => l.urgency === 'hot').length
  const warm = leads.filter(l => l.urgency === 'warm').length
  const cold = leads.filter(l => l.urgency === 'cold').length
  const profs = [...new Set(leads.map(l => l.profession))].sort()

  return (
    <div className="animate-fade-in space-y-6" style={{ fontFamily: 'Outfit, sans-serif' }}>

      {/* ── Header ── */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
            {he ? 'כל הלידים' : 'All Leads'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
            {he ? 'לידים שחולצו מקבוצות WhatsApp ע"י AI' : 'AI-extracted leads from WhatsApp groups'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7c6e' }}>
          <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span>{he ? 'זמן אמת' : 'Real-time'}</span>
        </div>
      </header>

      {/* ── KPI Strip ── */}
      <section className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<Zap className="h-5 w-5" style={{ color: '#5a8a5e' }} />}
          value={leads.length}
          label={he ? 'סה"כ לידים' : 'Total Leads'}
          accent="#5a8a5e"
        />
        <KpiCard
          icon={<Flame className="h-5 w-5" style={{ color: '#dc2626' }} />}
          value={hot}
          label={he ? 'דחוף' : 'Hot'}
          accent="#dc2626"
          active={filterUrg === 'hot'}
          onClick={() => setFilterUrg(filterUrg === 'hot' ? 'all' : 'hot')}
        />
        <KpiCard
          icon={<Zap className="h-5 w-5" style={{ color: '#d97706' }} />}
          value={warm}
          label={he ? 'חם' : 'Warm'}
          accent="#d97706"
          active={filterUrg === 'warm'}
          onClick={() => setFilterUrg(filterUrg === 'warm' ? 'all' : 'warm')}
        />
        <KpiCard
          icon={<Snowflake className="h-5 w-5" style={{ color: '#2563eb' }} />}
          value={cold}
          label={he ? 'קר' : 'Cold'}
          accent="#2563eb"
          active={filterUrg === 'cold'}
          onClick={() => setFilterUrg(filterUrg === 'cold' ? 'all' : 'cold')}
        />
      </section>

      {/* ── Search + Filters ── */}
      <div className="glass-panel p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2" style={{
            left: he ? 'auto' : 12, right: he ? 12 : 'auto',
            color: '#9ca89e',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={he ? 'חפש עיר, ZIP, מקצוע...' : 'Search city, ZIP, profession...'}
            className="w-full text-sm rounded-xl border px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
            style={{
              paddingLeft: he ? 12 : 40, paddingRight: he ? 40 : 12,
              borderColor: 'rgba(93,124,96,0.15)',
              background: 'rgba(255,255,255,0.5)',
              color: '#2d3a2e',
            }}
          />
        </div>

        <div className="relative">
          <select
            value={filterProf}
            onChange={e => setFilterProf(e.target.value)}
            className="text-sm rounded-xl border px-3 py-2.5 appearance-none cursor-pointer outline-none pr-8"
            style={{
              borderColor: 'rgba(93,124,96,0.15)',
              background: 'rgba(255,255,255,0.5)',
              color: '#2d3a2e',
            }}
          >
            <option value="all">{he ? 'כל המקצועות' : 'All Professions'}</option>
            {profs.map(p => (
              <option key={p} value={p}>{he ? getProf(p).he : getProf(p).label}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 pointer-events-none" style={{
            right: he ? 'auto' : 10, left: he ? 10 : 'auto', color: '#9ca89e',
          }} />
        </div>

        <div className="flex gap-1">
          {(['all', 'hot', 'warm', 'cold'] as const).map(k => {
            const active = filterUrg === k
            const u = k !== 'all' ? URG[k] : null
            return (
              <button
                key={k}
                onClick={() => setFilterUrg(k)}
                className="text-xs font-semibold rounded-lg px-3 py-2 transition-all"
                style={{
                  border: active ? `1.5px solid ${u?.color ?? '#5a8a5e'}` : '1.5px solid transparent',
                  background: active ? (u?.bg ?? 'rgba(90,138,94,0.08)') : 'transparent',
                  color: active ? (u?.color ?? '#5a8a5e') : '#9ca89e',
                }}
              >
                {k === 'all' ? (he ? 'הכל' : 'All') : (he ? u!.he : u!.label)}
              </button>
            )
          })}
        </div>

        <span className="text-xs ml-auto" style={{ color: '#9ca89e' }}>
          {filtered.length} {he ? 'תוצאות' : 'results'}
        </span>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#5a8a5e' }} />
        </div>
      )}

      {/* ── Lead Cards Grid ── */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {filtered.map((lead) => {
            const p = getProf(lead.profession)
            const u = URG[lead.urgency]
            const PIcon = p.icon
            const UIcon = u.icon
            const isOpen = expandedId === lead.id

            return (
              <div
                key={lead.id}
                onClick={() => setExpandedId(isOpen ? null : lead.id)}
                className="glass-panel cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  borderColor: lead.urgency === 'hot' ? 'rgba(220,38,38,0.12)' : undefined,
                }}
              >
                {/* Top accent */}
                <div style={{ height: 3, background: p.color, opacity: 0.6 }} />

                <div className="p-4">
                  {/* Row 1: profession + urgency + time */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: p.bg }}>
                        <PIcon className="w-4 h-4" style={{ color: p.color }} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold block" style={{ color: '#2d3a2e' }}>
                          {he ? p.he : p.label}
                        </span>
                        <span className="text-[11px] flex items-center gap-1" style={{ color: '#9ca89e' }}>
                          <Clock className="w-3 h-3" />
                          {timeAgo(lead.created_at, he)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: u.bg, border: `1px solid ${u.border}`, color: u.color }}>
                      <UIcon className="w-3 h-3" />
                      {he ? u.he : u.label}
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-[13px] leading-relaxed mb-3" style={{
                    color: '#4a5a4c',
                    display: isOpen ? 'block' : '-webkit-box',
                    WebkitLineClamp: isOpen ? undefined : 2,
                    WebkitBoxOrient: isOpen ? undefined : 'vertical' as any,
                    overflow: isOpen ? 'visible' : 'hidden',
                  }}>
                    {lead.parsed_summary}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {lead.city && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(90,138,94,0.08)', color: '#5a8a5e' }}>
                        <MapPin className="w-3 h-3" /> {lead.city}
                      </span>
                    )}
                    {lead.zip_code && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(0,0,0,0.04)', color: '#6b7c6e' }}>
                        <Hash className="w-3 h-3" /> {lead.zip_code}
                      </span>
                    )}
                    {lead.budget_range && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(2,132,199,0.06)', color: '#0284c7' }}>
                        <DollarSign className="w-3 h-3" /> {lead.budget_range}
                      </span>
                    )}
                  </div>

                  {/* Expanded: raw message */}
                  {isOpen && (
                    <div className="rounded-xl p-3 mb-3" style={{
                      background: 'rgba(0,0,0,0.03)',
                      border: '1px solid rgba(93,124,96,0.1)',
                    }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Eye className="w-3 h-3" style={{ color: '#9ca89e' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                          {he ? 'הודעה מקורית' : 'Original Message'}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{
                        color: '#6b7c6e', fontFamily: "'SF Mono', 'Fira Code', monospace",
                      }}>
                        {lead.raw_message}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(93,124,96,0.08)' }}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                      lead.status === 'sent' ? 'badge-green' : 'badge-blue'
                    }`}>
                      {lead.status === 'sent' ? (he ? 'נשלח' : 'Sent') : (he ? 'מוכן' : 'Ready')}
                    </span>

                    {lead.sent_to_count > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#5a8a5e' }}>
                        <Send className="w-3 h-3" /> {lead.sent_to_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && filtered.length === 0 && (
        <div className="glass-panel py-20 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.03)' }}>
            <Search className="w-6 h-6" style={{ color: '#9ca89e' }} />
          </div>
          <span className="text-sm" style={{ color: '#9ca89e' }}>
            {he ? 'לא נמצאו לידים' : 'No leads found'}
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────── */
function KpiCard({ icon, value, label, accent, active, onClick }: {
  icon: React.ReactNode; value: number; label: string; accent: string;
  active?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`glass-panel flex flex-col gap-1.5 px-5 py-4 transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      style={{
        borderColor: active ? accent : undefined,
        boxShadow: active ? `0 0 0 1px ${accent}20` : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
          {label}
        </span>
      </div>
      <span className="text-2xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
        {value}
      </span>
    </div>
  )
}
