import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useAdminProspectsData, type ProspectRecord } from '../hooks/useAdminProspectsData'
import {
  Search,
  Loader2,
  Phone,
  MessageCircle,
  UserPlus,
  ArrowRight,
  Sparkles,
  CircleDot,
  CheckCircle2,
  XCircle,
  DollarSign,
  LayoutGrid,
  List,
  X,
  ChevronDown,
  Inbox,
} from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────────────── */
type Prospect = ProspectRecord

/* ── Pipeline stages config ─────────────────────────────────────────── */
const STAGES = [
  { key: 'prospect',        label: 'Prospect',        he: 'פרוספקט',     icon: CircleDot,     color: '#64748b', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.12)' },
  { key: 'reached_out',     label: 'Reached Out',     he: 'יצרנו קשר',   icon: Phone,         color: '#0284c7', bg: 'rgba(2,132,199,0.06)',   border: 'rgba(2,132,199,0.12)' },
  { key: 'in_conversation', label: 'In Conversation', he: 'בשיחה',       icon: MessageCircle, color: '#7c3aed', bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.12)' },
  { key: 'demo_trial',      label: 'Demo / Trial',    he: 'ניסיון',      icon: Sparkles,      color: '#d97706', bg: 'rgba(217,119,6,0.06)',   border: 'rgba(217,119,6,0.12)' },
  { key: 'paying',          label: 'Paying',          he: 'משלם',        icon: DollarSign,    color: '#059669', bg: 'rgba(5,150,105,0.06)',   border: 'rgba(5,150,105,0.12)' },
  { key: 'churned',         label: 'Churned',         he: 'נטש',         icon: XCircle,       color: '#dc2626', bg: 'rgba(220,38,38,0.06)',   border: 'rgba(220,38,38,0.12)' },
] as const

function getStage(key: string) {
  return STAGES.find(s => s.key === key) ?? STAGES[0]
}

