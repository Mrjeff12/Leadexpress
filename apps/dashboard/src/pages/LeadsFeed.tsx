import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { useUserSubscription } from '../hooks/useUserSubscription'
import { timeAgo } from '../lib/shared'
import { supabase } from '../lib/supabase'
import ForwardLeadModal from '../components/ForwardLeadModal'
import UpsellModal from '../components/UpsellModal'
import LeadFeedbackButtons from '../components/LeadFeedbackButtons'
import { PROFESSION_ICONS } from '../lib/profession-icons'
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
  ChevronRight,
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
  Send,
  Lock,
  BadgeCheck,
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
  source?: string
}

/* ── Profession + Urgency config — unified orange palette ── */
// Brand colors only: orange (#fe5b25), black (#111), stone grays
const BRAND = '#fe5b25'
const PROF: Record<string, { icon: React.ElementType; label: string; he: string; color: string; bg: string }> = {
  hvac:            { icon: Thermometer, label: 'HVAC',            he: 'מיזוג',        color: BRAND, bg: '#fff4ef' },
  air_duct:        { icon: Wind,        label: 'Air Duct',        he: 'תעלות אוויר',   color: BRAND, bg: '#fff4ef' },
  chimney:         { icon: Flame,       label: 'Chimney',         he: 'קמינים',       color: BRAND, bg: '#fff4ef' },
  dryer_vent:      { icon: Wind,        label: 'Dryer Vent',      he: 'פתחי אוורור',   color: BRAND, bg: '#fff4ef' },
  garage_door:     { icon: Car,         label: 'Garage Door',     he: 'דלתות מוסך',   color: BRAND, bg: '#fff4ef' },
  locksmith:       { icon: Key,         label: 'Locksmith',       he: 'מנעולן',       color: BRAND, bg: '#fff4ef' },
  roofing:         { icon: Home,        label: 'Roofing',         he: 'גגות',         color: BRAND, bg: '#fff4ef' },
  plumbing:        { icon: Droplets,    label: 'Plumbing',        he: 'אינסטלציה',    color: BRAND, bg: '#fff4ef' },
  electrical:      { icon: Zap,         label: 'Electrical',      he: 'חשמל',         color: BRAND, bg: '#fff4ef' },
  painting:        { icon: Paintbrush,  label: 'Painting',        he: 'צביעה',        color: BRAND, bg: '#fff4ef' },
  cleaning:        { icon: Sparkles,    label: 'Cleaning',        he: 'ניקיון',       color: BRAND, bg: '#fff4ef' },
  carpet_cleaning: { icon: Sparkles,    label: 'Carpet Cleaning', he: 'ניקוי שטיחים', color: BRAND, bg: '#fff4ef' },
  renovation:      { icon: Wrench,      label: 'Renovation',      he: 'שיפוץ',        color: BRAND, bg: '#fff4ef' },
  fencing:         { icon: Fence,       label: 'Fencing',         he: 'גדרות',        color: BRAND, bg: '#fff4ef' },
  landscaping:     { icon: TreePine,    label: 'Landscaping',     he: 'גינון',        color: BRAND, bg: '#fff4ef' },
  tiling:          { icon: Grid,        label: 'Tiling',          he: 'ריצוף',        color: BRAND, bg: '#fff4ef' },
  kitchen:         { icon: ChefHat,     label: 'Kitchen',         he: 'מטבחים',       color: BRAND, bg: '#fff4ef' },
  bathroom:        { icon: Bath,        label: 'Bathroom',        he: 'חדרי רחצה',    color: BRAND, bg: '#fff4ef' },
  pool:            { icon: Waves,       label: 'Pool',            he: 'בריכות',       color: BRAND, bg: '#fff4ef' },
  moving:          { icon: Truck,       label: 'Moving',          he: 'הובלות',       color: BRAND, bg: '#fff4ef' },
  other:           { icon: Wrench,      label: 'Service',         he: 'שירות',        color: BRAND, bg: '#fff4ef' },
}

// Urgency — 3 tones of orange/stone (no red/yellow/blue)
const URG = {
  hot:  { icon: Flame,     label: 'Hot',  he: 'דחוף', color: '#fe5b25', bg: '#fff4ef', border: 'rgba(254,91,37,0.2)' },
  warm: { icon: Zap,       label: 'Warm', he: 'חם',   color: '#111',    bg: '#f5f5f4', border: 'rgba(17,17,17,0.1)' },
  cold: { icon: Snowflake, label: 'Cold', he: 'קר',   color: '#78716c', bg: '#fafaf9', border: 'rgba(120,113,108,0.15)' },
}

