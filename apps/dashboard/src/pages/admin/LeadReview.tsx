import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { timeAgo } from '../../lib/shared'
import {
  MapPin,
  Flame,
  Zap,
  Snowflake,
  Search,
  Loader2,
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
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save,
  X,
  Keyboard,
  BarChart3,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
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
  state: string | null
  budget_range: string | null
  urgency: 'hot' | 'warm' | 'cold'
  status: string
  sent_to_count: number
  sender_id: string | null
  created_at: string
  review_status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  group?: { name: string }
}

/* ── Profession + Urgency config (matching AdminLeads) ─────────────── */
const PROF: Record<string, { icon: typeof Wrench; label: string; he: string; color: string; bg: string }> = {
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
  hot:  { icon: Flame,     label: 'Hot',  he: 'דחוף', color: '#FF3B30', bg: 'rgba(255,59,48,0.08)' },
  warm: { icon: Zap,       label: 'Warm', he: 'חם',   color: '#FF9500', bg: 'rgba(255,149,0,0.08)' },
  cold: { icon: Snowflake, label: 'Cold', he: 'קר',   color: '#5AC8FA', bg: 'rgba(90,200,250,0.08)' },
}

const REJECTION_REASONS = [
  { value: 'spam', label: 'Spam', he: 'ספאם' },
  { value: 'not_a_job', label: 'Not a Job', he: 'לא עבודה' },
  { value: 'wrong_category', label: 'Wrong Category', he: 'קטגוריה שגויה' },
  { value: 'duplicate', label: 'Duplicate', he: 'כפול' },
]

function getProf(p: string) { return PROF[p] ?? PROF.other }

