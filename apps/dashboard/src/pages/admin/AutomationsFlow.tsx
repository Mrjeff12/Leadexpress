import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Zap, Phone, MessageCircle, Sparkles, Clock,
  DollarSign, XCircle, ArrowRight, RefreshCw,
  Bot, Send, Eye, AlertTriangle, CreditCard, Target,
} from 'lucide-react'

/* ── Stage definitions ── */
const STAGES = [
  { key: 'prospect', label: 'Prospect', icon: Target, color: '#8E8E93', automation: 'Scoring every 6h' },
  { key: 'reached_out', label: 'Reached Out', icon: Send, color: '#007AFF', automation: 'Auto follow-up 3-touch' },
  { key: 'in_conversation', label: 'In Conversation', icon: MessageCircle, color: '#5856D6', automation: 'Waiting-on-us every 5m' },
  { key: 'onboarding', label: 'Onboarding', icon: Sparkles, color: '#FF9500', automation: 'Step tracking' },
  { key: 'demo_trial', label: 'Demo / Trial', icon: Zap, color: '#AF52DE', automation: 'Activity detection hourly' },
  { key: 'trial_expired', label: 'Trial Expired', icon: Clock, color: '#FF3B30', automation: null },
  { key: 'paying', label: 'Paying', icon: DollarSign, color: '#34C759', automation: 'Stripe webhooks' },
  { key: 'churned', label: 'Churned', icon: XCircle, color: '#FF3B30', automation: 'Stripe webhooks' },
]

/* ── Sub-status definitions (mirrors AdminInbox) ── */
const SUB_STATUSES: Record<string, { key: string; label: string; color: string }[]> = {
  prospect: [
    { key: 'hot', label: 'Hot', color: '#FF3B30' },
    { key: 'warm', label: 'Warm', color: '#FF9500' },
    { key: 'cold', label: 'Cold', color: '#007AFF' },
    { key: 'stale', label: 'Stale', color: '#8E8E93' },
    { key: 'invalid', label: 'Invalid', color: '#C7C7CC' },
    { key: 'do_not_contact', label: 'DNC', color: '#FF3B30' },
  ],
  reached_out: [
    { key: 'not_sent', label: 'Not Sent', color: '#C7C7CC' },
    { key: 'unread', label: 'Unread', color: '#FF9500' },
    { key: 'read_no_reply', label: 'Read', color: '#FF9500' },
    { key: 'followup_1', label: 'Follow-up 1', color: '#007AFF' },
    { key: 'followup_2', label: 'Follow-up 2', color: '#007AFF' },
    { key: 'no_response', label: 'No Response', color: '#8E8E93' },
    { key: 'not_interested', label: 'Not Interested', color: '#FF3B30' },
  ],
  in_conversation: [
    { key: 'active', label: 'Active', color: '#34C759' },
    { key: 'asking_price', label: 'Asking Price', color: '#FF9500' },
    { key: 'hesitating', label: 'Hesitating', color: '#FF9500' },
    { key: 'waiting_on_us', label: 'Waiting on Us!', color: '#FF3B30' },
    { key: 'waiting_on_them', label: 'Waiting', color: '#8E8E93' },
    { key: 'gone_quiet', label: 'Gone Quiet', color: '#8E8E93' },
    { key: 'scheduled', label: 'Scheduled', color: '#5856D6' },
    { key: 'sent_link', label: 'Sent Link', color: '#007AFF' },
  ],
  onboarding: [
    { key: 'first_name', label: 'Name', color: '#34C759' },
    { key: 'profession', label: 'Trades', color: '#34C759' },
    { key: 'city_state', label: 'State', color: '#007AFF' },
    { key: 'city', label: 'Cities', color: '#007AFF' },
    { key: 'working_days', label: 'Schedule', color: '#5856D6' },
    { key: 'confirm', label: 'Confirm', color: '#FF9500' },
    { key: 'groups', label: 'Groups', color: '#FF9500' },
  ],
  demo_trial: [
    { key: 'just_started', label: 'Just Started', color: '#007AFF' },
    { key: 'receiving_leads', label: 'Getting Leads', color: '#34C759' },
    { key: 'engaged', label: 'Engaged', color: '#34C759' },
    { key: 'no_leads', label: 'No Leads!', color: '#FF3B30' },
    { key: 'inactive', label: 'Inactive', color: '#FF9500' },
    { key: 'expiring', label: 'Expiring', color: '#FF9500' },
    { key: 'wants_to_pay', label: 'Wants to Pay', color: '#34C759' },
  ],
  trial_expired: [
    { key: 'was_active', label: 'Was Active', color: '#FF9500' },
    { key: 'barely_used', label: 'Barely Used', color: '#8E8E93' },
    { key: 'never_used', label: 'Never Used', color: '#C7C7CC' },
    { key: 'payment_failed', label: 'Payment Failed', color: '#FF3B30' },
    { key: 'got_offer', label: 'Got Offer', color: '#5856D6' },
    { key: 'declined', label: 'Declined', color: '#FF3B30' },
  ],
  paying: [
    { key: 'healthy', label: 'Healthy', color: '#34C759' },
    { key: 'power_user', label: 'Power User', color: '#34C759' },
    { key: 'low_usage', label: 'Low Usage', color: '#FF9500' },
    { key: 'low_leads', label: 'Low Leads', color: '#FF3B30' },
    { key: 'support_issue', label: 'Support', color: '#FF3B30' },
    { key: 'payment_failing', label: 'Payment Issue', color: '#FF3B30' },
    { key: 'upgrade_candidate', label: 'Upgrade', color: '#5856D6' },
  ],
  churned: [
    { key: 'recent', label: 'Recent', color: '#FF9500' },
    { key: 'old', label: 'Old', color: '#8E8E93' },
    { key: 'payment_failed', label: 'Payment Failed', color: '#FF3B30' },
    { key: 'no_value', label: 'No Value', color: '#FF9500' },
    { key: 'seasonal', label: 'Seasonal', color: '#007AFF' },
    { key: 'competitor', label: 'Competitor', color: '#FF3B30' },
    { key: 'closed', label: 'Closed', color: '#8E8E93' },
  ],
}