function timeAgo(d: string | null, he: boolean) {
  if (!d) return he ? 'אין' : 'Never'
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return he ? 'עכשיו' : 'now'
  if (m < 60) return he ? `${m} דק׳` : `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return he ? `${h} שע׳` : `${h}h`
  return he ? `${Math.floor(h / 24)} ימים` : `${Math.floor(h / 24)}d`
}

/* ── Avatar color from wa_id ───────────────────────────────────────── */
function avatarHue(waId: string): number {
  return [...waId].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % 360
}

function avatarInitials(prospect: Prospect): string {
  if (prospect.display_name && prospect.display_name.trim().length >= 2) {
    return prospect.display_name.trim().slice(0, 2).toUpperCase()
  }
  if (prospect.phone && prospect.phone.length >= 2) {
    return prospect.phone.slice(-2)
  }
  return '??'
}

/* ── Followup status ───────────────────────────────────────────────── */
function getFollowupStatus(nextFollowupAt: string | null): 'overdue' | 'today' | null {
  if (!nextFollowupAt) return null
  const now = new Date()
  const followup = new Date(nextFollowupAt)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86400000)
  if (followup < todayStart) return 'overdue'
  if (followup >= todayStart && followup < todayEnd) return 'today'
  return null
}

/* ── Sort: overdue first, then today, then rest ────────────────────── */
function sortWithFollowups(prospects: Prospect[]): Prospect[] {
  return [...prospects].sort((a, b) => {
    const sa = getFollowupStatus(a.next_followup_at)
    const sb = getFollowupStatus(b.next_followup_at)
    const rank = (s: 'overdue' | 'today' | null) => s === 'overdue' ? 0 : s === 'today' ? 1 : 2
    return rank(sa) - rank(sb)
  })
}

/* ── Skeleton Card ─────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-xl p-4 animate-pulse" style={{ background: 'white', border: '1px solid hsl(220 8% 93%)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-3/4" />
          <div className="h-2.5 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-1.5 mb-2">
        <div className="h-4 bg-gray-100 rounded-full w-14" />
        <div className="h-4 bg-gray-100 rounded-full w-16" />
      </div>
      <div className="h-2.5 bg-gray-50 rounded w-2/3" />
    </div>
  )
}

function SkeletonColumn({ color }: { color: string }) {
  return (
    <div className="flex-shrink-0 flex flex-col rounded-2xl overflow-hidden" style={{ width: 300, background: 'hsl(40 20% 98%)', border: '1.5px solid hsl(220 8% 93%)' }}>
      <div style={{ height: 3, background: color }} />
      <div className="px-4 py-3.5 border-b" style={{ borderColor: 'hsl(220 8% 93%)' }}>
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
      </div>
      <div className="p-2.5 space-y-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

/* ── Component ──────────────────────────────────────────────────────── */
export default function AdminProspects() {
  const { locale } = useI18n()
  const he = locale === 'he'
  const nav = useNavigate()

  const [search, setSearch] = useState('')
  const [dragProspectId, setDragProspectId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [listStageDropdown, setListStageDropdown] = useState<string | null>(null)

  const {
    prospects,
    isLoading: loading,
    isFetching,
    changeStage: updateProspectStage,
    importFromGroups: runImportFromGroups,
    isImporting,
  } = useAdminProspectsData()

  /* ── Stage change ─────────────────────────────────────────────────── */
  async function changeStage(prospectId: string, newStage: string) {
    await updateProspectStage(prospectId, newStage)
  }

  /* ── Import group members ─────────────────────────────────────────── */
  async function importFromGroups() {
    await runImportFromGroups()
  }

  /* ── Drag & Drop handlers ─────────────────────────────────────────── */
  function handleDragStart(prospectId: string) {
    setDragProspectId(prospectId)
  }

  function handleDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault()
    setDragOverStage(stageKey)
  }

  function handleDragLeave() {
    setDragOverStage(null)
  }

  function handleDrop(stageKey: string) {
    if (dragProspectId) {
      changeStage(dragProspectId, stageKey)
    }
    setDragProspectId(null)
    setDragOverStage(null)
  }

  /* ── Filter ───────────────────────────────────────────────────────── */
  const filtered = prospects.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (p.display_name ?? '').toLowerCase().includes(s) ||
      p.phone.includes(s) ||
      p.profession_tags.some(t => t.toLowerCase().includes(s)) ||
      (p.group_names ?? []).some(g => g.toLowerCase().includes(s))
    )
  })

  const stageFiltered = stageFilter
    ? filtered.filter(p => p.stage === stageFilter)
    : filtered

  const CARD_LIMIT = 50

  const stageGroups = STAGES.map(stage => {
    const all = sortWithFollowups(stageFiltered.filter(p => p.stage === stage.key))
    const isExpanded = expandedStages.has(stage.key)
    return {
      ...stage,
      prospects: all,
      visible: isExpanded ? all : all.slice(0, CARD_LIMIT),
      hasMore: all.length > CARD_LIMIT && !isExpanded,
      hiddenCount: all.length - CARD_LIMIT,
    }
  })

  /* ── Stage counts for pipeline bar ───────────────────────────────── */
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of STAGES) counts[s.key] = 0
    for (const p of filtered) {
      if (counts[p.stage] !== undefined) counts[p.stage]++
    }
    return counts
  }, [filtered])

  const totalFiltered = stageFiltered.length

  /* ── Next stage helper ───────────────────────────────────────────── */
  function getNextStageKey(currentKey: string): string | null {
    const idx = STAGES.findIndex(s => s.key === currentKey)
    if (idx < 0 || idx >= STAGES.length - 1) return null
    return STAGES[idx + 1].key
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="animate-fade-in" style={{ margin: '0 -24px' }}>
        {/* Skeleton header */}
        <div className="flex items-center justify-between px-6 mb-6">
          <div>
            <div className="h-7 w-52 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        {/* Skeleton pipeline bar */}
        <div className="px-6 mb-5">
          <div className="h-11 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        {/* Skeleton columns */}
        <div className="flex gap-4 px-6 pb-6 overflow-x-auto">
          {STAGES.map(s => <SkeletonColumn key={s.key} color={s.color} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in" style={{ margin: '0 -24px' }}>
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between px-6 mb-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: '#1a1c20', fontFamily: 'Outfit, sans-serif' }}
          >
            {he ? 'פרוספקטים' : 'Prospects Pipeline'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#7c7f85' }}>
            {he ? `${prospects.length} טכנאים בצנרת` : `${prospects.length} technicians in pipeline`}
          </p>
          {isFetching && (
            <p className="text-xs mt-1" style={{ color: '#b0b3b8' }}>
              {he ? 'מתעדכן...' : 'Refreshing...'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div
            className="flex items-center rounded-xl overflow-hidden"
            style={{ border: '1.5px solid hsl(220 8% 90%)', background: 'white' }}
          >
            <button
              onClick={() => setViewMode('kanban')}
              className="flex items-center justify-center w-9 h-9 transition-all"
              style={{
                background: viewMode === 'kanban' ? 'hsl(155 44% 30%)' : 'transparent',
                color: viewMode === 'kanban' ? 'white' : '#7c7f85',
              }}
              title={he ? 'תצוגת לוח' : 'Board view'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="flex items-center justify-center w-9 h-9 transition-all"
              style={{
                background: viewMode === 'list' ? 'hsl(155 44% 30%)' : 'transparent',
                color: viewMode === 'list' ? 'white' : '#7c7f85',
              }}
              title={he ? 'תצוגת רשימה' : 'List view'}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4"
              style={{
                left: he ? 'auto' : 12,
                right: he ? 12 : 'auto',
                color: '#b0b3b8',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={he ? 'חיפוש...' : 'Search prospects...'}
              className="h-9 rounded-xl border text-sm outline-none transition-all focus:ring-2"
              style={{
                paddingInlineStart: 36,
                paddingInlineEnd: search ? 32 : 12,
                width: 280,
                borderColor: 'hsl(220 8% 90%)',
                background: 'white',
                fontFamily: 'Outfit, sans-serif',
                outline: '2px solid hsl(155 44% 30% / 0.2)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100"
                style={{
                  right: he ? 'auto' : 8,
                  left: he ? 8 : 'auto',
                  color: '#b0b3b8',
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Showing X of Y */}
          {search && (
            <span className="text-xs whitespace-nowrap" style={{ color: '#7c7f85' }}>
              {he
                ? `מציג ${totalFiltered} מתוך ${prospects.length}`
                : `Showing ${totalFiltered} of ${prospects.length}`}
            </span>
          )}

          {/* Import button */}
          <button
            onClick={importFromGroups}
            disabled={isImporting}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-white transition-all hover:shadow-md active:scale-[0.97]"
            style={{
              background: isImporting
                ? 'hsl(155 20% 60%)'
                : 'linear-gradient(135deg, hsl(155 44% 30%) 0%, hsl(155 50% 38%) 100%)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {he ? 'ייבא מקבוצות' : 'Import from Groups'}
          </button>
        </div>
      </div>

      {/* ═══ Pipeline Summary Bar ═══ */}
      <div className="px-6 mb-4">
        <div className="flex items-stretch rounded-xl overflow-hidden" style={{ height: 44, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {STAGES.map((stage, idx) => {
            const count = stageCounts[stage.key] || 0
            const total = filtered.length || 1
            const pct = Math.max((count / total) * 100, 6) // min 6% so empty stages visible
            const prevCount = idx > 0 ? (stageCounts[STAGES[idx - 1].key] || 0) : 0
            const conversionPct = prevCount > 0 ? Math.round((count / prevCount) * 100) : null

            return (
              <div key={stage.key} className="flex items-center" style={{ width: `${pct}%`, minWidth: 60 }}>
                {/* Arrow separator */}
                {idx > 0 && (
                  <div
                    className="flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                    style={{
                      width: 28,
                      height: '100%',
                      background: `linear-gradient(90deg, ${STAGES[idx - 1].color}, ${stage.color})`,
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  >
                    {conversionPct !== null ? `${conversionPct}%` : ''}
                  </div>
                )}
                {/* Segment */}
                <div
                  className="flex-1 flex items-center justify-center gap-1.5 h-full px-2 transition-all cursor-pointer hover:brightness-110"
                  style={{
                    background: stage.color,
                    borderRadius: idx === 0 ? (he ? '0 12px 12px 0' : '12px 0 0 12px') : idx === STAGES.length - 1 ? (he ? '12px 0 0 12px' : '0 12px 12px 0') : 0,
                  }}
                  onClick={() => setStageFilter(stageFilter === stage.key ? null : stage.key)}
                >
                  <span className="text-white font-bold text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {count}
                  </span>
                  <span className="text-white/80 text-[10px] font-medium truncate hidden sm:inline">
                    {he ? stage.he : stage.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ Stage Filter Chips ═══ */}
      <div className="flex items-center gap-2 px-6 mb-5 flex-wrap">
        <button
          onClick={() => setStageFilter(null)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
          style={{
            background: stageFilter === null ? 'hsl(155 44% 30%)' : 'transparent',
            color: stageFilter === null ? 'white' : 'hsl(155 44% 30%)',
            border: `1.5px solid ${stageFilter === null ? 'hsl(155 44% 30%)' : 'hsl(155 44% 30% / 0.3)'}`,
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          {he ? 'הכל' : 'All'} ({filtered.length})
        </button>
        {STAGES.map(stage => {
          const count = stageCounts[stage.key] || 0
          const isActive = stageFilter === stage.key
          return (
            <button
              key={stage.key}
              onClick={() => setStageFilter(isActive ? null : stage.key)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
              style={{
                background: isActive ? stage.color : 'transparent',
                color: isActive ? 'white' : stage.color,
                border: `1.5px solid ${isActive ? stage.color : stage.color + '44'}`,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {he ? stage.he : stage.label}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* ═══ Kanban View ═══ */}
      {viewMode === 'kanban' && (
        <div
          className="flex gap-4 px-6 pb-6 overflow-x-auto"
          style={{ minHeight: 'calc(100vh - 280px)' }}
        >
          {stageGroups
            .filter(sg => !stageFilter || sg.key === stageFilter)
            .map(stage => {
              const StageIcon = stage.icon
              const isOver = dragOverStage === stage.key
              return (
                <div
                  key={stage.key}
                  className="flex-shrink-0 flex flex-col rounded-2xl transition-all duration-200 overflow-hidden"
                  style={{
                    width: 300,
                    background: isOver
                      ? `linear-gradient(180deg, ${stage.bg} 0%, hsl(40 20% 98%) 100%)`
                      : `linear-gradient(180deg, ${stage.bg} 0%, hsl(40 20% 99%) 60%, hsl(40 20% 98%) 100%)`,
                    border: `1.5px ${isOver ? 'dashed' : 'solid'} ${isOver ? stage.color : 'hsl(220 8% 91%)'}`,
                    boxShadow: isOver
                      ? `0 0 24px ${stage.bg}, inset 0 2px 8px rgba(0,0,0,0.03)`
                      : 'inset 0 2px 8px rgba(0,0,0,0.03)',
                  }}
                  onDragOver={e => handleDragOver(e, stage.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(stage.key)}
                >
                  {/* 3px color bar */}
                  <div style={{ height: 3, background: stage.color, flexShrink: 0 }} />

                  {/* Column header — sticky */}
                  <div
                    className="flex items-center gap-2.5 px-4 py-3.5 border-b sticky top-0 z-10"
                    style={{
                      borderColor: 'hsl(220 8% 91%)',
                      background: 'hsl(40 20% 98% / 0.95)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: stage.bg }}
                    >
                      <StageIcon className="w-3.5 h-3.5" style={{ color: stage.color }} />
                    </div>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: '#1a1c20', fontFamily: 'Outfit, sans-serif' }}
                    >
                      {he ? stage.he : stage.label}
                    </span>
                    <span
                      className="text-xs font-bold rounded-full px-2.5 py-0.5"
                      style={{
                        marginInlineStart: 'auto',
                        background: stage.bg,
                        color: stage.color,
                      }}
                    >
                      {stage.prospects.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div
                    className="flex-1 p-2.5 space-y-2.5 overflow-y-auto"
                    style={{ maxHeight: 'calc(100vh - 360px)' }}
                  >
                    {stage.prospects.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-xs" style={{ color: '#b0b3b8' }}>
                        <Inbox className="w-8 h-8 mb-2" style={{ color: '#d5d7db' }} />
                        <span style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {he ? 'גרור פרוספקטים לכאן' : 'Drop prospects here'}
                        </span>
                      </div>
                    )}
                    {stage.visible.map(prospect => {
                      const hue = avatarHue(prospect.wa_id)
                      const followupStatus = getFollowupStatus(prospect.next_followup_at)
                      const nextStage = getNextStageKey(prospect.stage)
                      const groups = prospect.group_names ?? []

                      return (
                        <div
                          key={prospect.id}
                          draggable
                          onDragStart={() => handleDragStart(prospect.id)}
                          onClick={() => nav(`/admin/prospects/${prospect.id}`)}
                          className="group relative rounded-xl p-4 cursor-pointer transition-all duration-200 active:scale-[0.98]"
                          style={{
                            background: 'white',
                            borderInlineStart: `3px solid ${stage.color}`,
                            borderTop: '1px solid hsl(220 8% 93%)',
                            borderBottom: '1px solid hsl(220 8% 93%)',
                            borderInlineEnd: '1px solid hsl(220 8% 93%)',
                            opacity: dragProspectId === prospect.id ? 0.4 : 1,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          }}
                          onMouseEnter={(e) => {
                            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
                          }}
                          onMouseLeave={(e) => {
                            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
                          }}
                        >
                          {/* Followup badge */}
                          {followupStatus && (
                            <span
                              className="absolute top-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{
                                insetInlineEnd: 8,
                                background: followupStatus === 'overdue' ? '#fef2f2' : '#fffbeb',
                                color: followupStatus === 'overdue' ? '#dc2626' : '#d97706',
                                border: `1px solid ${followupStatus === 'overdue' ? '#fecaca' : '#fde68a'}`,
                              }}
                            >
                              {followupStatus === 'overdue'
                                ? (he ? 'באיחור' : 'Overdue')
                                : (he ? 'היום' : 'Today')}
                            </span>
                          )}

                          {/* Top row: avatar + name + phone + time */}
                          <div className="flex items-center gap-3 mb-2">
                            {prospect.profile_pic_url ? (
                              <img
                                src={prospect.profile_pic_url}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                style={{ border: `2px solid ${stage.border}` }}
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, hsl(${hue} 55% 50%), hsl(${hue + 20} 55% 55%))`,
                                }}
                              >
                                {avatarInitials(prospect)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div
                                className="text-sm font-semibold truncate"
                                style={{ color: '#1a1c20', fontFamily: 'Outfit, sans-serif' }}
                              >
                                {prospect.display_name ?? prospect.phone}
                              </div>
                              <div className="text-xs truncate flex items-center gap-1.5" style={{ color: '#b0b3b8' }}>
                                <span>{prospect.phone}</span>
                                <span style={{ color: '#d5d7db' }}>·</span>
                                <span>{timeAgo(prospect.last_contact_at, he)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Tags: profession + groups */}
                          {(prospect.profession_tags.length > 0 || groups.length > 0) && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {prospect.profession_tags.map(tag => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium flex items-center gap-1"
                                  style={{ color: 'hsl(155 44% 30%)' }}
                                >
                                  <span
                                    className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ background: 'hsl(155 44% 40%)' }}
                                  />
                                  {tag}
                                </span>
                              ))}
                              {groups.slice(0, 1).map(g => (
                                <span
                                  key={g}
                                  className="text-[10px] px-2 py-0.5 rounded-full"
                                  style={{ background: 'hsl(220 10% 95%)', color: '#7c7f85' }}
                                >
                                  {g.length > 18 ? g.slice(0, 18) + '…' : g}
                                </span>
                              ))}
                              {groups.length > 1 && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                  style={{ background: 'hsl(220 10% 93%)', color: '#7c7f85' }}
                                >
                                  +{groups.length - 1}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Quick actions bar on hover */}
                          <div
                            className="flex items-center justify-center gap-2 mt-2 pt-2 opacity-0 group-hover:opacity-100 transition-all duration-200"
                            style={{
                              borderTop: '1px solid hsl(220 8% 94%)',
                              marginInlineStart: -4,
                              marginInlineEnd: -4,
                              paddingInlineStart: 4,
                              paddingInlineEnd: 4,
                            }}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); nav(`/admin/prospects/${prospect.id}`) }}
                              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                              style={{
                                background: 'hsl(155 40% 94%)',
                                color: 'hsl(155 44% 30%)',
                              }}
                              title={he ? 'הודעה' : 'Message'}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(`tel:${prospect.phone}`) }}
                              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                              style={{
                                background: 'hsl(210 90% 95%)',
                                color: '#0284c7',
                              }}
                              title={he ? 'התקשר' : 'Call'}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                            {nextStage && (
                              <button
                                onClick={(e) => { e.stopPropagation(); changeStage(prospect.id, nextStage) }}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                                style={{
                                  background: `${getStage(nextStage).color}14`,
                                  color: getStage(nextStage).color,
                                }}
                                title={he ? 'קדם שלב' : 'Advance stage'}
                              >
                                <ArrowRight className="w-3.5 h-3.5" style={{ transform: he ? 'scaleX(-1)' : undefined }} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {stage.hasMore && (
                      <button
                        onClick={() => setExpandedStages(prev => new Set([...prev, stage.key]))}
                        className="w-full py-2.5 text-xs font-semibold rounded-lg transition-colors hover:bg-white/60"
                        style={{ color: stage.color, fontFamily: 'Outfit, sans-serif' }}
                      >
                        {he ? `הצג עוד ${stage.hiddenCount}` : `Show ${stage.hiddenCount} more`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* ═══ List View ═══ */}
      {viewMode === 'list' && (
        <div className="px-6 pb-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              border: '1.5px solid hsl(220 8% 91%)',
              background: 'white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* Table Header */}
            <div
              className="grid items-center text-[11px] font-semibold uppercase tracking-wider px-4 py-3"
              style={{
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr',
                color: '#7c7f85',
                background: 'hsl(40 20% 98%)',
                borderBottom: '1.5px solid hsl(220 8% 91%)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              <span>{he ? 'שם' : 'Name'}</span>
              <span>{he ? 'טלפון' : 'Phone'}</span>
              <span>{he ? 'שלב' : 'Stage'}</span>
              <span>{he ? 'תגיות' : 'Tags'}</span>
              <span>{he ? 'קבוצות' : 'Groups'}</span>
              <span>{he ? 'קשר אחרון' : 'Last Contact'}</span>
              <span>{he ? 'מעקב הבא' : 'Next Followup'}</span>
            </div>

            {/* Table Rows */}
            <div style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
              {stageFiltered.length === 0 && (
                <div className="flex items-center justify-center py-16 text-sm" style={{ color: '#b0b3b8' }}>
                  {he ? 'אין פרוספקטים' : 'No prospects found'}
                </div>
              )}
              {sortWithFollowups(stageFiltered).map((prospect, rowIdx) => {
                const stage = getStage(prospect.stage)
                const hue = avatarHue(prospect.wa_id)
                const followupStatus = getFollowupStatus(prospect.next_followup_at)
                const groups = prospect.group_names ?? []

                return (
                  <div
                    key={prospect.id}
                    className="grid items-center px-4 py-3 transition-all cursor-pointer hover:bg-gray-50/70"
                    style={{
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr',
                      background: rowIdx % 2 === 1 ? 'hsl(40 20% 99%)' : 'white',
                      borderBottom: '1px solid hsl(220 8% 95%)',
                    }}
                    onClick={() => nav(`/admin/prospects/${prospect.id}`)}
                  >
                    {/* Name + Avatar */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {prospect.profile_pic_url ? (
                        <img
                          src={prospect.profile_pic_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, hsl(${hue} 55% 50%), hsl(${hue + 20} 55% 55%))`,
                          }}
                        >
                          {avatarInitials(prospect)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#1a1c20', fontFamily: 'Outfit, sans-serif' }}>
                          {prospect.display_name ?? prospect.phone}
                        </div>
                      </div>
                      {followupStatus && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{
                            background: followupStatus === 'overdue' ? '#fef2f2' : '#fffbeb',
                            color: followupStatus === 'overdue' ? '#dc2626' : '#d97706',
                          }}
                        >
                          {followupStatus === 'overdue' ? (he ? 'באיחור' : 'Overdue') : (he ? 'היום' : 'Today')}
                        </span>
                      )}
                    </div>

                    {/* Phone */}
                    <span className="text-xs truncate" style={{ color: '#7c7f85' }}>
                      {prospect.phone}
                    </span>

                    {/* Stage pill / dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setListStageDropdown(listStageDropdown === prospect.id ? null : prospect.id)
                        }}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-all hover:brightness-95"
                        style={{
                          background: stage.bg,
                          color: stage.color,
                          border: `1px solid ${stage.border}`,
                        }}
                      >
                        {he ? stage.he : stage.label}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {listStageDropdown === prospect.id && (
                        <>
                          {/* Backdrop to close dropdown */}
                          <div
                            className="fixed inset-0 z-30"
                            onClick={(e) => { e.stopPropagation(); setListStageDropdown(null) }}
                          />
                          <div
                            className="absolute z-40 mt-1 rounded-xl py-1 shadow-xl"
                            style={{
                              background: 'white',
                              border: '1.5px solid hsl(220 8% 91%)',
                              minWidth: 160,
                              insetInlineStart: 0,
                            }}
                          >
                            {STAGES.map(s => (
                              <button
                                key={s.key}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  changeStage(prospect.id, s.key)
                                  setListStageDropdown(null)
                                }}
                                className="w-full text-start px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors hover:bg-gray-50"
                                style={{
                                  color: s.key === prospect.stage ? s.color : '#4a4d52',
                                  fontWeight: s.key === prospect.stage ? 700 : 500,
                                }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ background: s.color }}
                                />
                                {he ? s.he : s.label}
                                {s.key === prospect.stage && (
                                  <CheckCircle2 className="w-3 h-3" style={{ marginInlineStart: 'auto', color: s.color }} />
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {prospect.profession_tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] font-medium flex items-center gap-1 truncate"
                          style={{ color: 'hsl(155 44% 30%)' }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'hsl(155 44% 40%)' }} />
                          {tag}
                        </span>
                      ))}
                      {prospect.profession_tags.length > 2 && (
                        <span className="text-[10px]" style={{ color: '#b0b3b8' }}>
                          +{prospect.profession_tags.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Groups */}
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {groups.slice(0, 1).map(g => (
                        <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full truncate" style={{ background: 'hsl(220 10% 95%)', color: '#7c7f85', maxWidth: 100 }}>
                          {g.length > 14 ? g.slice(0, 14) + '…' : g}
                        </span>
                      ))}
                      {groups.length > 1 && (
                        <span className="text-[10px] font-semibold" style={{ color: '#b0b3b8' }}>+{groups.length - 1}</span>
                      )}
                    </div>

                    {/* Last Contact */}
                    <span className="text-xs" style={{ color: '#7c7f85' }}>
                      {timeAgo(prospect.last_contact_at, he)}
                    </span>

                    {/* Next Followup */}
                    <span
                      className="text-xs"
                      style={{
                        color: followupStatus === 'overdue' ? '#dc2626' : followupStatus === 'today' ? '#d97706' : '#7c7f85',
                        fontWeight: followupStatus ? 600 : 400,
                      }}
                    >
                      {prospect.next_followup_at
                        ? new Date(prospect.next_followup_at).toLocaleDateString(he ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
                        : (he ? '—' : '—')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
