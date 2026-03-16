import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Search, Filter, Zap, MapPin, Clock, DollarSign } from 'lucide-react'

const PROF_CONFIG: Record<string, { emoji: string; label: { en: string; he: string }; cssClass: string }> = {
  hvac:       { emoji: '❄️', label: { en: 'HVAC', he: 'מזגנים' },          cssClass: 'lead-card--hvac' },
  renovation: { emoji: '🔨', label: { en: 'Renovation', he: 'שיפוצים' },   cssClass: 'lead-card--renovation' },
  fencing:    { emoji: '🧱', label: { en: 'Fencing', he: 'גדרות' },        cssClass: 'lead-card--fencing' },
  cleaning:   { emoji: '✨', label: { en: 'Garage Cleaning', he: 'ניקוי גראז׳' }, cssClass: 'lead-card--cleaning' },
}

interface Lead {
  id: string
  profession: string
  summary: string
  city: string | null
  zip_code: string
  urgency: 'hot' | 'warm' | 'cold'
  budget_min: number | null
  budget_max: number | null
  source_name: string | null
  created_at: string
}

export default function LeadsFeed() {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProf, setFilterProf] = useState<string>('all')
  const [filterUrgency, setFilterUrgency] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchLeads() {
      if (!user) return
      // Fetch leads that were sent to this contractor
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setLeads(data as Lead[])
      }
      setLoading(false)
    }
    fetchLeads()
  }, [user])

  const filtered = leads.filter((lead) => {
    if (filterProf !== 'all' && lead.profession !== filterProf) return false
    if (filterUrgency !== 'all' && lead.urgency !== filterUrgency) return false
    if (search && !lead.summary.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  function formatBudget(min: number | null, max: number | null): string | null {
    if (min && max) return `$${min.toLocaleString()}-${max.toLocaleString()}`
    if (min) return `$${min.toLocaleString()}+`
    if (max) return `up to $${max.toLocaleString()}`
    return null
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'hsl(40 8% 10%)' }}>
            {t('nav.leads')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(40 4% 42%)' }}>
            {filtered.length} {locale === 'he' ? 'לידים' : 'leads'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4" style={{ color: 'hsl(40 4% 42%)' }} />
          <input
            type="text"
            placeholder={locale === 'he' ? 'חיפוש לידים...' : 'Search leads...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm outline-none"
            style={{ color: 'hsl(40 8% 10%)' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: 'hsl(40 4% 42%)' }} />
          <select
            value={filterProf}
            onChange={(e) => setFilterProf(e.target.value)}
            className="text-xs rounded-lg border px-2 py-1.5 bg-white"
            style={{ borderColor: 'hsl(35 15% 88%)' }}
          >
            <option value="all">{locale === 'he' ? 'כל המקצועות' : 'All Professions'}</option>
            {Object.entries(PROF_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.emoji} {cfg.label[locale]}
              </option>
            ))}
          </select>

          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            className="text-xs rounded-lg border px-2 py-1.5 bg-white"
            style={{ borderColor: 'hsl(35 15% 88%)' }}
          >
            <option value="all">{locale === 'he' ? 'כל הדחיפויות' : 'All Urgencies'}</option>
            <option value="hot">{t('lead.hot')}</option>
            <option value="warm">{t('lead.warm')}</option>
            <option value="cold">{t('lead.cold')}</option>
          </select>
        </div>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel p-5 animate-pulse">
              <div className="h-4 bg-black/[0.04] rounded w-1/3 mb-3" />
              <div className="h-3 bg-black/[0.04] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Zap className="w-10 h-10 mx-auto mb-3" style={{ color: 'hsl(40 4% 42%)' }} />
          <p className="text-sm" style={{ color: 'hsl(40 4% 42%)' }}>
            {t('dash.no_leads')}
          </p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map((lead) => {
            const prof = PROF_CONFIG[lead.profession] ?? PROF_CONFIG.cleaning
            const budget = formatBudget(lead.budget_min, lead.budget_max)
            const urgencyClass = `urgency-${lead.urgency}`
            const urgencyLabel = t(`lead.${lead.urgency}` as 'lead.hot' | 'lead.warm' | 'lead.cold')

            return (
              <div key={lead.id} className={`lead-card ${prof.cssClass} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Profession + Urgency */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium" style={{ color: 'hsl(40 8% 10%)' }}>
                        {prof.emoji} {prof.label[locale]}
                      </span>
                      <span className={`badge ${urgencyClass}`}>{urgencyLabel}</span>
                    </div>

                    {/* Summary */}
                    <p className="text-sm leading-relaxed mb-3" style={{ color: 'hsl(40 8% 10%)' }}>
                      {lead.summary}
                    </p>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
                      {(lead.city || lead.zip_code) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[lead.city, lead.zip_code].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {budget && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {budget}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(lead.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
