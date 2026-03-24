import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  Megaphone, Loader2, RefreshCw, AlertCircle, Plus, Send,
  Calendar, Users, Eye, Filter, Clock, CheckCircle, XCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react'

interface MessageTemplate {
  id: string
  slug: string
  stage: string
  category: string
  touch_number: number
  body_template: string
}

interface Campaign {
  id: string
  name: string
  stage_filter: string
  sub_status_filter: string
  template_slug: string
  status: string
  sent_count: number
  delivered_count: number
  read_count: number
  created_at: string
  scheduled_at: string | null
}

const SUB_STATUS_OPTIONS = [
  { value: 'hot', label: 'Hot', color: '#FF3B30' },
  { value: 'warm', label: 'Warm', color: '#FF9500' },
  { value: 'cold', label: 'Cold', color: '#007AFF' },
]

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  // New campaign form
  const [campaignName, setCampaignName] = useState('')
  const [stageFilter, setStageFilter] = useState('prospect')
  const [subStatusFilter, setSubStatusFilter] = useState('hot')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [previewExpanded, setPreviewExpanded] = useState(false)

  async function fetchData() {
    setError(null)
    const [{ data: tpls }, { data: camps }] = await Promise.all([
      supabase
        .from('message_templates')
        .select('id, slug, stage, category, touch_number, body_template')
        .eq('category', 'first_touch')
        .eq('is_active', true)
        .order('touch_number'),
      supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (tpls) setTemplates(tpls as MessageTemplate[])
    if (camps) setCampaigns(camps as Campaign[])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function fetchMatchCount() {
    setMatchLoading(true)
    const { count, error: err } = await supabase
      .from('prospects')
      .select('id', { count: 'exact', head: true })
      .eq('stage', stageFilter)
      .eq('sub_status', subStatusFilter)
    if (err) {
      setError(`Count failed: ${err.message}`)
    } else {
      setMatchCount(count)
    }
    setMatchLoading(false)
  }

  useEffect(() => {
    if (showNew) fetchMatchCount()
  }, [stageFilter, subStatusFilter, showNew])

  async function handleSendNow() {
    if (!selectedTemplate || !campaignName) {
      setError('Please fill in campaign name and select a template')
      return
    }
    setSending(true)
    // Create campaign record
    const { data: camp, error: createErr } = await supabase
      .from('campaigns')
      .insert({
        name: campaignName,
        stage_filter: stageFilter,
        sub_status_filter: subStatusFilter,
        template_slug: selectedTemplate,
        status: 'sending',
      })
      .select()
      .single()

    if (createErr) {
      setError(`Failed to create campaign: ${createErr.message}`)
      setSending(false)
      return
    }

    // Call edge function to process
    const { error: fnErr } = await supabase.functions.invoke('process-nudges', {
      body: {
        campaign_id: camp.id,
        stage: stageFilter,
        sub_status: subStatusFilter,
        template_slug: selectedTemplate,
      },
    })

    if (fnErr) {
      setError(`Send failed: ${fnErr.message}`)
    } else {
      setShowNew(false)
      setCampaignName('')
      setSelectedTemplate('')
      fetchData()
    }
    setSending(false)
  }

  async function handleSchedule() {
    if (!selectedTemplate || !campaignName) {
      setError('Please fill in campaign name and select a template')
      return
    }
    setSending(true)
    const { error: createErr } = await supabase
      .from('campaigns')
      .insert({
        name: campaignName,
        stage_filter: stageFilter,
        sub_status_filter: subStatusFilter,
        template_slug: selectedTemplate,
        status: 'scheduled',
        scheduled_at: new Date(Date.now() + 3600000).toISOString(),
      })

    if (createErr) {
      setError(`Failed to schedule: ${createErr.message}`)
    } else {
      setShowNew(false)
      setCampaignName('')
      setSelectedTemplate('')
      fetchData()
    }
    setSending(false)
  }

  const selectedTpl = templates.find(t => t.slug === selectedTemplate)

  function statusBadge(status: string) {
    const map: Record<string, { color: string; icon: typeof CheckCircle }> = {
      sent: { color: '#34C759', icon: CheckCircle },
      sending: { color: '#FF9500', icon: Loader2 },
      scheduled: { color: '#007AFF', icon: Calendar },
      failed: { color: '#FF3B30', icon: XCircle },
      draft: { color: '#8E8E93', icon: Clock },
    }
    const def = map[status] || map.draft
    const Icon = def.icon
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
        style={{ background: `${def.color}15`, color: def.color }}
      >
        <Icon className={`w-2.5 h-2.5 ${status === 'sending' ? 'animate-spin' : ''}`} />
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#5856D6]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#5856D6]" />
          <h3 className="text-sm font-bold text-[#0b0707]/80">Campaigns</h3>
          <span className="text-[9px] text-[#3b3b3b]/40 bg-[#f5f2ed] px-2 py-0.5 rounded-full">
            {campaigns.length} campaigns
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5856D6] text-white text-[10px] font-semibold
              rounded-lg hover:bg-[#4a48c4] transition-colors"
          >
            <Plus className="w-3 h-3" />
            New Campaign
          </button>
          <button
            onClick={() => { setLoading(true); fetchData() }}
            className="flex items-center gap-1 text-[10px] text-[#3b3b3b]/50 hover:text-[#3b3b3b]/80 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-600">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <XCircle className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* New Campaign Form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-[#5856D6]/20 shadow-sm p-5 space-y-4">
          <h4 className="text-xs font-bold text-[#0b0707]/70 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-[#5856D6]" />
            Create New Campaign
          </h4>

          {/* Name */}
          <div>
            <label className="block text-[10px] text-[#3b3b3b]/50 font-semibold uppercase tracking-wider mb-1">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Hot Prospects March"
              className="w-full px-3 py-2 text-sm bg-[#f5f2ed] border border-[#efeff1] rounded-lg
                focus:outline-none focus:ring-2 focus:ring-[#5856D6]/30 focus:border-[#5856D6]/50
                text-[#0b0707]/70 placeholder:text-[#3b3b3b]/25"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-[#3b3b3b]/50 font-semibold uppercase tracking-wider mb-1">
                <Filter className="w-3 h-3 inline mr-1" />
                Stage
              </label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f2ed] border border-[#efeff1] rounded-lg
                  focus:outline-none focus:ring-1 focus:ring-[#5856D6]/30 text-[#0b0707]/70"
              >
                <option value="prospect">Prospect</option>
                <option value="reached_out">Reached Out</option>
                <option value="in_conversation">In Conversation</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#3b3b3b]/50 font-semibold uppercase tracking-wider mb-1">
                <Users className="w-3 h-3 inline mr-1" />
                Sub-Status
              </label>
              <select
                value={subStatusFilter}
                onChange={(e) => setSubStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f2ed] border border-[#efeff1] rounded-lg
                  focus:outline-none focus:ring-1 focus:ring-[#5856D6]/30 text-[#0b0707]/70"
              >
                {SUB_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Match count */}
          <div className="flex items-center gap-2 p-3 bg-[#f5f2ed] rounded-lg">
            <Users className="w-4 h-4 text-[#5856D6]" />
            <span className="text-xs text-[#3b3b3b]/60">Matching prospects:</span>
            {matchLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-[#5856D6]" />
            ) : (
              <span className="text-sm font-bold text-[#0b0707]/80 tabular-nums">
                {matchCount?.toLocaleString() ?? '--'}
              </span>
            )}
          </div>

          {/* Template selection */}
          <div>
            <label className="block text-[10px] text-[#3b3b3b]/50 font-semibold uppercase tracking-wider mb-1">
              Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#f5f2ed] border border-[#efeff1] rounded-lg
                focus:outline-none focus:ring-1 focus:ring-[#5856D6]/30 text-[#0b0707]/70"
            >
              <option value="">Select a template...</option>
              {templates.map(tpl => (
                <option key={tpl.slug} value={tpl.slug}>
                  {tpl.slug} (Wave {tpl.touch_number})
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {selectedTpl && (
            <div className="bg-[#f5f2ed] rounded-lg overflow-hidden">
              <button
                onClick={() => setPreviewExpanded(!previewExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#efece7] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3 h-3 text-[#5856D6]" />
                  <span className="text-[10px] font-semibold text-[#3b3b3b]/60">Preview</span>
                </div>
                {previewExpanded
                  ? <ChevronUp className="w-3 h-3 text-[#3b3b3b]/30" />
                  : <ChevronDown className="w-3 h-3 text-[#3b3b3b]/30" />
                }
              </button>
              {previewExpanded && (
                <div dir="rtl" className="px-3 pb-3 text-xs text-[#0b0707]/60 whitespace-pre-wrap leading-relaxed"
                  style={{ fontFamily: 'system-ui' }}
                >
                  {selectedTpl.body_template}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSendNow}
              disabled={sending || !selectedTemplate || !campaignName}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#34C759] text-white text-xs font-semibold
                rounded-lg hover:bg-[#2db14e] transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Now
            </button>
            <button
              onClick={handleSchedule}
              disabled={sending || !selectedTemplate || !campaignName}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#007AFF] text-white text-xs font-semibold
                rounded-lg hover:bg-[#0066dd] transition-colors disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule (+1h)
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-[#3b3b3b]/60 text-xs font-semibold
                rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Campaign History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <span className="text-xs font-bold text-[#0b0707]/70">Campaign History</span>
        </div>
        {campaigns.length === 0 ? (
          <div className="text-center py-8 text-[#3b3b3b]/30 text-xs">
            No campaigns yet. Create your first campaign above.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Name</th>
                <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Target</th>
                <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Status</th>
                <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Sent</th>
                <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Read</th>
                <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-b-0 hover:bg-[#f5f2ed]/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-semibold text-[#0b0707]/70">{c.name}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[9px] text-[#3b3b3b]/50">
                      {c.stage_filter} / {c.sub_status_filter}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
                  <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">
                    {(c.sent_count || 0).toLocaleString()}
                  </td>
                  <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">
                    {(c.read_count || 0).toLocaleString()}
                  </td>
                  <td className="text-right px-4 py-2.5 text-[10px] text-[#3b3b3b]/40">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
