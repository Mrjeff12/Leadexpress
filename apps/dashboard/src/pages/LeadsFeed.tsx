import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import ForwardLeadModal from '../components/ForwardLeadModal'
import UpsellModal from '../components/UpsellModal'
import LeadFeedbackButtons from '../components/LeadFeedbackButtons'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import {
  MapPin,
  Flame,
  Zap,
  Snowflake,
  Search,
  Loader2,
  MessageCircle,
  Phone,
  Wrench,
  Thermometer,
  Key,
  Paintbrush,
  Droplets,
  Fence,
  Sparkles,
  ChevronDown,
  Check,
  Eye,
  Radio,
  TrendingUp,
  TrendingDown,
  Users,
  Wind,
  Home,
  Car,
  TreePine,
  Grid,
  ChefHat,
  Bath,
  Waves,
  Truck,
  Settings,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────────── */
interface Lead {
  id: string
  profession: string
  parsed_summary: string | null
  raw_message: string | null
  city: string | null
  zip_code: string | null
  urgency: 'hot' | 'warm' | 'cold'
  budget_range: string | null
  sender_id: string | null
  created_at: string
  group_name: string | null
  source_type?: string
  publisher_id?: string
}

/* ── Profession + Urgency config ───────────────────────────────────── */
const PROF: Record<string, { icon: React.ElementType; label: string; he: string; color: string; bg: string }> = {
  hvac:            { icon: Thermometer, label: 'HVAC',            he: 'מיזוג',        color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
  air_duct:        { icon: Wind,        label: 'Air Duct',        he: 'תעלות אוויר',   color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
  chimney:         { icon: Flame,       label: 'Chimney',         he: 'קמינים',       color: '#ea580c', bg: 'rgba(234,88,12,0.08)' },
  dryer_vent:      { icon: Wind,        label: 'Dryer Vent',      he: 'פתחי אוורור',   color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  garage_door:     { icon: Car,         label: 'Garage Door',     he: 'דלתות מוסך',   color: '#475569', bg: 'rgba(71,85,105,0.08)' },
  locksmith:       { icon: Key,         label: 'Locksmith',       he: 'מנעולן',       color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
  roofing:         { icon: Home,        label: 'Roofing',         he: 'גגות',         color: '#9a3412', bg: 'rgba(154,52,18,0.08)' },
  plumbing:        { icon: Droplets,    label: 'Plumbing',        he: 'אינסטלציה',    color: '#0369a1', bg: 'rgba(3,105,161,0.08)' },
  electrical:      { icon: Zap,         label: 'Electrical',      he: 'חשמל',         color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  painting:        { icon: Paintbrush,  label: 'Painting',        he: 'צביעה',        color: '#be185d', bg: 'rgba(190,24,93,0.08)' },
  cleaning:        { icon: Sparkles,    label: 'Cleaning',        he: 'ניקיון',       color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  carpet_cleaning: { icon: Sparkles,    label: 'Carpet Cleaning', he: 'ניקוי שטיחים', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  renovation:      { icon: Wrench,      label: 'Renovation',      he: 'שיפוץ',        color: '#c2410c', bg: 'rgba(194,65,12,0.08)' },
  fencing:         { icon: Fence,       label: 'Fencing',         he: 'גדרות',        color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  landscaping:     { icon: TreePine,    label: 'Landscaping',     he: 'גינון',        color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  tiling:          { icon: Grid,        label: 'Tiling',          he: 'ריצוף',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  kitchen:         { icon: ChefHat,     label: 'Kitchen',         he: 'מטבחים',       color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  bathroom:        { icon: Bath,        label: 'Bathroom',        he: 'חדרי רחצה',    color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
  pool:            { icon: Waves,       label: 'Pool',            he: 'בריכות',       color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
  moving:          { icon: Truck,       label: 'Moving',          he: 'הובלות',       color: '#4f46e5', bg: 'rgba(79,70,229,0.08)' },
  other:           { icon: Wrench,      label: 'Service',         he: 'שירות',        color: '#5a8a5e', bg: 'rgba(90,138,94,0.08)' },
}

const URG = {
  hot:  { icon: Flame,     label: 'Hot',  he: 'דחוף', color: '#FF3B30', bg: 'rgba(255,59,48,0.08)', border: 'rgba(255,59,48,0.15)' },
  warm: { icon: Zap,       label: 'Warm', he: 'חם',   color: '#FF9500', bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.15)' },
  cold: { icon: Snowflake, label: 'Cold', he: 'קר',   color: '#5AC8FA', bg: 'rgba(90,200,250,0.08)', border: 'rgba(90,200,250,0.15)' },
}

function getProf(p: string) { return PROF[p] ?? PROF.other }

function timeAgo(d: string, he: boolean) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return he ? 'עכשיו' : 'now'
  if (m < 60) return he ? `לפני ${m} דק׳` : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return he ? `לפני ${h} שע׳` : `${h}h ago`
  return he ? `לפני ${Math.floor(h / 24)} ימים` : `${Math.floor(h / 24)}d ago`
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function LeadsFeed() {
  const { user, effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const he = locale === 'he'

  const [leads, setLeads] = useState<Lead[]>([])
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [contractorProfessions, setContractorProfessions] = useState<string[] | null>(null)
  const [contractorZips, setContractorZips] = useState<string[] | null>(null)
  const [filterProfs, setFilterProfs] = useState<string[]>([])
  const [isProfOpen, setIsProfOpen] = useState(false)
  const profRef = useRef<HTMLDivElement>(null)
  
  const [filterDate, setFilterDate] = useState('all') // 'all', 'today', 'yesterday', 'week', 'custom'
  const [customDate, setCustomDate] = useState('')
  const [isDateOpen, setIsDateOpen] = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)

  const [filterUrg, setFilterUrg] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [forwardLead, setForwardLead] = useState<Lead | null>(null)
  const [showUpsell, setShowUpsell] = useState(false)

  /** Open WhatsApp chat with the lead's advertiser (group poster) */
  async function contactAdvertiser(lead: Lead) {
    if (!lead.sender_id) return
    // sender_id is like "972501234567@c.us" — strip the @c.us suffix
    const phone = lead.sender_id.replace(/@.*$/, '')
    const name = senderNames[lead.sender_id] || ''
    const location = [lead.city, lead.zip_code].filter(Boolean).join(', ')
    const prof = lead.profession
    const summary = lead.parsed_summary || lead.raw_message?.slice(0, 100) || ''

    const greeting = name
      ? (he ? `היי ${name},` : `Hi ${name},`)
      : (he ? 'היי,' : 'Hi,')

    const message = he
      ? `${greeting} ראיתי שפרסמת בקשה ל${PROF[prof]?.he || prof}${location ? ' ב' + location : ''}.\n${summary}\nאשמח לעזור! אפשר לדבר?`
      : `${greeting} I saw your post looking for ${PROF[prof]?.label || prof}${location ? ' in ' + location : ''}.\n${summary}\nI'd love to help! Can we talk?`

    // Log the contact event (fire-and-forget) and update local count
    if (effectiveUserId) {
      supabase.from('lead_contact_events').insert({
        lead_id: lead.id,
        user_id: effectiveUserId,
      }).then(({ error }) => { if (error) console.error('Failed to log contact event:', error) })
      setContactCounts(prev => ({ ...prev, [lead.id]: (prev[lead.id] || 0) + 1 }))
    }

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  // Click outside for custom dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profRef.current && !profRef.current.contains(event.target as Node)) {
        setIsProfOpen(false)
      }
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) {
        setIsDateOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch contractor settings then leads filtered by professions + zip codes
  useEffect(() => {
    async function fetchLeads() {
      if (!user || !effectiveUserId) return

      // 1. Load contractor's professions & zip_codes
      const { data: contractor } = await supabase
        .from('contractors')
        .select('professions, zip_codes')
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      const professions: string[] = contractor?.professions ?? []
      const zipCodes: string[] = contractor?.zip_codes ?? []
      setContractorProfessions(professions)
      setContractorZips(zipCodes)

      // 2. If contractor hasn't configured professions or zips, show empty
      if (professions.length === 0 || zipCodes.length === 0) {
        setLeads([])
        setLoading(false)
        return
      }

      // 3. Fetch leads filtered by contractor's professions AND zip codes
      let query = supabase
        .from('leads')
        .select('id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, source_type, publisher_id, groups ( name )')
        .in('profession', professions)
        .in('zip_code', zipCodes)
        .order('created_at', { ascending: false })
        .limit(200)

      const { data, error } = await query

      if (!error && data) {
        const leadsData = data.map((row: any) => ({
          ...row,
          group_name: row.groups?.name ?? null,
        }))
        setLeads(leadsData)

        // Fetch sender names from group_members
        const senderIds = [...new Set(leadsData.map(l => l.sender_id).filter(Boolean))]
        if (senderIds.length > 0) {
          const { data: members } = await supabase
            .from('group_members')
            .select('wa_sender_id, display_name')
            .in('wa_sender_id', senderIds)

          if (members) {
            const nameMap: Record<string, string> = {}
            members.forEach(m => {
              if (m.display_name) nameMap[m.wa_sender_id] = m.display_name
            })
            setSenderNames(nameMap)
          }
        }

        // Fetch contact counts per lead
        const leadIds = leadsData.map((l: any) => l.id)
        if (leadIds.length > 0) {
          const { data: events } = await supabase
            .from('lead_contact_events')
            .select('lead_id')
            .in('lead_id', leadIds)

          if (events) {
            const counts: Record<string, number> = {}
            events.forEach((e: any) => {
              counts[e.lead_id] = (counts[e.lead_id] || 0) + 1
            })
            setContactCounts(counts)
          }
        }
      }
      setLoading(false)
    }
    fetchLeads()
  }, [user, effectiveUserId])

  // Base filter (applies search, profession, and date - but NOT urgency)
  const baseFilteredLeads = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('en-CA') // YYYY-MM-DD local
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    return leads.filter(l => {
      // 1. Search
      if (search) {
        const q = search.toLowerCase()
        const text = (l.parsed_summary ?? l.raw_message ?? '').toLowerCase()
        const matchesSearch = text.includes(q) ||
          l.city?.toLowerCase().includes(q) || l.zip_code?.includes(q) ||
          l.profession.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      // 2. Profession
      if (filterProfs.length > 0 && !filterProfs.includes(l.profession)) return false

      // 3. Date
      if (filterDate !== 'all') {
        const leadDateObj = new Date(l.created_at)
        const leadDateStr = leadDateObj.toLocaleDateString('en-CA')
        
        if (filterDate === 'today' && leadDateStr !== todayStr) return false
        if (filterDate === 'yesterday' && leadDateStr !== yesterdayStr) return false
        if (filterDate === 'week' && leadDateObj < weekAgo) return false
        if (filterDate === 'custom' && customDate && leadDateStr !== customDate) return false
      }

      return true
    })
  }, [leads, search, filterProfs, filterDate, customDate])

  // Final filter (applies urgency on top of base)
  const filtered = useMemo(() => {
    return baseFilteredLeads.filter(l => filterUrg === 'all' || l.urgency === filterUrg)
  }, [baseFilteredLeads, filterUrg])

  // KPI Counts
  const hot = baseFilteredLeads.filter(l => l.urgency === 'hot').length
  const warm = baseFilteredLeads.filter(l => l.urgency === 'warm').length
  const cold = baseFilteredLeads.filter(l => l.urgency === 'cold').length
  const profs = [...new Set(leads.map(l => l.profession))].sort()

  // Real sparkline data based on baseFilteredLeads
  const chartDataAll = useMemo(() => {
    const days = Array.from({length: 7}).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toLocaleDateString('en-CA')
    })
    const getCounts = (filteredList: Lead[]) => {
      const map = filteredList.reduce((acc, l) => {
        const date = new Date(l.created_at).toLocaleDateString('en-CA')
        acc[date] = (acc[date] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      return days.map(d => ({ val: map[d] || 0 }))
    }
    return {
      all: getCounts(baseFilteredLeads),
      hot: getCounts(baseFilteredLeads.filter(l => l.urgency === 'hot')),
      warm: getCounts(baseFilteredLeads.filter(l => l.urgency === 'warm')),
      cold: getCounts(baseFilteredLeads.filter(l => l.urgency === 'cold')),
    }
  }, [baseFilteredLeads])

  return (
    <div className="animate-fade-in space-y-4 md:space-y-10 pb-20 pt-0 md:pt-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-1 mb-0 md:mb-0">
        <h1 className="text-lg md:text-4xl font-semibold md:font-light tracking-tight text-black">
          {he ? 'כל הלידים' : 'My Leads'}
        </h1>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/50 backdrop-blur-md border border-black/5 shadow-sm">
          <div className="relative flex h-1.5 w-1.5">
            <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fe5b25] opacity-75"></div>
            <div className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#fe5b25]"></div>
          </div>
          <span className="text-[9px] md:text-xs font-bold tracking-tight text-black uppercase">Live</span>
        </div>
      </header>

      {/* ── KPI Strip — horizontal compact on mobile ── */}
      <section className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        <KpiCard icon={Zap} label="Total" value={baseFilteredLeads.length} sub="" color="#fe5b25" chartData={[]} />
        <KpiCard icon={Flame} label="Hot" value={hot} sub="" color="#FF3B30" chartData={[]} active={filterUrg === 'hot'} onClick={() => setFilterUrg(filterUrg === 'hot' ? 'all' : 'hot')} />
        <KpiCard icon={Zap} label="Warm" value={warm} sub="" color="#FF9500" chartData={[]} active={filterUrg === 'warm'} onClick={() => setFilterUrg(filterUrg === 'warm' ? 'all' : 'warm')} />
        <KpiCard icon={Snowflake} label="Cold" value={cold} sub="" color="#5AC8FA" chartData={[]} active={filterUrg === 'cold'} onClick={() => setFilterUrg(filterUrg === 'cold' ? 'all' : 'cold')} />
      </section>
      <section className="hidden md:grid stagger-kpi grid-cols-4 gap-6">
        <KpiCard
          icon={Zap}
          label={he ? 'סה"כ לידים' : 'Total Leads'}
          value={baseFilteredLeads.length}
          sub={he ? 'מנותחים ע"י AI' : 'Across all channels'}
          color="#fe5b25"
          chartData={chartDataAll.all}
        />
        <KpiCard
          icon={Flame}
          label={he ? 'דחוף' : 'Hot Leads'}
          value={hot}
          sub={he ? 'היום / מחר' : 'Needs immediate action'}
          color="#FF3B30"
          chartData={chartDataAll.hot}
          active={filterUrg === 'hot'}
          onClick={() => setFilterUrg(filterUrg === 'hot' ? 'all' : 'hot')}
        />
        <KpiCard
          icon={Zap}
          label={he ? 'חם' : 'Warm Leads'}
          value={warm}
          sub={he ? 'השבוע' : 'Follow up required'}
          color="#FF9500"
          chartData={chartDataAll.warm}
          active={filterUrg === 'warm'}
          onClick={() => setFilterUrg(filterUrg === 'warm' ? 'all' : 'warm')}
        />
        <KpiCard
          icon={Snowflake}
          label={he ? 'קר' : 'Cold Leads'}
          value={cold}
          sub={he ? 'עתידי' : 'Long-term prospects'}
          color="#5AC8FA"
          chartData={chartDataAll.cold}
          active={filterUrg === 'cold'}
          onClick={() => setFilterUrg(filterUrg === 'cold' ? 'all' : 'cold')}
        />
      </section>

      {/* ── Search + Filters ── */}
      <div className="glass-panel p-2.5 md:p-4 flex items-center gap-2 md:gap-4 flex-wrap border-none shadow-xl relative z-20">
        <div className="relative flex-1 min-w-0 md:min-w-[300px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2" style={{
            left: he ? 'auto' : 16, right: he ? 16 : 'auto',
            color: '#aaa',
          }} strokeWidth={2} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={he ? 'חפש עיר, ZIP, מקצוע...' : 'Search intelligence...'}
            className="w-full text-xs md:text-sm rounded-xl md:rounded-2xl border-none px-4 py-2.5 md:px-6 md:py-4 outline-none transition-all bg-black/[0.03] focus:bg-black/[0.05] focus:ring-2 focus:ring-black/5"
            style={{
              paddingLeft: he ? 16 : 48, paddingRight: he ? 48 : 16,
              color: '#000',
              fontFamily: 'Outfit, sans-serif',
            }}
          />
        </div>

        <div className="relative" ref={profRef}>
          <button
            onClick={() => setIsProfOpen(!isProfOpen)}
            className="flex items-center justify-between gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-xl md:rounded-2xl border-none px-3 py-2.5 md:px-6 md:py-4 bg-black text-white hover:bg-stone-800 transition-colors min-w-0 md:min-w-[220px]"
          >
            <span>
              {filterProfs.length === 0 
                ? (he ? 'כל המקצועות' : 'All Professions') 
                : (he ? `${filterProfs.length} נבחרו` : `${filterProfs.length} Selected`)}
            </span>
            <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${isProfOpen ? 'rotate-180' : ''}`} />
          </button>

          {isProfOpen && (
            <div className="absolute top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden z-50" style={{ [he ? 'right' : 'left']: 0 }}>
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 scrollbar-hide">
                <button
                  onClick={() => setFilterProfs([])}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                    filterProfs.length === 0 ? 'bg-black/[0.03] text-black' : 'text-stone-500 hover:bg-black/[0.02]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${filterProfs.length === 0 ? 'bg-black border-black' : 'border-stone-300'}`}>
                    {filterProfs.length === 0 && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  {he ? 'הכל' : 'All'}
                </button>
                {profs.map(p => {
                  const isSelected = filterProfs.includes(p)
                  const prof = getProf(p)
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        if (isSelected) setFilterProfs(prev => prev.filter(x => x !== p))
                        else setFilterProfs(prev => [...prev, p])
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                        isSelected ? 'bg-black/[0.03] text-black' : 'text-stone-500 hover:bg-black/[0.02]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-black border-black' : 'border-stone-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <prof.icon className="w-4 h-4" style={{ color: prof.color }} />
                      {he ? prof.he : prof.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={dateRef}>
          <button
            onClick={() => setIsDateOpen(!isDateOpen)}
            className="flex items-center justify-between gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-xl md:rounded-2xl border-none px-3 py-2.5 md:px-6 md:py-4 bg-black/[0.03] text-black hover:bg-black/[0.05] transition-colors min-w-0 md:min-w-[160px]"
          >
            <span>
              {filterDate === 'all' ? (he ? 'כל הזמנים' : 'All Time') :
               filterDate === 'today' ? (he ? 'היום' : 'Today') :
               filterDate === 'yesterday' ? (he ? 'אתמול' : 'Yesterday') :
               filterDate === 'week' ? (he ? 'השבוע' : 'This Week') :
               (he ? 'תאריך ספציפי' : 'Custom Date')}
            </span>
            <ChevronDown className={`w-4 h-4 text-black/40 transition-transform ${isDateOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDateOpen && (
            <div className="absolute top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden z-50" style={{ [he ? 'right' : 'left']: 0 }}>
              <div className="p-2 space-y-1">
                {(['all', 'today', 'yesterday', 'week', 'custom'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setFilterDate(d)
                      if (d !== 'custom') setIsDateOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                      filterDate === d ? 'bg-black/[0.03] text-black' : 'text-stone-500 hover:bg-black/[0.02]'
                    }`}
                  >
                    {d === 'all' ? (he ? 'כל הזמנים' : 'All Time') :
                     d === 'today' ? (he ? 'היום' : 'Today') :
                     d === 'yesterday' ? (he ? 'אתמול' : 'Yesterday') :
                     d === 'week' ? (he ? 'השבוע' : 'This Week') :
                     (he ? 'תאריך ספציפי' : 'Custom Date')}
                  </button>
                ))}
                {filterDate === 'custom' && (
                  <div className="pt-2 pb-1 px-1">
                    <input
                      type="date"
                      value={customDate}
                      onChange={e => {
                        setCustomDate(e.target.value)
                        setIsDateOpen(false)
                      }}
                      className="w-full text-xs font-bold uppercase tracking-wider rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/20"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 bg-black/[0.03] p-1.5 rounded-2xl">
          {(['all', 'hot', 'warm', 'cold'] as const).map(k => {
            const active = filterUrg === k
            const u = k !== 'all' ? URG[k] : null
            return (
              <button
                key={k}
                onClick={() => setFilterUrg(k)}
                className={`text-[10px] font-bold uppercase tracking-widest rounded-xl px-4 py-2.5 transition-all ${
                  active ? 'bg-white text-black shadow-sm' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {k === 'all' ? (he ? 'הכל' : 'All') : (he ? u!.he : u!.label)}
              </button>
            )
          })}
        </div>

        <div className="px-4 py-2 rounded-xl bg-[#fff4ef] border border-[#fee8df] ml-auto">
          <span className="text-[10px] font-bold text-[#e04d1c] uppercase tracking-widest">
            {filtered.length} {he ? 'תוצאות' : 'Leads Found'}
          </span>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-stone-200" strokeWidth={1.5} />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 animate-pulse">
            Analyzing Data...
          </span>
        </div>
      )}

      {/* ── Lead List (Pro View) ── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((lead) => {
            const p = getProf(lead.profession)
            const u = URG[lead.urgency]
            const PIcon = p.icon
            const UIcon = u.icon
            const isOpen = expandedId === lead.id
            const arrivalTime = new Date(lead.created_at).toLocaleTimeString(he ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })
            const arrivalDate = new Date(lead.created_at).toLocaleDateString(he ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })

            return (
              <div
                key={lead.id}
                onClick={() => setExpandedId(isOpen ? null : lead.id)}
                className={`glass-panel group cursor-pointer transition-all duration-500 overflow-hidden border-none shadow-lg hover:shadow-2xl ${
                  isOpen ? 'ring-2 ring-black/5 bg-white/95' : 'hover:-translate-y-1'
                }`}
              >
                <div className="flex items-stretch min-h-[100px]">
                  {/* Left Column: Time & Source */}
                  <div className="w-32 flex flex-col items-center justify-center border-r border-black/[0.03] bg-black/[0.01] p-4 shrink-0">
                    <span className="text-lg font-bold text-black tracking-tight text-center leading-tight">{timeAgo(lead.created_at, he)}</span>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1 text-center">{arrivalTime} • {arrivalDate}</span>
                    <div className="mt-3 flex flex-col items-center gap-1 w-full">
                      {lead.source_type === 'publisher' ? (
                        <>
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Users className="w-3 h-3 text-emerald-600" />
                          </div>
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight text-center line-clamp-1">
                            Publisher
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-6 h-6 rounded-lg bg-black/5 flex items-center justify-center">
                            <Radio className="w-3 h-3 text-stone-400" />
                          </div>
                          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-tight text-center line-clamp-1">
                            {lead.group_name || 'Unknown Group'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Center Column: Content */}
                  <div className="flex-1 flex flex-col justify-center p-6 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-sm"
                        style={{ background: `${p.color}10`, color: p.color }}
                      >
                        <PIcon className="h-4 w-4" strokeWidth={2} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: p.color }}>
                        {he ? p.he : p.label}
                      </span>
                    </div>

                    <p className={`text-base font-medium text-black leading-snug ${isOpen ? '' : 'truncate'}`}>
                      {lead.parsed_summary ?? lead.raw_message?.slice(0, 120) ?? '—'}
                    </p>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-stone-400">
                        <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          {lead.city || '—'} {lead.zip_code || ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-stone-400">
                        <Users className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">
                          {senderNames[lead.sender_id || ''] || lead.sender_id?.split('@')[0] || 'Unknown Sender'}
                        </span>
                      </div>
                    </div>

                    {/* Lead Feedback */}
                    <div className="mt-3">
                      <LeadFeedbackButtons leadId={lead.id} />
                    </div>
                  </div>

                  {/* Right Column: Status & Matching */}
                  <div className="w-48 flex flex-col justify-center p-6 border-l border-black/[0.03] shrink-0 gap-3">
                    <div className="flex items-center justify-end">
                      <div 
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-black/5"
                        style={{ background: `${u.color}10`, color: u.color }}
                      >
                        <UIcon className="w-3 h-3" strokeWidth={2.5} />
                        {he ? u.he : u.label}
                      </div>
                    </div>

                    {contactCounts[lead.id] > 0 && (
                      <div className="flex items-center justify-end gap-1.5 text-stone-400">
                        <Phone className="w-3 h-3" />
                        <span className="text-[10px] font-bold">
                          {contactCounts[lead.id]} {he ? 'פניות' : 'contacted'}
                        </span>
                      </div>
                    )}

                    <div className="mt-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          contactAdvertiser(lead)
                        }}
                        className="flex items-center justify-center gap-2 bg-[#25D366] text-white h-10 rounded-xl font-bold text-xs hover:bg-[#1da851] transition-all w-full"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {he ? 'פנה למפרסם' : 'Contact Advertiser'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isOpen && (
                  <div className="px-6 pb-8 pt-2 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                      {/* Original Message */}
                      <div className="rounded-[24px] p-6 bg-black/[0.03] border border-black/5">
                        <div className="flex items-center gap-2 mb-4">
                          <Eye className="w-4 h-4 text-stone-400" />
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                            {he ? 'הודעה מקורית' : 'Raw Intelligence'}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-stone-600 font-medium whitespace-pre-wrap">
                          {lead.raw_message}
                        </p>
                      </div>

                      {/* Details & Metadata */}
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-white shadow-sm border border-black/5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block mb-1">ZIP Code</span>
                            <span className="text-sm font-bold text-black">{lead.zip_code || '—'}</span>
                          </div>
                          <div className="p-4 rounded-2xl bg-white shadow-sm border border-black/5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block mb-1">Budget</span>
                            <span className="text-sm font-bold text-black">{lead.budget_range || '—'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              contactAdvertiser(lead)
                            }}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white h-12 rounded-2xl font-bold text-sm hover:bg-[#1da851] transition-all"
                          >
                            <MessageCircle className="w-4 h-4" />
                            {he ? 'פנה למפרסם' : 'Contact Advertiser'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Empty: missing contractor settings ── */}
      {!loading && (contractorProfessions !== null && contractorProfessions.length === 0 || contractorZips !== null && contractorZips.length === 0) && (
        <div className="glass-panel py-32 flex flex-col items-center gap-6 border-none shadow-xl">
          <div className="w-20 h-20 rounded-[24px] bg-black/[0.03] flex items-center justify-center">
            <Settings className="w-8 h-8 text-stone-300" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-light text-black mb-1">
              {he ? 'הגדר מקצועות ואזורי שירות' : 'Set up your professions & service areas'}
            </h3>
            <p className="text-sm text-stone-400 font-medium uppercase tracking-widest">
              {he ? 'עבור לפרופיל כדי להגדיר מקצועות ומיקודים' : 'Go to Profile to configure your professions and ZIP codes'}
            </p>
          </div>
        </div>
      )}

      {/* ── Empty: no matching leads ── */}
      {!loading && filtered.length === 0 && contractorProfessions !== null && contractorProfessions.length > 0 && contractorZips !== null && contractorZips.length > 0 && (
        <div className="glass-panel py-32 flex flex-col items-center gap-6 border-none shadow-xl">
          <div className="w-20 h-20 rounded-[24px] bg-black/[0.03] flex items-center justify-center">
            <Search className="w-8 h-8 text-stone-300" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-light text-black mb-1">{he ? 'לא נמצאו לידים' : 'No intelligence found'}</h3>
            <p className="text-sm text-stone-400 font-medium uppercase tracking-widest">{he ? 'נסה לשנות את הפילטרים' : 'Adjust your filters to see more results'}</p>
          </div>
        </div>
      )}

      {/* Forward Lead Modal */}
      <ForwardLeadModal
        lead={forwardLead as any}
        isOpen={!!forwardLead}
        onClose={() => setForwardLead(null)}
      />

      {/* Upsell Modal */}
      <UpsellModal 
        isOpen={showUpsell} 
        onClose={() => setShowUpsell(false)} 
      />
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────── */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = '#fe5b25',
  chartData = [],
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub: string
  trend?: { value: number; label: string }
  color?: string
  chartData?: any[]
  active?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`glass-panel group flex flex-col justify-between p-2 md:p-6 min-h-0 md:min-h-[180px] min-w-[72px] md:min-w-0 overflow-hidden transition-all duration-500 ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      } ${active ? 'ring-2 ring-black/5 bg-white/90' : ''}`}
    >
      <div className="flex items-start justify-between relative z-10">
        <div
          className="w-5 h-5 md:w-10 md:h-10 rounded-md md:rounded-[14px] flex items-center justify-center transition-all duration-500 shadow-sm"
          style={{
            background: active ? '#000' : `${color}10`,
            color: active ? '#fff' : color,
          }}
        >
          <Icon className="h-2.5 w-2.5 md:h-5 md:w-5" strokeWidth={1.5} />
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-tight ${
              trend.value >= 0 
                ? 'bg-[#fff4ef] text-[#e04d1c] border border-[#fee8df]' 
                : 'bg-rose-50 text-rose-600 border border-rose-100'
            }`}
          >
            {trend.value >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {trend.label}
          </span>
        )}
      </div>
      
      <div className="mt-0.5 md:mt-4 relative z-10">
        <div className="text-[20px] md:text-3xl font-bold md:font-light tracking-tighter text-black leading-none">
          {value}
        </div>
        <div className="text-[7px] md:text-[9px] font-bold uppercase tracking-[0.1em] text-stone-400 mt-0.5">
          {label}
        </div>
        <div className="hidden md:block mt-1 text-[11px] font-medium text-stone-400">
          {sub}
        </div>
      </div>

      {/* Sparkline Background — hidden on mobile */}
      <div className="hidden md:block absolute bottom-0 left-0 right-0 h-12 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`color-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="val" 
                stroke={color} 
                strokeWidth={2} 
                fillOpacity={1} 
                fill={`url(#color-${label})`} 
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
