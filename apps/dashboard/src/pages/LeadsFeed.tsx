import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Search, Filter, Zap, MapPin, Clock, DollarSign, Send } from 'lucide-react'
import ForwardLeadModal from '../components/ForwardLeadModal'
import UpsellModal from '../components/UpsellModal'
import { useSubscriptionAccess } from '../hooks/useSubscriptionAccess'

const PROF_CONFIG: Record<string, { emoji: string; label: { en: string; he: string }; cssClass: string }> = {
  hvac:             { emoji: '❄️', label: { en: 'HVAC', he: 'מזגנים' },               cssClass: 'lead-card--hvac' },
  air_duct:         { emoji: '💨', label: { en: 'Air Duct', he: 'תעלות אוויר' },      cssClass: 'lead-card--hvac' },
  chimney:          { emoji: '🏠', label: { en: 'Chimney', he: 'ארובות' },             cssClass: 'lead-card--hvac' },
  dryer_vent:       { emoji: '🌀', label: { en: 'Dryer Vent', he: 'פתח מייבש' },      cssClass: 'lead-card--hvac' },
  renovation:       { emoji: '🔨', label: { en: 'Renovation', he: 'שיפוצים' },        cssClass: 'lead-card--renovation' },
  fencing:          { emoji: '🏗️', label: { en: 'Fencing', he: 'גדרות' },             cssClass: 'lead-card--fencing' },
  cleaning:         { emoji: '🧹', label: { en: 'Cleaning', he: 'ניקיון' },           cssClass: 'lead-card--cleaning' },
  carpet_cleaning:  { emoji: '🧼', label: { en: 'Carpet Cleaning', he: 'ניקוי שטיחים' }, cssClass: 'lead-card--cleaning' },
  plumbing:         { emoji: '🔧', label: { en: 'Plumbing', he: 'אינסטלציה' },        cssClass: 'lead-card--hvac' },
  electrical:       { emoji: '⚡', label: { en: 'Electrical', he: 'חשמל' },            cssClass: 'lead-card--hvac' },
  painting:         { emoji: '🎨', label: { en: 'Painting', he: 'צביעה' },             cssClass: 'lead-card--renovation' },
  locksmith:        { emoji: '🔑', label: { en: 'Locksmith', he: 'מנעולן' },           cssClass: 'lead-card--hvac' },
  garage_door:      { emoji: '🚪', label: { en: 'Garage Door', he: 'דלת מוסך' },       cssClass: 'lead-card--hvac' },
  roofing:          { emoji: '🏗️', label: { en: 'Roofing', he: 'גגות' },              cssClass: 'lead-card--renovation' },
  landscaping:      { emoji: '🌿', label: { en: 'Landscaping', he: 'גינון' },          cssClass: 'lead-card--cleaning' },
  tiling:           { emoji: '🔲', label: { en: 'Tiling', he: 'ריצוף' },               cssClass: 'lead-card--renovation' },
  kitchen:          { emoji: '🍳', label: { en: 'Kitchen', he: 'מטבח' },               cssClass: 'lead-card--renovation' },
  bathroom:         { emoji: '🚿', label: { en: 'Bathroom', he: 'אמבטיה' },            cssClass: 'lead-card--renovation' },
  pool:             { emoji: '🏊', label: { en: 'Pool', he: 'בריכה' },                 cssClass: 'lead-card--cleaning' },
  moving:           { emoji: '📦', label: { en: 'Moving', he: 'הובלות' },              cssClass: 'lead-card--cleaning' },
  other:            { emoji: '📋', label: { en: 'Other', he: 'אחר' },                  cssClass: 'lead-card--cleaning' },
}

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
}

export default function LeadsFeed() {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProf, setFilterProf] = useState<string>('all')
  const [filterUrgency, setFilterUrgency] = useState<string>('all')
  const [search, setSearch] = useState('')
  
  const { canManageSubs } = useSubscriptionAccess()
  const [forwardLead, setForwardLead] = useState<Lead | null>(null)
  const [showUpsell, setShowUpsell] = useState(false)

  useEffect(() => {
    async function fetchLeads() {
      if (!user) return
      
      // Fetch leads that were sent to this contractor
      const { data, error } = await supabase
        .from('leads')
        .select('id, profession, parsed_summary, raw_message, city, zip_code, urgency, budget_range, sender_id, created_at, groups ( name )')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setLeads(data.map((row: any) => ({
          ...row,
          group_name: row.groups?.name ?? null,
        })))
      }
      setLoading(false)
    }
    fetchLeads()
  }, [user])

  const filtered = leads.filter((lead) => {
    if (filterProf !== 'all' && lead.profession !== filterProf) return false
    if (filterUrgency !== 'all' && lead.urgency !== filterUrgency) return false
    if (search) {
      const q = search.toLowerCase()
      const text = (lead.parsed_summary ?? lead.raw_message ?? '').toLowerCase()
      if (!text.includes(q) && !lead.city?.toLowerCase().includes(q) && !lead.zip_code?.includes(q)) return false
    }
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

  // budget_range is already a formatted string from the parser (e.g. "$99–$199")

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
                      {lead.parsed_summary ?? lead.raw_message?.slice(0, 120) ?? '—'}
                    </p>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'hsl(40 4% 42%)' }}>
                      {(lead.city || lead.zip_code) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[lead.city, lead.zip_code].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {lead.budget_range && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {lead.budget_range}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(lead.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => {
                        if (canManageSubs) {
                          setForwardLead(lead)
                        } else {
                          setShowUpsell(true)
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {locale === 'he' ? 'העבר' : 'Forward'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Forward Lead Modal */}
      <ForwardLeadModal
        lead={forwardLead}
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