/* ── Automation definitions ── */
const AUTOMATIONS = [
  { name: 'Prospect Scoring', icon: Target, interval: 'Every 6 hours', stage: 'prospect', color: '#FF9500' },
  { name: 'Twilio Callbacks', icon: Eye, interval: 'Real-time', stage: 'reached_out', color: '#007AFF' },
  { name: 'Waiting on Us', icon: AlertTriangle, interval: 'Every 5 min', stage: 'in_conversation', color: '#FF3B30' },
  { name: 'Auto Follow-Up', icon: Send, interval: 'Every hour', stage: 'reached_out', color: '#5856D6' },
  { name: 'Trial Activity', icon: Zap, interval: 'Every hour', stage: 'demo_trial', color: '#AF52DE' },
  { name: 'Stripe Webhooks', icon: CreditCard, interval: 'Real-time', stage: 'paying', color: '#34C759' },
]

/* ── Helpers ── */
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

interface ProspectEvent {
  id: string
  event_type: string
  old_value: string | null
  new_value: string | null
  created_at: string
  prospect_id: string
}

/* ══════════════════════════════════════════════════════════ */
export default function AutomationsFlow() {
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [subStatusCounts, setSubStatusCounts] = useState<Record<string, Record<string, number>>>({})
  const [recentEvents, setRecentEvents] = useState<ProspectEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchData() {
    // Get stage + sub_status counts
    const { data: prospects } = await supabase
      .from('prospect_with_groups')
      .select('stage, sub_status')
      .is('archived_at', null)

    if (prospects) {
      const sc: Record<string, number> = {}
      const ssc: Record<string, Record<string, number>> = {}
      for (const p of prospects) {
        sc[p.stage] = (sc[p.stage] || 0) + 1
        if (p.sub_status) {
          if (!ssc[p.stage]) ssc[p.stage] = {}
          ssc[p.stage][p.sub_status] = (ssc[p.stage][p.sub_status] || 0) + 1
        }
      }
      setStageCounts(sc)
      setSubStatusCounts(ssc)
    }

    // Get recent events
    const { data: events } = await supabase
      .from('prospect_events')
      .select('id, event_type, old_value, new_value, created_at, prospect_id')
      .in('event_type', ['stage_change', 'sub_status_change', 'auto_followup'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (events) setRecentEvents(events as ProspectEvent[])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const totalProspects = Object.values(stageCounts).reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: '#0A0A0F' }}
      >
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div
      className="h-screen overflow-y-auto"
      style={{
        background: '#0A0A0F',
        backgroundImage:
          'radial-gradient(at 20% 20%, rgba(99,102,241,0.08) 0, transparent 50%), radial-gradient(at 80% 80%, rgba(254,91,37,0.05) 0, transparent 50%)',
        color: 'white',
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-black tracking-tight">Automations Flow</h1>
            </div>
            <p className="text-sm text-white/40">
              Live pipeline with automation status &middot;{' '}
              <span className="text-white/60 font-semibold">{totalProspects.toLocaleString()}</span>{' '}
              total prospects
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all
              bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/60 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Pipeline Flow — Row 1 (4 stages) ── */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          {STAGES.slice(0, 4).map((stage, idx) => (
            <StageCard
              key={stage.key}
              stage={stage}
              count={stageCounts[stage.key] || 0}
              subs={subStatusCounts[stage.key] || {}}
              subDefs={SUB_STATUSES[stage.key] || []}
              showArrow={idx > 0}
            />
          ))}
        </div>

        {/* ── Pipeline Flow — Row 2 (4 stages) ── */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {STAGES.slice(4).map((stage, idx) => (
            <StageCard
              key={stage.key}
              stage={stage}
              count={stageCounts[stage.key] || 0}
              subs={subStatusCounts[stage.key] || {}}
              subDefs={SUB_STATUSES[stage.key] || []}
              showArrow={idx > 0}
            />
          ))}
        </div>

        {/* ── Active Automations ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold">Active Automations</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {AUTOMATIONS.map((auto) => {
              const Icon = auto.icon
              return (
                <div
                  key={auto.name}
                  className="rounded-2xl p-4 border transition-all hover:scale-[1.02]"
                  style={{
                    background: `${auto.color}08`,
                    borderColor: `${auto.color}20`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${auto.color}18` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: auto.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{auto.name}</p>
                      <p className="text-[10px] text-white/40">{auto.interval}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">
                      Stage: {STAGES.find((s) => s.key === auto.stage)?.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Recent Events ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Recent Events</h2>
            <span className="text-xs text-white/30 ml-2">Last 20</span>
          </div>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            {recentEvents.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-white/30">
                No recent events found
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {recentEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-[11px] text-white/30 font-mono w-14 shrink-0">
                      {fmtTime(ev.created_at)}
                    </span>
                    <EventBadge type={ev.event_type} />
                    <span className="text-xs text-white/60 flex-1 min-w-0 truncate">
                      {ev.event_type === 'stage_change' && (
                        <>
                          <span className="text-white/30">{ev.old_value || '?'}</span>
                          <ArrowRight className="w-3 h-3 inline mx-1 text-white/20" />
                          <span className="text-white/80 font-semibold">{ev.new_value}</span>
                        </>
                      )}
                      {ev.event_type === 'sub_status_change' && (
                        <>
                          <span className="text-white/30">{ev.old_value || '?'}</span>
                          <ArrowRight className="w-3 h-3 inline mx-1 text-white/20" />
                          <span className="text-white/80 font-semibold">{ev.new_value}</span>
                        </>
                      )}
                      {ev.event_type === 'auto_followup' && (
                        <span className="text-indigo-300">Auto follow-up sent</span>
                      )}
                    </span>
                    <span className="text-[10px] text-white/20 font-mono shrink-0">
                      {ev.prospect_id?.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Stage Card Component ── */
function StageCard({
  stage,
  count,
  subs,
  subDefs,
  showArrow,
}: {
  stage: (typeof STAGES)[number]
  count: number
  subs: Record<string, number>
  subDefs: { key: string; label: string; color: string }[]
  showArrow: boolean
}) {
  const Icon = stage.icon
  return (
    <div className="relative">
      {showArrow && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10">
          <ArrowRight className="w-4 h-4 text-white/20" />
        </div>
      )}
      <div
        className="rounded-2xl p-4 border transition-all hover:scale-[1.02] h-full"
        style={{
          background: count > 0 ? `${stage.color}10` : 'rgba(255,255,255,0.03)',
          borderColor: count > 0 ? `${stage.color}30` : 'rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4" style={{ color: stage.color }} />
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
            {stage.label}
          </span>
        </div>
        <p className="text-3xl font-black text-white mb-3">{count.toLocaleString()}</p>

        {/* Sub-statuses */}
        <div className="space-y-1">
          {subDefs.map((sub) => {
            const subCount = subs[sub.key] || 0
            if (subCount === 0) return null
            return (
              <div key={sub.key} className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">{sub.label}</span>
                <span className="text-[11px] font-bold" style={{ color: sub.color }}>
                  {subCount}
                </span>
              </div>
            )
          })}
        </div>

        {/* Automation badge */}
        {stage.automation && (
          <div className="mt-3 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Bot className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] text-emerald-400 font-medium">{stage.automation}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Event Badge ── */
function EventBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    stage_change: { label: 'Stage', color: '#FF9500' },
    sub_status_change: { label: 'Status', color: '#007AFF' },
    auto_followup: { label: 'Bot', color: '#5856D6' },
  }
  const def = map[type] || { label: type, color: '#8E8E93' }
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: `${def.color}20`, color: def.color }}
    >
      {def.label}
    </span>
  )
}