/* ── Component ─────────────────────────────────────────────────────── */
export default function LeadReview() {
  const { locale } = useI18n()
  const { user } = useAuth()
  const he = locale === 'he'

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [filterProfs, setFilterProfs] = useState<string[]>([])
  const [isProfOpen, setIsProfOpen] = useState(false)
  const profRef = useRef<HTMLDivElement>(null)
  const [filterDate, setFilterDate] = useState('all')
  const [isDateOpen, setIsDateOpen] = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')

  // Current review item
  const [currentIdx, setCurrentIdx] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<{ profession: string; city: string; zip_code: string }>({
    profession: '', city: '', zip_code: '',
  })

  // Rejection modal
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('spam')

  // Show keyboard shortcuts hint
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Click outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profRef.current && !profRef.current.contains(event.target as Node)) setIsProfOpen(false)
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) setIsDateOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch leads
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('leads')
        .select(`
          id, group_id, profession, parsed_summary, raw_message,
          city, zip_code, state, budget_range, urgency, status,
          sent_to_count, sender_id, created_at,
          review_status, reviewed_by, reviewed_at, rejection_reason,
          group:groups(name)
        `)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (data) setLeads(data as any[])
      setLoading(false)
    })()
  }, [])

  // Filtered leads
  const filtered = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('en-CA')
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)

    return leads.filter(l => {
      // Review status
      if (filterStatus !== 'all' && l.review_status !== filterStatus) return false
      // Search
      if (search) {
        const q = search.toLowerCase()
        const matchesSearch = l.parsed_summary?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) || l.zip_code?.includes(q) ||
          l.profession.toLowerCase().includes(q) || l.raw_message?.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }
      // Profession
      if (filterProfs.length > 0 && !filterProfs.includes(l.profession)) return false
      // Date
      if (filterDate !== 'all') {
        const leadDateObj = new Date(l.created_at)
        const leadDateStr = leadDateObj.toLocaleDateString('en-CA')
        if (filterDate === 'today' && leadDateStr !== todayStr) return false
        if (filterDate === 'yesterday' && leadDateStr !== yesterdayStr) return false
        if (filterDate === 'week' && leadDateObj < weekAgo) return false
      }
      return true
    })
  }, [leads, filterStatus, search, filterProfs, filterDate])

  // Stats
  const stats = useMemo(() => {
    const total = leads.length
    const approved = leads.filter(l => l.review_status === 'approved').length
    const rejected = leads.filter(l => l.review_status === 'rejected').length
    const pending = leads.filter(l => l.review_status === 'pending').length
    const reviewed = approved + rejected
    const reviewedPct = total > 0 ? Math.round((reviewed / total) * 100) : 0
    const approvalRate = reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0

    // Most common rejection reason
    const reasonCounts: Record<string, number> = {}
    leads.filter(l => l.rejection_reason).forEach(l => {
      reasonCounts[l.rejection_reason!] = (reasonCounts[l.rejection_reason!] || 0) + 1
    })
    const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]
    const topReasonLabel = topReason
      ? REJECTION_REASONS.find(r => r.value === topReason[0])?.label ?? topReason[0]
      : 'N/A'

    return { total, approved, rejected, pending, reviewedPct, approvalRate, topReasonLabel }
  }, [leads])

  const profs = useMemo(() => [...new Set(leads.map(l => l.profession))].sort(), [leads])

  // Clamp currentIdx
  useEffect(() => {
    if (currentIdx >= filtered.length && filtered.length > 0) setCurrentIdx(filtered.length - 1)
    if (filtered.length === 0) setCurrentIdx(0)
  }, [filtered.length, currentIdx])

  // Actions
  const approveLead = useCallback(async (id: string) => {
    setSaving(id)
    const { error } = await supabase
      .from('leads')
      .update({
        review_status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', id)

    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? {
        ...l, review_status: 'approved' as const, reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(), rejection_reason: null,
      } : l))
      // Auto-advance
      if (currentIdx < filtered.length - 1) setCurrentIdx(i => i + 1)
    }
    setSaving(null)
  }, [user?.id, currentIdx, filtered.length])

  const rejectLead = useCallback(async (id: string, reason: string) => {
    setSaving(id)
    const { error } = await supabase
      .from('leads')
      .update({
        review_status: 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', id)

    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? {
        ...l, review_status: 'rejected' as const, reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(), rejection_reason: reason,
      } : l))
      setRejectingId(null)
      if (currentIdx < filtered.length - 1) setCurrentIdx(i => i + 1)
    }
    setSaving(null)
  }, [user?.id, currentIdx, filtered.length])

  const resetReview = useCallback(async (id: string) => {
    setSaving(id)
    const { error } = await supabase
      .from('leads')
      .update({ review_status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null })
      .eq('id', id)

    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? {
        ...l, review_status: 'pending' as const, reviewed_by: null, reviewed_at: null, rejection_reason: null,
      } : l))
    }
    setSaving(null)
  }, [])

  const saveEdit = useCallback(async (id: string) => {
    setSaving(id)
    const { error } = await supabase
      .from('leads')
      .update({
        profession: editFields.profession,
        city: editFields.city || null,
        zip_code: editFields.zip_code || null,
      })
      .eq('id', id)

    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? {
        ...l,
        profession: editFields.profession,
        city: editFields.city || null,
        zip_code: editFields.zip_code || null,
      } : l))
      setEditingId(null)
    }
    setSaving(null)
  }, [editFields])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (rejectingId || editingId) return

      const lead = filtered[currentIdx]
      if (!lead) return

      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault()
          approveLead(lead.id)
          break
        case 'r':
          e.preventDefault()
          setRejectingId(lead.id)
          setRejectReason('spam')
          break
        case 'n':
        case 'arrowdown':
          e.preventDefault()
          if (currentIdx < filtered.length - 1) setCurrentIdx(i => i + 1)
          break
        case 'p':
        case 'arrowup':
          e.preventDefault()
          if (currentIdx > 0) setCurrentIdx(i => i - 1)
          break
        case 'e':
          e.preventDefault()
          setEditingId(lead.id)
          setEditFields({
            profession: lead.profession,
            city: lead.city || '',
            zip_code: lead.zip_code || '',
          })
          break
        case '?':
          e.preventDefault()
          setShowShortcuts(s => !s)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, currentIdx, rejectingId, editingId, approveLead])

  const currentLead = filtered[currentIdx] ?? null

  return (
    <div className="animate-fade-in space-y-8 pb-20 pt-4" style={{ fontFamily: 'Outfit, sans-serif' }}>

      {/* ── Header ── */}
      <header className="flex items-end justify-between px-2">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-black">
            {he ? 'בדיקת איכות לידים' : 'Lead Quality Review'}
          </h1>
          <p className="mt-2 text-sm font-medium text-stone-400 tracking-wide uppercase">
            {he ? 'אמת, אשר או דחה לידים שחולצו ע"י AI' : 'Verify, approve, or reject AI-parsed leads'}
          </p>
        </div>
        <button
          onClick={() => setShowShortcuts(s => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 backdrop-blur-md border border-black/5 shadow-sm hover:bg-white/80 transition-all"
        >
          <Keyboard className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs font-bold tracking-tight text-stone-500 uppercase">Shortcuts</span>
        </button>
      </header>

      {/* ── Keyboard shortcuts hint ── */}
      {showShortcuts && (
        <div className="glass-panel p-5 border-none shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <Keyboard className="w-4 h-4 text-stone-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'A', desc: 'Approve lead' },
              { key: 'R', desc: 'Reject lead' },
              { key: 'N / Down', desc: 'Next lead' },
              { key: 'P / Up', desc: 'Previous lead' },
              { key: 'E', desc: 'Edit parsed fields' },
              { key: '?', desc: 'Toggle shortcuts' },
            ].map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded-lg bg-black/5 border border-black/10 text-[10px] font-bold text-black tracking-wider min-w-[40px] text-center">
                  {s.key}
                </kbd>
                <span className="text-xs text-stone-500 font-medium">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats Strip ── */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={BarChart3} label={he ? 'סה"כ' : 'Total'} value={stats.total} color="#000" />
        <StatCard icon={Clock} label={he ? 'ממתינים' : 'Pending'} value={stats.pending} color="#f59e0b" />
        <StatCard icon={ShieldCheck} label={he ? 'מאושרים' : 'Approved'} value={stats.approved} color="#10b981" />
        <StatCard icon={ShieldX} label={he ? 'נדחו' : 'Rejected'} value={stats.rejected} color="#ef4444" />
        <StatCard icon={CheckCircle2} label={he ? '% סקירה' : 'Reviewed %'} value={`${stats.reviewedPct}%`} color="#8b5cf6" />
        <StatCard icon={AlertTriangle} label={he ? 'סיבת דחייה עיקרית' : 'Top Rejection'} value={stats.topReasonLabel} color="#f97316" small />
      </section>

      {/* ── Filters ── */}
      <div className="glass-panel p-4 flex items-center gap-4 flex-wrap border-none shadow-xl relative z-20">
        {/* Review status tabs */}
        <div className="flex gap-1 bg-black/[0.03] p-1.5 rounded-2xl">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(k => {
            const active = filterStatus === k
            const labels: Record<string, { en: string; he: string }> = {
              pending: { en: 'Pending', he: 'ממתין' },
              approved: { en: 'Approved', he: 'מאושר' },
              rejected: { en: 'Rejected', he: 'נדחה' },
              all: { en: 'All', he: 'הכל' },
            }
            const colors: Record<string, string> = {
              pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', all: '#000',
            }
            return (
              <button
                key={k}
                onClick={() => { setFilterStatus(k); setCurrentIdx(0) }}
                className={`text-[10px] font-bold uppercase tracking-widest rounded-xl px-4 py-2.5 transition-all ${
                  active ? 'bg-white text-black shadow-sm' : 'text-stone-400 hover:text-stone-600'
                }`}
                style={active ? { borderBottom: `2px solid ${colors[k]}` } : undefined}
              >
                {he ? labels[k].he : labels[k].en}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 text-stone-400" style={{ left: he ? 'auto' : 16, right: he ? 16 : 'auto' }} strokeWidth={2} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={he ? 'חפש בהודעה, עיר, ZIP...' : 'Search message, city, ZIP...'}
            className="w-full text-sm rounded-2xl border-none px-6 py-3 outline-none transition-all bg-black/[0.03] focus:bg-black/[0.05] focus:ring-2 focus:ring-black/5"
            style={{ paddingLeft: he ? 16 : 48, paddingRight: he ? 48 : 16, color: '#000', fontFamily: 'Outfit, sans-serif' }}
          />
        </div>

        {/* Profession filter */}
        <div className="relative" ref={profRef}>
          <button
            onClick={() => setIsProfOpen(!isProfOpen)}
            className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest rounded-2xl border-none px-5 py-3 bg-black text-white hover:bg-stone-800 transition-colors min-w-[180px]"
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

        {/* Date filter */}
        <div className="relative" ref={dateRef}>
          <button
            onClick={() => setIsDateOpen(!isDateOpen)}
            className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest rounded-2xl border-none px-5 py-3 bg-black/[0.03] text-black hover:bg-black/[0.05] transition-colors min-w-[140px]"
          >
            <span>
              {filterDate === 'all' ? (he ? 'כל הזמנים' : 'All Time') :
               filterDate === 'today' ? (he ? 'היום' : 'Today') :
               filterDate === 'yesterday' ? (he ? 'אתמול' : 'Yesterday') :
               (he ? 'השבוע' : 'This Week')}
            </span>
            <ChevronDown className={`w-4 h-4 text-black/40 transition-transform ${isDateOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDateOpen && (
            <div className="absolute top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden z-50" style={{ [he ? 'right' : 'left']: 0 }}>
              <div className="p-2 space-y-1">
                {(['all', 'today', 'yesterday', 'week'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => { setFilterDate(d); setIsDateOpen(false) }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                      filterDate === d ? 'bg-black/[0.03] text-black' : 'text-stone-500 hover:bg-black/[0.02]'
                    }`}
                  >
                    {d === 'all' ? (he ? 'כל הזמנים' : 'All Time') :
                     d === 'today' ? (he ? 'היום' : 'Today') :
                     d === 'yesterday' ? (he ? 'אתמול' : 'Yesterday') :
                     (he ? 'השבוע' : 'This Week')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 ml-auto">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
            {filtered.length} {he ? 'תוצאות' : 'Leads'}
          </span>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-stone-200" strokeWidth={1.5} />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 animate-pulse">Loading Leads...</span>
        </div>
      )}

      {/* ── Review Queue ── */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-4">
          {/* Navigation bar */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => currentIdx > 0 && setCurrentIdx(i => i - 1)}
                disabled={currentIdx === 0}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/[0.03] hover:bg-black/[0.06] transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-black tracking-tight">
                {currentIdx + 1} / {filtered.length}
              </span>
              <button
                onClick={() => currentIdx < filtered.length - 1 && setCurrentIdx(i => i + 1)}
                disabled={currentIdx >= filtered.length - 1}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/[0.03] hover:bg-black/[0.06] transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current lead detail card */}
          {currentLead && (
            <div className="glass-panel border-none shadow-xl overflow-hidden">
              {/* Review status badge at top */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-black/[0.03]"
                style={{
                  background: currentLead.review_status === 'approved' ? 'rgba(16,185,129,0.05)'
                    : currentLead.review_status === 'rejected' ? 'rgba(239,68,68,0.05)'
                    : 'rgba(245,158,11,0.05)',
                }}>
                <div className="flex items-center gap-2">
                  {currentLead.review_status === 'approved' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {currentLead.review_status === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                  {currentLead.review_status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{
                    color: currentLead.review_status === 'approved' ? '#10b981'
                      : currentLead.review_status === 'rejected' ? '#ef4444' : '#f59e0b',
                  }}>
                    {currentLead.review_status === 'approved' ? 'Approved' : currentLead.review_status === 'rejected' ? 'Rejected' : 'Pending Review'}
                    {currentLead.rejection_reason && ` — ${REJECTION_REASONS.find(r => r.value === currentLead.rejection_reason)?.label ?? currentLead.rejection_reason}`}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  {timeAgo(currentLead.created_at, he)} &middot; {currentLead.group?.name || 'Unknown Group'}
                </span>
              </div>

              {/* Two-column content: raw message vs parsed data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-black/[0.04]">
                {/* LEFT: Raw message */}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="w-4 h-4 text-stone-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                      Original WhatsApp Message
                    </span>
                  </div>
                  <div className="rounded-2xl p-5 bg-black/[0.02] border border-black/5">
                    <p className="text-sm leading-relaxed text-stone-700 font-medium whitespace-pre-wrap">
                      {currentLead.raw_message}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-stone-400">
                    <Radio className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {currentLead.group?.name || 'Unknown'}
                    </span>
                    {currentLead.sender_id && (
                      <>
                        <span className="text-stone-300">|</span>
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          {currentLead.sender_id.split('@')[0]}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* RIGHT: AI-parsed data */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                        AI-Parsed Data
                      </span>
                    </div>
                    {editingId !== currentLead.id && (
                      <button
                        onClick={() => {
                          setEditingId(currentLead.id)
                          setEditFields({
                            profession: currentLead.profession,
                            city: currentLead.city || '',
                            zip_code: currentLead.zip_code || '',
                          })
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-black hover:bg-black/[0.03] transition-all"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>

                  {/* Parsed summary */}
                  <div className="rounded-2xl p-5 bg-violet-50/50 border border-violet-100/50 mb-4">
                    <p className="text-sm font-medium text-black leading-relaxed">
                      {currentLead.parsed_summary}
                    </p>
                  </div>

                  {/* Parsed fields */}
                  {editingId === currentLead.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block mb-1">Profession</label>
                        <select
                          value={editFields.profession}
                          onChange={e => setEditFields(f => ({ ...f, profession: e.target.value }))}
                          className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/20 bg-white"
                        >
                          {Object.entries(PROF).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block mb-1">City</label>
                          <input
                            value={editFields.city}
                            onChange={e => setEditFields(f => ({ ...f, city: e.target.value }))}
                            className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/20"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block mb-1">ZIP Code</label>
                          <input
                            value={editFields.zip_code}
                            onChange={e => setEditFields(f => ({ ...f, zip_code: e.target.value }))}
                            className="w-full text-sm rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/20"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(currentLead.id)}
                          disabled={saving === currentLead.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-stone-800 transition-colors disabled:opacity-50"
                        >
                          <Save className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black/5 text-black text-xs font-bold uppercase tracking-wider hover:bg-black/10 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <FieldCard label="Profession" value={(() => { const p = getProf(currentLead.profession); return he ? p.he : p.label })()}
                        icon={getProf(currentLead.profession).icon} iconColor={getProf(currentLead.profession).color} />
                      <FieldCard label="Urgency" value={he ? URG[currentLead.urgency].he : URG[currentLead.urgency].label}
                        icon={URG[currentLead.urgency].icon} iconColor={URG[currentLead.urgency].color} />
                      <FieldCard label="City" value={currentLead.city || '---'} icon={MapPin} iconColor="#6b7280" />
                      <FieldCard label="ZIP Code" value={currentLead.zip_code || '---'} icon={MapPin} iconColor="#6b7280" />
                      <FieldCard label="State" value={currentLead.state || '---'} icon={MapPin} iconColor="#6b7280" />
                      <FieldCard label="Budget" value={currentLead.budget_range || '---'} icon={Zap} iconColor="#f59e0b" />
                    </div>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-3 px-6 py-4 border-t border-black/[0.04] bg-black/[0.01]">
                <button
                  onClick={() => approveLead(currentLead.id)}
                  disabled={saving === currentLead.id}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {he ? 'אשר' : 'Approve'} <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[9px]">A</kbd>
                </button>
                <button
                  onClick={() => { setRejectingId(currentLead.id); setRejectReason('spam') }}
                  disabled={saving === currentLead.id}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-500 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-50 shadow-sm"
                >
                  <XCircle className="w-4 h-4" />
                  {he ? 'דחה' : 'Reject'} <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[9px]">R</kbd>
                </button>
                {currentLead.review_status !== 'pending' && (
                  <button
                    onClick={() => resetReview(currentLead.id)}
                    disabled={saving === currentLead.id}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-black/5 text-black text-xs font-bold uppercase tracking-widest hover:bg-black/10 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {he ? 'אפס' : 'Reset'}
                  </button>
                )}
                <div className="ml-auto text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  {he ? 'הבא' : 'Next'}: <kbd className="px-1.5 py-0.5 rounded bg-black/5 border border-black/10 text-[9px]">N</kbd>
                </div>
              </div>
            </div>
          )}

          {/* Lead list below (compact rows) */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 px-2 mb-3">
              {he ? 'רשימת לידים' : 'Lead List'} ({filtered.length})
            </h3>
            {filtered.map((lead, idx) => {
              const p = getProf(lead.profession)
              const u = URG[lead.urgency]
              const PIcon = p.icon
              const isActive = idx === currentIdx

              return (
                <div
                  key={lead.id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 ${
                    isActive
                      ? 'bg-white shadow-lg ring-2 ring-black/5'
                      : 'bg-white/40 hover:bg-white/70 hover:shadow-md'
                  }`}
                >
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    lead.review_status === 'approved' ? 'bg-emerald-500'
                      : lead.review_status === 'rejected' ? 'bg-red-500'
                      : 'bg-amber-400'
                  }`} />

                  {/* Profession icon */}
                  <div
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: `${p.color}10`, color: p.color }}
                  >
                    <PIcon className="h-4 w-4" strokeWidth={2} />
                  </div>

                  {/* Summary */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black truncate">{lead.parsed_summary}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.color }}>
                        {he ? p.he : p.label}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {lead.city || '---'}{lead.zip_code ? ` ${lead.zip_code}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Urgency */}
                  <div
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0"
                    style={{ background: u.bg, color: u.color }}
                  >
                    <u.icon className="w-3 h-3" />
                    {he ? u.he : u.label}
                  </div>

                  {/* Time */}
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider shrink-0 w-16 text-right">
                    {timeAgo(lead.created_at, he)}
                  </span>

                  {/* Review status badge */}
                  <div className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    lead.review_status === 'approved'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : lead.review_status === 'rejected'
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {lead.review_status === 'approved' ? (he ? 'מאושר' : 'OK')
                      : lead.review_status === 'rejected' ? (he ? 'נדחה' : 'REJ')
                      : (he ? 'ממתין' : 'NEW')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <div className="glass-panel py-32 flex flex-col items-center gap-6 border-none shadow-xl">
          <div className="w-20 h-20 rounded-[24px] bg-black/[0.03] flex items-center justify-center">
            <Search className="w-8 h-8 text-stone-300" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-light text-black mb-1">{he ? 'לא נמצאו לידים' : 'No leads found'}</h3>
            <p className="text-sm text-stone-400 font-medium uppercase tracking-widest">
              {he ? 'נסה לשנות את הפילטרים' : 'Adjust your filters to see more results'}
            </p>
          </div>
        </div>
      )}

      {/* ── Rejection reason modal ── */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setRejectingId(null)}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-black mb-1">{he ? 'סיבת דחייה' : 'Rejection Reason'}</h3>
            <p className="text-sm text-stone-400 mb-6">{he ? 'בחר סיבה לדחיית הליד' : 'Select why this lead should be rejected'}</p>
            <div className="space-y-2 mb-6">
              {REJECTION_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRejectReason(r.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    rejectReason === r.value
                      ? 'bg-red-50 text-red-600 border-2 border-red-200'
                      : 'bg-black/[0.02] text-stone-600 border-2 border-transparent hover:bg-black/[0.04]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    rejectReason === r.value ? 'border-red-500 bg-red-500' : 'border-stone-300'
                  }`}>
                    {rejectReason === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  {he ? r.he : r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => rejectLead(rejectingId, rejectReason)}
                disabled={saving === rejectingId}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-red-500 text-white text-sm font-bold uppercase tracking-wider hover:bg-red-600 transition-all disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {he ? 'דחה' : 'Reject Lead'}
              </button>
              <button
                onClick={() => setRejectingId(null)}
                className="px-5 py-3 rounded-2xl bg-black/5 text-black text-sm font-bold uppercase tracking-wider hover:bg-black/10 transition-all"
              >
                {he ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, small }: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  small?: boolean
}) {
  return (
    <div className="glass-panel p-4 flex flex-col gap-2 min-h-[100px]">
      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: `${color}10`, color }}>
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">{label}</div>
      <div className={`${small ? 'text-sm' : 'text-2xl'} font-light tracking-tighter text-black`}>{value}</div>
    </div>
  )
}

function FieldCard({ label, value, icon: Icon, iconColor }: {
  label: string
  value: string
  icon: React.ElementType
  iconColor: string
}) {
  return (
    <div className="p-3 rounded-xl bg-white shadow-sm border border-black/5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color: iconColor }} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">{label}</span>
      </div>
      <span className="text-sm font-bold text-black">{value}</span>
    </div>
  )
}
