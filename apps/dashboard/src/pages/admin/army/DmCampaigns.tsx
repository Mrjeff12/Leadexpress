import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useI18n } from '../../../lib/i18n'
import {
  Plus, Play, Pause, Loader2, Send, Users,
  MessageCircle, UserPlus, BarChart3, Trash2,
  CheckCircle2, XCircle, Clock, Zap, Filter,
} from 'lucide-react'

/* ── Types ── */
interface Campaign {
  id: string
  name: string
  template_id: string | null
  profession_filter: string[] | null
  country_filter: string | null
  daily_limit: number
  follow_up_hours: number | null
  max_follow_ups: number
  register_url: string
  utm_source: string | null
  utm_campaign: string | null
  status: 'draft' | 'active' | 'paused' | 'completed'
  total_sent: number
  total_replied: number
  total_registered: number
  created_at: string
}

interface Template {
  id: string
  name: string
  body: string
  category: string
}

interface CampaignStats {
  queued: number
  sent: number
  replied: number
  interested: number
  registered: number
  failed: number
  blocked: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-stone-600', bg: 'bg-stone-100' },
  active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100' },
  paused: { label: 'Paused', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: 'Completed', color: 'text-blue-700', bg: 'bg-blue-100' },
}

export default function DmCampaigns() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newTemplateId, setNewTemplateId] = useState('')
  const [newProfessions, setNewProfessions] = useState('')
  const [newDailyLimit, setNewDailyLimit] = useState(30)
  const [newFollowUpHours, setNewFollowUpHours] = useState(48)

  const fetchCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from('dm_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    setCampaigns(data ?? [])
    setLoading(false)
  }, [])

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('army_templates')
      .select('id, name, body, category')
      .eq('is_active', true)
      .order('name')
    setTemplates(data ?? [])
  }, [])

  useEffect(() => {
    fetchCampaigns()
    fetchTemplates()
  }, [fetchCampaigns, fetchTemplates])

  // Fetch stats for selected campaign
  useEffect(() => {
    if (!selected) { setStats(null); return }
    ;(async () => {
      const { data } = await supabase
        .from('dm_outreach')
        .select('status')
        .eq('campaign_id', selected.id)
      if (!data) return
      const s: CampaignStats = { queued: 0, sent: 0, replied: 0, interested: 0, registered: 0, failed: 0, blocked: 0 }
      for (const r of data) {
        if (r.status in s) (s as any)[r.status]++
        if (r.status === 'not_interested') s.replied++
      }
      setStats(s)
    })()
  }, [selected])

  async function createCampaign() {
    if (!newName.trim() || !newTemplateId) return
    setActionLoading(true)
    const profFilter = newProfessions.trim()
      ? newProfessions.split(',').map(p => p.trim()).filter(Boolean)
      : null

    const { error } = await supabase.from('dm_campaigns').insert({
      name: newName.trim(),
      template_id: newTemplateId,
      profession_filter: profFilter,
      daily_limit: newDailyLimit,
      follow_up_hours: newFollowUpHours || null,
      utm_campaign: newName.trim().toLowerCase().replace(/\s+/g, '-'),
    })
    if (!error) {
      setShowCreate(false)
      setNewName('')
      setNewTemplateId('')
      setNewProfessions('')
      await fetchCampaigns()
    }
    setActionLoading(false)
  }

  async function toggleStatus(campaign: Campaign) {
    setActionLoading(true)
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'

    // If activating, queue prospects first
    if (newStatus === 'active' && campaign.status === 'draft') {
      await supabase.from('dm_campaigns').update({ status: 'active' }).eq('id', campaign.id)
      const { data: count } = await supabase.rpc('queue_dm_campaign', { p_campaign_id: campaign.id })
      alert(he ? `${count} פרוספקטים נוספו לתור` : `${count} prospects queued`)
    } else {
      await supabase.from('dm_campaigns').update({ status: newStatus }).eq('id', campaign.id)
    }

    await fetchCampaigns()
    if (selected?.id === campaign.id) {
      setSelected({ ...campaign, status: newStatus })
    }
    setActionLoading(false)
  }

  async function deleteCampaign(id: string) {
    if (!confirm(he ? 'למחוק קמפיין?' : 'Delete campaign?')) return
    await supabase.from('dm_campaigns').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    await fetchCampaigns()
  }

  async function triggerSend(campaignId: string) {
    setActionLoading(true)
    const { error } = await supabase.functions.invoke('send-dm', {
      body: { campaign_id: campaignId, limit: 10 },
    })
    if (error) {
      console.error('Send error:', error)
      alert(he ? 'שגיאה בשליחה' : 'Send error')
    } else {
      alert(he ? 'נשלח!' : 'Batch sent!')
      await fetchCampaigns()
    }
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-stone-400" size={24} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 sm:p-6" dir={he ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">
            {he ? 'קמפיינים DM' : 'DM Campaigns'}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {he ? 'שליחת הודעות אישיות לפרוספקטים מהקבוצות' : 'Send personalized DMs to group prospects'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors"
        >
          <Plus size={16} />
          {he ? 'קמפיין חדש' : 'New Campaign'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign list */}
        <div className="lg:col-span-1 space-y-3">
          {campaigns.length === 0 && (
            <div className="text-center py-12 text-stone-400 text-sm">
              {he ? 'אין קמפיינים עדיין' : 'No campaigns yet'}
            </div>
          )}
          {campaigns.map(c => {
            const meta = STATUS_META[c.status]
            const isSelected = selected?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-red-200 bg-red-50/50 shadow-sm'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-stone-900 text-sm truncate">{c.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Send size={11} /> {c.total_sent}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={11} /> {c.total_replied}
                  </span>
                  <span className="flex items-center gap-1">
                    <UserPlus size={11} /> {c.total_registered}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Campaign detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex items-center justify-center h-64 text-stone-400 text-sm">
              {he ? 'בחר קמפיין מהרשימה' : 'Select a campaign from the list'}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-6">
              {/* Campaign header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">{selected.name}</h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {he ? `מגבלה יומית: ${selected.daily_limit} לכל slave` : `Daily limit: ${selected.daily_limit} per slave`}
                    {selected.follow_up_hours && (
                      <> · {he ? `Follow-up: ${selected.follow_up_hours}h` : `Follow-up: ${selected.follow_up_hours}h`}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(selected)}
                    disabled={actionLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selected.status === 'active'
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {selected.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    {selected.status === 'active' ? (he ? 'השהה' : 'Pause') : (he ? 'הפעל' : 'Activate')}
                  </button>
                  {selected.status === 'active' && (
                    <button
                      onClick={() => triggerSend(selected.id)}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                    >
                      <Zap size={14} />
                      {he ? 'שלח עכשיו' : 'Send Now'}
                    </button>
                  )}
                  <button
                    onClick={() => deleteCampaign(selected.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              {stats && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {[
                    { label: he ? 'בתור' : 'Queued', value: stats.queued, icon: Clock, color: 'text-stone-600' },
                    { label: he ? 'נשלח' : 'Sent', value: stats.sent, icon: Send, color: 'text-blue-600' },
                    { label: he ? 'ענה' : 'Replied', value: stats.replied, icon: MessageCircle, color: 'text-green-600' },
                    { label: he ? 'מעוניין' : 'Interested', value: stats.interested, icon: CheckCircle2, color: 'text-emerald-600' },
                    { label: he ? 'נרשם' : 'Registered', value: stats.registered, icon: UserPlus, color: 'text-red-600' },
                    { label: he ? 'נכשל' : 'Failed', value: stats.failed + stats.blocked, icon: XCircle, color: 'text-stone-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-stone-50 rounded-xl p-3 text-center">
                      <s.icon size={16} className={`mx-auto mb-1 ${s.color}`} />
                      <p className="text-lg font-bold text-stone-900">{s.value}</p>
                      <p className="text-[10px] text-stone-500 uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Conversion funnel */}
              {stats && stats.sent > 0 && (
                <div className="bg-stone-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-stone-400 uppercase mb-3">
                    {he ? 'משפך המרה' : 'Conversion Funnel'}
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: he ? 'שיעור תגובה' : 'Reply Rate', value: Math.round((stats.replied / stats.sent) * 100) },
                      { label: he ? 'שיעור הרשמה' : 'Register Rate', value: Math.round((stats.registered / Math.max(stats.sent, 1)) * 100) },
                    ].map(f => (
                      <div key={f.label} className="flex items-center gap-3">
                        <span className="text-xs text-stone-500 w-28">{f.label}</span>
                        <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all"
                            style={{ width: `${Math.min(f.value, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-stone-700 w-10 text-right">{f.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters */}
              {selected.profession_filter && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter size={14} className="text-stone-400" />
                  {selected.profession_filter.map(p => (
                    <span key={p} className="px-2 py-0.5 text-xs bg-stone-100 text-stone-600 rounded-full">{p}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" dir={he ? 'rtl' : 'ltr'}>
            <h2 className="text-lg font-bold text-stone-900">
              {he ? 'קמפיין DM חדש' : 'New DM Campaign'}
            </h2>

            <div>
              <label className="text-xs font-medium text-stone-500 mb-1 block">{he ? 'שם' : 'Name'}</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none"
                placeholder={he ? 'למשל: HVAC פלורידה' : 'e.g. HVAC Florida Outreach'}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-500 mb-1 block">{he ? 'תבנית הודעה' : 'Message Template'}</label>
              <select
                value={newTemplateId}
                onChange={e => setNewTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm focus:border-red-400 outline-none"
              >
                <option value="">{he ? 'בחר תבנית...' : 'Select template...'}</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {newTemplateId && (
                <div className="mt-2 p-3 bg-stone-50 rounded-xl text-xs text-stone-600 whitespace-pre-wrap">
                  {templates.find(t => t.id === newTemplateId)?.body}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-stone-500 mb-1 block">
                {he ? 'פילטר מקצועות (מופרד בפסיקים)' : 'Profession Filter (comma-separated)'}
              </label>
              <input
                value={newProfessions}
                onChange={e => setNewProfessions(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm outline-none"
                placeholder="hvac, plumbing, electrical"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-stone-500 mb-1 block">
                  {he ? 'מגבלה יומית / slave' : 'Daily Limit / slave'}
                </label>
                <input
                  type="number"
                  value={newDailyLimit}
                  onChange={e => setNewDailyLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 mb-1 block">
                  {he ? 'Follow-up (שעות)' : 'Follow-up (hours)'}
                </label>
                <input
                  type="number"
                  value={newFollowUpHours}
                  onChange={e => setNewFollowUpHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50"
              >
                {he ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={createCampaign}
                disabled={!newName.trim() || !newTemplateId || actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : (he ? 'צור קמפיין' : 'Create Campaign')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