function getProf(p: string) { return PROF[p] ?? PROF.other }


/* ── Component ─────────────────────────────────────────────────────── */
export default function LeadsFeed() {
  const { user, effectiveUserId } = useAuth()
  const { locale } = useI18n()
  const { canSeeLeadDetails } = useUserSubscription()
  const he = locale === 'he'
  const nav = useNavigate()

  const [leads, setLeads] = useState<Lead[]>([])
  const [senderNames, setSenderNames] = useState<Record<string, string>>({})
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({})
  const [publisherInfo, setPublisherInfo] = useState<Record<string, { name: string; tier: string; rating: number; reviews: number }>>({})
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
    if (!canSeeLeadDetails) {
      setShowUpsell(true)
      return
    }
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
      }).then(({ error }) => { if (error) console.error('[LeadsFeed] Failed to log contact event:', error.message) })
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

  // Fetch leads that were matched to this contractor by the match-lead pipeline
  useEffect(() => {
    async function fetchLeads() {
      if (!user || !effectiveUserId) return

      // 1. Load contractor's professions (for filter UI only)
      const { data: contractor } = await supabase
        .from('contractors')
        .select('professions, zip_codes')
        .eq('user_id', effectiveUserId)
        .maybeSingle()

      setContractorProfessions(contractor?.professions ?? [])
      setContractorZips(contractor?.zip_codes ?? [])

      // 2. Fetch only leads where this contractor is in matched_contractors
      const { data, error } = await supabase
        .from('leads')
        .select('id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, source, groups ( name )')
        .contains('matched_contractors', [effectiveUserId])
        .order('created_at', { ascending: false })
        .limit(200)

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

        // Fetch publisher info for broadcast leads
        const broadcastLeadIds = leadsData.filter((l: any) => l.source === 'publisher').map((l: any) => l.id)
        if (broadcastLeadIds.length > 0) {
          const { data: broadcasts } = await supabase
            .from('job_broadcasts')
            .select('lead_id, publisher_id, profiles:publisher_id ( full_name ), publisher_profiles:publisher_id ( tier, avg_rating, review_count )')
            .in('lead_id', broadcastLeadIds)

          if (broadcasts) {
            const pubMap: Record<string, { name: string; tier: string; rating: number; reviews: number }> = {}
            broadcasts.forEach((b: any) => {
              pubMap[b.lead_id] = {
                name: b.profiles?.full_name || 'Publisher',
                tier: b.publisher_profiles?.tier || 'new',
                rating: b.publisher_profiles?.avg_rating || 0,
                reviews: b.publisher_profiles?.review_count || 0,
              }
            })
            setPublisherInfo(pubMap)
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

      {/* ── KPI Strip — unified orange/black palette ── */}
      <section className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        <KpiCard icon={Zap} label="Total" value={baseFilteredLeads.length} sub="" color="#fe5b25" chartData={[]} />
        <KpiCard icon={Flame} label="Hot" value={hot} sub="" color="#fe5b25" chartData={[]} active={filterUrg === 'hot'} onClick={() => setFilterUrg(filterUrg === 'hot' ? 'all' : 'hot')} />
        <KpiCard icon={Zap} label="Warm" value={warm} sub="" color="#111" chartData={[]} active={filterUrg === 'warm'} onClick={() => setFilterUrg(filterUrg === 'warm' ? 'all' : 'warm')} />
        <KpiCard icon={Snowflake} label="Cold" value={cold} sub="" color="#78716c" chartData={[]} active={filterUrg === 'cold'} onClick={() => setFilterUrg(filterUrg === 'cold' ? 'all' : 'cold')} />
      </section>
      <section className="hidden md:grid stagger-kpi grid-cols-4 gap-6">
        <KpiCard
          icon={Zap}
          label={he ? 'סה"כ לידים' : 'Total Leads'}
          value={baseFilteredLeads.length}
          sub={he ? 'מנותחים ע"י AI' : 'Across all channels'}
          color="#fe5b25"
          chartData={chartDataAll.all}
          active={filterUrg === 'all'}
          onClick={() => setFilterUrg('all')}
        />
        <KpiCard
          icon={Flame}
          label={he ? 'דחוף' : 'Hot Leads'}
          value={hot}
          sub={he ? 'היום / מחר' : 'Needs immediate action'}
          color="#fe5b25"
          chartData={chartDataAll.hot}
          active={filterUrg === 'hot'}
          onClick={() => setFilterUrg(filterUrg === 'hot' ? 'all' : 'hot')}
        />
        <KpiCard
          icon={Zap}
          label={he ? 'חם' : 'Warm Leads'}
          value={warm}
          sub={he ? 'השבוע' : 'Follow up required'}
          color="#111"
          chartData={chartDataAll.warm}
          active={filterUrg === 'warm'}
          onClick={() => setFilterUrg(filterUrg === 'warm' ? 'all' : 'warm')}
        />
        <KpiCard
          icon={Snowflake}
          label={he ? 'קר' : 'Cold Leads'}
          value={cold}
          sub={he ? 'עתידי' : 'Long-term prospects'}
          color="#78716c"
          chartData={chartDataAll.cold}
          active={filterUrg === 'cold'}
          onClick={() => setFilterUrg(filterUrg === 'cold' ? 'all' : 'cold')}
        />
      </section>

      {/* ── Search + Filters — Jobs design language ── */}
      <div className="bg-stone-50 rounded-[20px] p-2.5 md:p-4 flex items-center gap-2 md:gap-3 flex-wrap relative z-20">
        {/* Search */}
        <div className="relative flex-1 min-w-0 md:min-w-[280px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 text-stone-400"
            style={{ left: he ? 'auto' : 14, right: he ? 14 : 'auto' }} strokeWidth={2} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={he ? 'חפש עיר, ZIP, מקצוע...' : 'Search city, zip, profession...'}
            className="w-full text-xs md:text-sm rounded-[14px] border-none px-4 py-2.5 md:py-3 outline-none transition-all bg-white focus:ring-2 focus:ring-[#fe5b25]/20 placeholder:text-stone-400"
            style={{
              paddingLeft: he ? 16 : 42, paddingRight: he ? 42 : 16,
              color: '#111',
              fontFamily: 'Outfit, sans-serif',
            }}
          />
        </div>

        {/* Profession filter */}
        <div className="relative" ref={profRef}>
          <button
            onClick={() => setIsProfOpen(!isProfOpen)}
            className={`flex items-center justify-between gap-2 text-[10px] md:text-[11px] font-bold uppercase tracking-wider rounded-[14px] border-none px-3 py-2.5 md:px-4 md:py-3 transition-colors min-w-0 md:min-w-[180px] ${
              filterProfs.length > 0 ? 'bg-[#fe5b25] text-white' : 'bg-white text-black hover:bg-stone-100'
            }`}
          >
            <span>
              {filterProfs.length === 0
                ? (he ? 'כל המקצועות' : 'All Professions')
                : (he ? `${filterProfs.length} נבחרו` : `${filterProfs.length} Selected`)}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isProfOpen ? 'rotate-180' : ''} ${filterProfs.length > 0 ? 'text-white/70' : 'text-stone-400'}`} />
          </button>

          {isProfOpen && (
            <div className="absolute top-full mt-2 w-64 bg-white rounded-[16px] shadow-2xl border border-stone-100 overflow-hidden z-50" style={{ [he ? 'right' : 'left']: 0 }}>
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 scrollbar-hide">
                <button
                  onClick={() => setFilterProfs([])}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-xs font-bold uppercase tracking-wider transition-colors ${
                    filterProfs.length === 0 ? 'bg-[#fff4ef] text-[#fe5b25]' : 'text-stone-500 hover:bg-stone-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors ${filterProfs.length === 0 ? 'bg-[#fe5b25] border-[#fe5b25]' : 'border-stone-300'}`}>
                    {filterProfs.length === 0 && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  {he ? 'הכל' : 'All'}
                </button>
                {profs.map(p => {
                  const isSelected = filterProfs.includes(p)
                  const prof = getProf(p)
                  const profSvg = PROFESSION_ICONS[p]
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        if (isSelected) setFilterProfs(prev => prev.filter(x => x !== p))
                        else setFilterProfs(prev => [...prev, p])
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-xs font-bold uppercase tracking-wider transition-colors ${
                        isSelected ? 'bg-[#fff4ef] text-[#fe5b25]' : 'text-stone-500 hover:bg-stone-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center transition-colors ${isSelected ? 'bg-[#fe5b25] border-[#fe5b25]' : 'border-stone-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      {profSvg
                        ? <span style={{ color: '#fe5b25', width: 14, height: 14, display: 'inline-flex' }} className="[&>svg]:w-[14px] [&>svg]:h-[14px]">{profSvg}</span>
                        : <prof.icon className="w-3.5 h-3.5 text-[#fe5b25]" />
                      }
                      {he ? prof.he : prof.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Date filter */}
        <div className="relative" ref={dateRef}>
          <button
            onClick={() => setIsDateOpen(!isDateOpen)}
            className={`flex items-center justify-between gap-2 text-[10px] md:text-[11px] font-bold uppercase tracking-wider rounded-[14px] border-none px-3 py-2.5 md:px-4 md:py-3 transition-colors min-w-0 md:min-w-[140px] ${
              filterDate !== 'all' ? 'bg-[#fe5b25] text-white' : 'bg-white text-black hover:bg-stone-100'
            }`}
          >
            <span>
              {filterDate === 'all' ? (he ? 'כל הזמנים' : 'All Time') :
               filterDate === 'today' ? (he ? 'היום' : 'Today') :
               filterDate === 'yesterday' ? (he ? 'אתמול' : 'Yesterday') :
               filterDate === 'week' ? (he ? 'השבוע' : 'This Week') :
               (he ? 'תאריך ספציפי' : 'Custom')}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDateOpen ? 'rotate-180' : ''} ${filterDate !== 'all' ? 'text-white/70' : 'text-stone-400'}`} />
          </button>

          {isDateOpen && (
            <div className="absolute top-full mt-2 w-48 bg-white rounded-[16px] shadow-2xl border border-stone-100 overflow-hidden z-50" style={{ [he ? 'right' : 'left']: 0 }}>
              <div className="p-2 space-y-1">
                {(['all', 'today', 'yesterday', 'week', 'custom'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setFilterDate(d)
                      if (d !== 'custom') setIsDateOpen(false)
                    }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-[12px] text-xs font-bold uppercase tracking-wider transition-colors ${
                      filterDate === d ? 'bg-[#fff4ef] text-[#fe5b25]' : 'text-stone-500 hover:bg-stone-50'
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
                      className="w-full text-xs font-bold uppercase tracking-wider rounded-[10px] border border-stone-200 px-3 py-2 outline-none focus:border-[#fe5b25]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Urgency toggle */}
        <div className="flex gap-1 bg-white p-1 rounded-[14px]">
          {(['all', 'hot', 'warm', 'cold'] as const).map(k => {
            const active = filterUrg === k
            const u = k !== 'all' ? URG[k] : null
            return (
              <button
                key={k}
                onClick={() => setFilterUrg(k)}
                className={`text-[10px] font-bold uppercase tracking-wider rounded-[10px] px-3 py-2 md:px-4 md:py-2 transition-all ${
                  active ? 'bg-[#fe5b25] text-white shadow-sm' : 'text-stone-500 hover:text-black'
                }`}
              >
                {k === 'all' ? (he ? 'הכל' : 'All') : (he ? u!.he : u!.label)}
              </button>
            )
          })}
        </div>

        {/* Result count */}
        <div className="px-3 py-2 rounded-[12px] bg-white md:ml-auto">
          <span className="text-[10px] font-bold text-[#fe5b25] uppercase tracking-wider">
            {filtered.length} {he ? 'תוצאות' : 'Results'}
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
          {/* Mobile compact cards — Jobs design language */}
          <div className="md:hidden space-y-2">
            {filtered.map((lead) => {
              const p = getProf(lead.profession)
              const isUrgent = lead.urgency === 'hot'
              const profSvg = PROFESSION_ICONS[lead.profession]
              return (
                <div
                  key={lead.id}
                  onClick={() => nav(`/leads/${lead.id}`)}
                  className="bg-stone-50 rounded-[20px] px-4 py-3 flex items-center gap-3 active:scale-[0.97] transition-transform cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-[12px] bg-[#fff4ef] flex items-center justify-center flex-shrink-0">
                    {profSvg
                      ? <span style={{ color: '#fe5b25', width: 20, height: 20, display: 'inline-flex' }} className="[&>svg]:w-5 [&>svg]:h-5">{profSvg}</span>
                      : <p.icon className="w-5 h-5 text-[#fe5b25]" strokeWidth={2} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-black truncate">{he ? p.he : p.label}</p>
                      {isUrgent && (
                        <span className="text-[8px] font-bold text-[#fe5b25] bg-[#fff4ef] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          {he ? 'דחוף' : 'Hot'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead.city && <span className="text-[10px] text-stone-500">{lead.city}</span>}
                      <span className="text-[10px] text-stone-400">{timeAgo(lead.created_at, he)}</span>
                      {lead.source === 'publisher' ? (
                        <span className="text-[8px] font-bold text-[#fe5b25] uppercase tracking-wider flex items-center gap-0.5">
                          {publisherInfo[lead.id]?.tier && publisherInfo[lead.id].tier !== 'new' && (
                            <BadgeCheck className="w-2.5 h-2.5" />
                          )}
                          {publisherInfo[lead.id]?.name?.split(' ')[0] || 'Publisher'}
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold text-stone-400 uppercase tracking-wider">WhatsApp</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lead.budget_range && <span className="text-[12px] font-bold text-black">{lead.budget_range}</span>}
                    <ChevronRight className="w-3.5 h-3.5 text-stone-300" />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop cards */}
          <div className="hidden md:block space-y-4">
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
                style={{ borderLeft: `3px solid ${u.color}` }}
              >
                <div className="flex flex-col md:flex-row md:items-stretch md:min-h-[100px]">
                  {/* Left Column: Time & Source — desktop only */}
                  <div className="hidden md:flex w-32 flex-col items-center justify-center border-r border-black/[0.03] bg-black/[0.01] p-4 shrink-0">
                    <span className="text-lg font-bold text-black tracking-tight text-center leading-tight">{timeAgo(lead.created_at, he)}</span>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1 text-center">{arrivalTime} • {arrivalDate}</span>
                    <div className="mt-3 flex flex-col items-center gap-1 w-full">
                      {lead.source === 'publisher' ? (
                        <>
                          <div className="w-6 h-6 rounded-lg bg-[#fff4ef] flex items-center justify-center">
                            <Users className="w-3 h-3 text-[#fe5b25]" />
                          </div>
                          <span className="text-[9px] font-bold text-[#fe5b25] tracking-tight text-center line-clamp-1">
                            {publisherInfo[lead.id]?.name?.split(' ')[0] || 'Publisher'}
                          </span>
                          {publisherInfo[lead.id]?.tier && publisherInfo[lead.id].tier !== 'new' && (
                            <BadgeCheck className="w-3 h-3 text-[#fe5b25]" />
                          )}
                        </>
                      ) : (
                        <>
                          <div className="w-6 h-6 rounded-lg bg-stone-100 flex items-center justify-center">
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
                  <div className="flex-1 flex flex-col justify-center p-4 md:p-6 min-w-0">
                    {/* Mobile header: profession + urgency + time */}
                    <div className="flex items-center gap-2 mb-2 md:hidden">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${p.color}10`, color: p.color }}>
                        <PIcon className="h-3.5 w-3.5" strokeWidth={2} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.color }}>
                        {he ? p.he : p.label}
                      </span>
                      <span className="ml-auto text-[9px] font-bold text-stone-400">{timeAgo(lead.created_at, he)}</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: `${u.color}10`, color: u.color }}>
                        <UIcon className="w-3 h-3" />
                        {he ? u.he : u.label}
                      </div>
                    </div>
                    {/* Desktop header: profession icon */}
                    <div className="hidden md:flex items-center gap-3 mb-2">
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
                          {canSeeLeadDetails
                            ? (senderNames[lead.sender_id || ''] || lead.sender_id?.split('@')[0] || 'Unknown Sender')
                            : 'XXX-XXX-XXXX'}
                        </span>
                        {!canSeeLeadDetails && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowUpsell(true) }}
                            className="text-[9px] font-bold text-[#e04d1c] hover:underline ml-1"
                          >
                            {he ? 'שדרג לצפייה' : 'Upgrade to view'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile action bar */}
                    <div className="flex gap-2 mt-3 md:hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); contactAdvertiser(lead) }}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-white h-9 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${canSeeLeadDetails ? 'bg-[#fe5b25]' : 'bg-stone-400'}`}
                      >
                        {canSeeLeadDetails ? <MessageCircle className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {canSeeLeadDetails ? (he ? 'פנה' : 'Contact') : (he ? 'שדרג' : 'Upgrade')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); nav(`/leads/${lead.id}`) }}
                        className="px-4 h-9 rounded-xl font-bold text-xs bg-gray-100 text-gray-700"
                      >
                        {he ? 'פרטים' : 'Details'} →
                      </button>
                    </div>

                    {/* Lead Feedback */}
                    <div className="mt-3">
                      <LeadFeedbackButtons leadId={lead.id} />
                    </div>
                  </div>

                  {/* Right Column: Status & Matching — desktop only */}
                  <div className="hidden md:flex w-48 flex-col justify-center p-6 border-l border-black/[0.03] shrink-0 gap-3">
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
                        className={`flex items-center justify-center gap-2 text-white h-10 rounded-xl font-bold text-xs transition-all w-full ${
                          canSeeLeadDetails
                            ? 'bg-[#fe5b25] hover:bg-[#e04d1c]'
                            : 'bg-stone-400 hover:bg-stone-500'
                        }`}
                      >
                        {canSeeLeadDetails ? (
                          <MessageCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Lock className="w-3.5 h-3.5" />
                        )}
                        {canSeeLeadDetails
                          ? (he ? 'פנה למפרסם' : 'Contact Advertiser')
                          : (he ? 'שדרג לפרימיום' : 'Upgrade to Contact')}
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
                            {he ? 'הודעה מקורית' : 'Original Message'}
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
                            className={`flex-1 flex items-center justify-center gap-2 text-white h-12 rounded-2xl font-bold text-sm transition-all ${
                              canSeeLeadDetails
                                ? 'bg-[#25D366] hover:bg-[#1da851]'
                                : 'bg-stone-400 hover:bg-stone-500'
                            }`}
                          >
                            {canSeeLeadDetails ? (
                              <MessageCircle className="w-4 h-4" />
                            ) : (
                              <Lock className="w-4 h-4" />
                            )}
                            {canSeeLeadDetails
                              ? (he ? 'פנה למפרסם' : 'Contact Advertiser')
                              : (he ? 'שדרג לפרימיום' : 'Upgrade to Contact')}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              nav(`/leads/${lead.id}`)
                            }}
                            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 h-12 px-5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all md:hidden"
                          >
                            {he ? 'פרטים' : 'Details'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setForwardLead(lead)
                            }}
                            className="flex items-center justify-center gap-2 bg-[#e04d1c] text-white h-12 px-5 rounded-2xl font-bold text-sm hover:bg-[#c43d10] transition-all"
                          >
                            <Send className="w-4 h-4" />
                            {he ? 'העבר' : 'Forward'}
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
  const isActive = !!active
  const bg = isActive ? '#fe5b25' : '#fafaf9'
  const textPrimary = isActive ? '#fff' : '#111'
  const textLabel = isActive ? 'rgba(255,255,255,0.7)' : '#a8a29e'
  const textSub = isActive ? 'rgba(255,255,255,0.6)' : '#a8a29e'
  const iconBg = isActive ? 'rgba(255,255,255,0.18)' : '#fff'
  const iconColor = isActive ? '#fff' : (color || '#fe5b25')

  return (
    <div
      onClick={onClick}
      className={`group flex flex-col justify-between p-2.5 md:p-5 min-h-0 md:min-h-[160px] min-w-[82px] md:min-w-0 overflow-hidden transition-all duration-300 rounded-[16px] md:rounded-[20px] ${
        onClick ? 'cursor-pointer active:scale-[0.97]' : ''
      }`}
      style={{ background: bg }}
    >
      <div className="flex items-start justify-between relative z-10">
        <div
          className="w-6 h-6 md:w-9 md:h-9 rounded-lg md:rounded-[12px] flex items-center justify-center transition-all"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon className="h-3 w-3 md:h-[18px] md:w-[18px]" strokeWidth={2} />
        </div>
        {trend && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{
              background: isActive ? 'rgba(255,255,255,0.15)' : '#fff4ef',
              color: isActive ? '#fff' : '#fe5b25',
            }}
          >
            {trend.value >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {trend.label}
          </span>
        )}
      </div>

      <div className="mt-1 md:mt-3 relative z-10">
        <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5" style={{ color: textLabel }}>
          {label}
        </div>
        <div className="text-[22px] md:text-[28px] font-light tracking-[-0.03em] leading-none" style={{ color: textPrimary }}>
          {value}
        </div>
        <div className="hidden md:block mt-1 text-[11px] font-medium" style={{ color: textSub }}>
          {sub}
        </div>
      </div>

      {/* Sparkline Background — hidden on mobile */}
      <div className="hidden md:block absolute bottom-0 left-0 right-0 h-10 opacity-30 group-hover:opacity-50 transition-opacity duration-500 pointer-events-none">
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`lf-spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isActive ? '#fff' : (color || '#fe5b25')} stopOpacity={isActive ? 0.5 : 0.3}/>
                  <stop offset="95%" stopColor={isActive ? '#fff' : (color || '#fe5b25')} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="val"
                stroke={isActive ? '#fff' : (color || '#fe5b25')}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#lf-spark-${label})`}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
