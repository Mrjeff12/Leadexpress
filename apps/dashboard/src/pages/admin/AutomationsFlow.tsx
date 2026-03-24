import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Zap, Phone, MessageCircle, Sparkles, Clock,
  DollarSign, XCircle, RefreshCw,
  Bot, Send, Eye, AlertTriangle, CreditCard, Target,
  ArrowRight,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   Solar System Pipeline — matches AdminCanvas visual style
   ═══════════════════════════════════════════════════════════ */

const VW = 1400
const VH = 800

/* ─── Hub definitions with absolute positions ─── */
interface HubDef {
  id: string
  x: number
  y: number
  size: number
  color: string
  gradient: [string, string]
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  automation?: string
}

const PIPELINE_HUBS: HubDef[] = [
  { id: 'prospect', x: 180, y: 250, size: 56, color: '#8E8E93', gradient: ['#B0B0B5', '#8E8E93'], icon: Target, label: 'PROSPECT', automation: 'Scoring every 6h' },
  { id: 'reached_out', x: 420, y: 250, size: 48, color: '#007AFF', gradient: ['#4DA3FF', '#007AFF'], icon: Send, label: 'REACHED OUT', automation: 'Auto follow-up 3-touch' },
  { id: 'in_conversation', x: 660, y: 250, size: 48, color: '#5856D6', gradient: ['#7A78E8', '#5856D6'], icon: MessageCircle, label: 'IN CONVERSATION', automation: 'Waiting-on-us every 5m' },
  { id: 'onboarding', x: 900, y: 250, size: 48, color: '#FF9500', gradient: ['#FFB347', '#FF9500'], icon: Sparkles, label: 'ONBOARDING', automation: 'Step tracking' },
  { id: 'demo_trial', x: 900, y: 550, size: 48, color: '#AF52DE', gradient: ['#C77DEB', '#AF52DE'], icon: Zap, label: 'DEMO / TRIAL', automation: 'Activity detection hourly' },
  { id: 'trial_expired', x: 660, y: 550, size: 44, color: '#FF3B30', gradient: ['#FF6B63', '#FF3B30'], icon: Clock, label: 'TRIAL EXPIRED' },
  { id: 'paying', x: 420, y: 550, size: 52, color: '#34C759', gradient: ['#5ED87B', '#34C759'], icon: DollarSign, label: 'PAYING', automation: 'Stripe webhooks' },
  { id: 'churned', x: 180, y: 550, size: 44, color: '#FF3B30', gradient: ['#FF6B63', '#FF3B30'], icon: XCircle, label: 'CHURNED', automation: 'Stripe webhooks' },
]

function getHub(id: string) { return PIPELINE_HUBS.find(h => h.id === id)! }

/* ─── Pipeline connections ─── */
const CONNECTIONS: { from: string; to: string; width: number; animated?: boolean }[] = [
  { from: 'prospect', to: 'reached_out', width: 3, animated: true },
  { from: 'reached_out', to: 'in_conversation', width: 3, animated: true },
  { from: 'in_conversation', to: 'onboarding', width: 2.5, animated: true },
  { from: 'onboarding', to: 'demo_trial', width: 2.5, animated: true },
  { from: 'demo_trial', to: 'trial_expired', width: 2 },
  { from: 'demo_trial', to: 'paying', width: 2.5, animated: true },
  { from: 'trial_expired', to: 'churned', width: 1.5 },
  { from: 'paying', to: 'churned', width: 1.5 },
]

/* ─── Sub-status definitions ─── */
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

/* ─── Automation definitions ─── */
const AUTOMATIONS = [
  { id: 'scoring', name: 'Prospect Scoring', icon: Target, interval: 'Every 6h', stageId: 'prospect', color: '#FF9500' },
  { id: 'callbacks', name: 'Twilio Callbacks', icon: Eye, interval: 'Real-time', stageId: 'reached_out', color: '#007AFF' },
  { id: 'waiting', name: 'Waiting on Us', icon: AlertTriangle, interval: 'Every 5m', stageId: 'in_conversation', color: '#FF3B30' },
  { id: 'followup', name: 'Auto Follow-Up', icon: Send, interval: 'Every hour', stageId: 'reached_out', color: '#5856D6' },
  { id: 'trial', name: 'Trial Activity', icon: Zap, interval: 'Every hour', stageId: 'demo_trial', color: '#AF52DE' },
  { id: 'stripe', name: 'Stripe Webhooks', icon: CreditCard, interval: 'Real-time', stageId: 'paying', color: '#34C759' },
]

/* ─── Automation bar positions (bottom row, y=720) ─── */
const AUTO_NODES = AUTOMATIONS.map((a, i) => ({
  ...a,
  x: 140 + i * (1120 / (AUTOMATIONS.length - 1)),
  y: 720,
  size: 36,
}))

/* ─── Satellite orbit radius ─── */
const SAT_ORBIT_R = 80

/* ─── Helpers ─── */
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

/* ═══════════════════════════════════════════════════════════
   Network Visualization (SVG + HTML overlay)
   ═══════════════════════════════════════════════════════════ */
function PipelineVisualization({
  stageCounts,
  subStatusCounts,
  navigate,
  selectedAutomation,
  setSelectedAutomation,
  templates,
  setTemplates,
}: {
  stageCounts: Record<string, number>
  subStatusCounts: Record<string, Record<string, number>>
  navigate: ReturnType<typeof useNavigate>
  selectedAutomation: string | null
  setSelectedAutomation: (v: string | null) => void
  templates: any[]
  setTemplates: (v: any[]) => void
}) {
  /* ─── Compute satellite positions for each hub ─── */
  const satellites = useMemo(() => {
    const result: {
      hubId: string
      key: string
      label: string
      color: string
      count: number
      x: number
      y: number
      parentX: number
      parentY: number
    }[] = []

    for (const hub of PIPELINE_HUBS) {
      const defs = SUB_STATUSES[hub.id] || []
      const withCount = defs.filter(d => (subStatusCounts[hub.id]?.[d.key] || 0) > 0)
      if (withCount.length === 0) continue

      // Compute arc start angle based on hub position
      // Top row hubs: satellites below; Bottom row hubs: satellites above
      const isTopRow = hub.y < 400
      const startAngle = isTopRow ? Math.PI * 0.15 : -Math.PI * 1.15
      const sweep = isTopRow ? Math.PI * 0.7 : Math.PI * 0.7

      withCount.forEach((sub, i) => {
        const angle = startAngle + (withCount.length === 1 ? sweep / 2 : (i / (withCount.length - 1)) * sweep)
        result.push({
          hubId: hub.id,
          key: sub.key,
          label: sub.label,
          color: sub.color,
          count: subStatusCounts[hub.id]?.[sub.key] || 0,
          x: hub.x + SAT_ORBIT_R * Math.cos(angle),
          y: hub.y + SAT_ORBIT_R * Math.sin(angle),
          parentX: hub.x,
          parentY: hub.y,
        })
      })
    }
    return result
  }, [subStatusCounts])

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      {/* ═══ SVG Layer ═══ */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-full"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow-auto">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ─── Hub-to-hub pipeline connections ─── */}
        {CONNECTIONS.map((conn, i) => {
          const from = getHub(conn.from)
          const to = getHub(conn.to)
          const dx = to.x - from.x
          const dy = to.y - from.y
          const pathD = `M${from.x},${from.y} C${from.x + dx * 0.4},${from.y + dy * 0.1} ${to.x - dx * 0.4},${to.y - dy * 0.1} ${to.x},${to.y}`
          const pathId = `pipe-${i}`
          return (
            <g key={i}>
              <path d={pathD} fill="none" stroke={from.color} strokeWidth={conn.width + 4} opacity="0.03" strokeLinecap="round" />
              <path id={pathId} d={pathD} fill="none" stroke={from.color} strokeWidth={conn.width} opacity="0.18" strokeLinecap="round" />
              {conn.animated && (
                <circle r="3.5" fill={from.color} opacity="0.6" filter="url(#glow-auto)">
                  <animateMotion dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite">
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          )
        })}

        {/* ─── Satellite spokes (hub → sub-status) ─── */}
        {satellites.map((sat, i) => (
          <line key={`spoke-${i}`}
            x1={sat.parentX} y1={sat.parentY} x2={sat.x} y2={sat.y}
            stroke={sat.color} strokeWidth="1" opacity="0.12" />
        ))}

        {/* ─── Automation connections (auto node → pipeline hub) ─── */}
        {AUTO_NODES.map((auto, i) => {
          const hub = getHub(auto.stageId)
          return (
            <line key={`auto-conn-${i}`}
              x1={auto.x} y1={auto.y} x2={hub.x} y2={hub.y}
              stroke={auto.color} strokeWidth="1" opacity="0.08"
              strokeDasharray="4 6" />
          )
        })}
      </svg>

      {/* ═══ HTML Layer ═══ */}

      {/* ─── Pipeline hub nodes ─── */}
      {PIPELINE_HUBS.map((hub) => {
        const Icon = hub.icon
        const count = stageCounts[hub.id] || 0
        return (
          <div
            key={hub.id}
            onClick={() => navigate(`/admin/bot/inbox?stage=${hub.id}`)}
            className="absolute flex flex-col items-center cursor-pointer hover:scale-105 transition-transform transition-all duration-300 hover:-translate-y-1"
            style={{
              left: `${(hub.x / VW) * 100}%`,
              top: `${(hub.y / VH) * 100}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                width: hub.size, height: hub.size,
                borderRadius: hub.size * 0.28,
                background: `linear-gradient(145deg, ${hub.gradient[0]}, ${hub.gradient[1]})`,
                boxShadow: `0 6px 24px ${hub.color}35, 0 2px 8px ${hub.color}25`,
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{
                borderRadius: hub.size * 0.28,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)',
              }} />
              <Icon className="text-white relative z-10" style={{
                width: hub.size * 0.45, height: hub.size * 0.45,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
              }} />
            </div>
            <div className="text-[14px] font-black tabular-nums text-[#0b0707]/85 mt-1 leading-none">
              {count.toLocaleString()}
            </div>
            <div className="text-[7px] text-[#3b3b3b]/40 uppercase tracking-[0.1em] font-semibold mt-0.5 text-center max-w-[80px]">
              {hub.label}
            </div>
          </div>
        )
      })}

      {/* ─── Satellite sub-status nodes ─── */}
      {satellites.map((sat, i) => (
        <div
          key={`sat-${sat.hubId}-${sat.key}`}
          onClick={() => navigate(`/admin/bot/inbox?stage=${sat.hubId}&sub=${sat.key}`)}
          className="absolute flex flex-col items-center cursor-pointer hover:scale-110 transition-transform transition-all duration-300"
          style={{
            left: `${(sat.x / VW) * 100}%`,
            top: `${(sat.y / VH) * 100}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            opacity: 0,
            animation: `fadeScaleIn 0.4s ease-out ${200 + i * 60}ms forwards`,
          }}
        >
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 24, height: 24,
              borderRadius: 7,
              background: `${sat.color}12`,
              border: `1.5px solid ${sat.color}35`,
              boxShadow: `0 2px 8px ${sat.color}15`,
            }}
          >
            <span className="text-[9px] font-black tabular-nums leading-none" style={{ color: sat.color }}>
              {sat.count}
            </span>
          </div>
          <div className="text-[6px] text-[#3b3b3b]/40 uppercase tracking-[0.08em] font-semibold mt-0.5 text-center max-w-[48px] truncate">
            {sat.label}
          </div>
        </div>
      ))}

      {/* ─── Automation bar nodes (bottom row) ─── */}
      {AUTO_NODES.map((auto) => {
        const Icon = auto.icon
        return (
          <div
            key={auto.id}
            onClick={() => {
              setSelectedAutomation(selectedAutomation === auto.name ? null : auto.name)
              if (auto.name === 'Auto Follow-Up') {
                supabase.from('message_templates').select('*').eq('is_active', true)
                  .order('touch_number').then(({ data }) => { if (data) setTemplates(data) })
              }
            }}
            className="absolute flex flex-col items-center cursor-pointer hover:scale-110 transition-transform transition-all duration-300"
            style={{
              left: `${(auto.x / VW) * 100}%`,
              top: `${(auto.y / VH) * 100}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
            }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                width: auto.size, height: auto.size,
                borderRadius: auto.size * 0.28,
                background: `linear-gradient(145deg, ${auto.color}30, ${auto.color}18)`,
                border: `1.5px solid ${auto.color}30`,
                boxShadow: `0 4px 16px ${auto.color}15`,
              }}
            >
              <Icon className="relative z-10" style={{
                width: auto.size * 0.42, height: auto.size * 0.42,
                color: auto.color,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
              }} />
              {/* Active pulse dot */}
              <div
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                style={{ background: '#34C759', boxShadow: '0 0 6px rgba(52,199,89,0.6)' }}
              />
            </div>
            <div className="text-[7px] text-[#3b3b3b]/50 font-semibold mt-1 text-center max-w-[70px] leading-tight">
              {auto.name}
            </div>
            <div className="text-[6px] text-[#3b3b3b]/30 uppercase tracking-[0.08em] font-medium">
              {auto.interval}
            </div>
          </div>
        )
      })}

      {/* ─── Automation detail panel ─── */}
      {selectedAutomation && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[600px] bg-white rounded-2xl shadow-2xl border border-black/[0.06] p-5 z-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#1C1C1E]">{selectedAutomation}</h3>
            <button onClick={() => setSelectedAutomation(null)} className="text-[#8E8E93] hover:text-[#1C1C1E]">&#x2715;</button>
          </div>

          {selectedAutomation === 'Auto Follow-Up' && templates.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">Templates ({templates.length})</p>
              {templates.map((t: any) => (
                <div key={t.id} className="p-3 rounded-xl bg-[#F5F5F7] border border-black/[0.04]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-[#1C1C1E]">
                      Touch {t.touch_number} — {t.name}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-[#8E8E93]">
                      <span>{t.send_count} sent</span>
                      <span>{t.reply_count} replies</span>
                      {t.send_count > 0 && (
                        <span className="font-bold" style={{ color: (t.reply_count / t.send_count) > 0.1 ? '#34C759' : '#FF9500' }}>
                          {((t.reply_count / t.send_count) * 100).toFixed(0)}% rate
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] text-[#3A3A3C] leading-relaxed whitespace-pre-line" dir="rtl">
                    {t.body_template}
                  </p>
                </div>
              ))}
            </div>
          )}

          {selectedAutomation === 'Prospect Scoring' && (
            <div className="space-y-2">
              <p className="text-xs text-[#8E8E93]">Runs every 6 hours. Classifies prospects by group activity.</p>
              <div className="grid grid-cols-4 gap-2">
                {['hot', 'warm', 'cold', 'stale'].map(s => (
                  <div key={s} className="text-center p-2 rounded-lg bg-[#F5F5F7]">
                    <p className="text-lg font-bold" style={{ color: s === 'hot' ? '#FF3B30' : s === 'warm' ? '#FF9500' : s === 'cold' ? '#007AFF' : '#8E8E93' }}>
                      {subStatusCounts['prospect']?.[s] || 0}
                    </p>
                    <p className="text-[10px] text-[#8E8E93] uppercase font-bold">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAutomation === 'Twilio Callbacks' && (
            <div className="space-y-2">
              <p className="text-xs text-[#8E8E93]">Real-time. Updates sub-status when prospects read/ignore messages.</p>
              <div className="grid grid-cols-3 gap-2">
                {['unread', 'read_no_reply', 'not_sent'].map(s => (
                  <div key={s} className="text-center p-2 rounded-lg bg-[#F5F5F7]">
                    <p className="text-lg font-bold">{subStatusCounts['reached_out']?.[s] || 0}</p>
                    <p className="text-[10px] text-[#8E8E93] uppercase font-bold">{s.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAutomation === 'Waiting on Us' && (
            <div className="space-y-2">
              <p className="text-xs text-[#8E8E93]">Every 5 min. Detects prospects waiting for our reply.</p>
              <div className="grid grid-cols-2 gap-2">
                {['waiting_on_us', 'waiting_on_them'].map(s => (
                  <div key={s} className="text-center p-3 rounded-lg" style={{ background: s === 'waiting_on_us' ? '#FF3B3010' : '#F5F5F7' }}>
                    <p className="text-2xl font-bold" style={{ color: s === 'waiting_on_us' ? '#FF3B30' : '#8E8E93' }}>
                      {subStatusCounts['in_conversation']?.[s] || 0}
                    </p>
                    <p className="text-[10px] uppercase font-bold" style={{ color: s === 'waiting_on_us' ? '#FF3B30' : '#8E8E93' }}>
                      {s.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAutomation === 'Trial Activity' && (
            <div className="space-y-2">
              <p className="text-xs text-[#8E8E93]">Every hour. Monitors trial engagement and alerts on no leads.</p>
              <div className="grid grid-cols-3 gap-2">
                {['engaged', 'no_leads', 'expiring'].map(s => (
                  <div key={s} className="text-center p-2 rounded-lg bg-[#F5F5F7]">
                    <p className="text-lg font-bold" style={{ color: s === 'no_leads' ? '#FF3B30' : s === 'expiring' ? '#FF9500' : '#34C759' }}>
                      {subStatusCounts['demo_trial']?.[s] || 0}
                    </p>
                    <p className="text-[10px] text-[#8E8E93] uppercase font-bold">{s.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAutomation === 'Stripe Webhooks' && (
            <div className="space-y-2">
              <p className="text-xs text-[#8E8E93]">Real-time. Updates status on payment success/failure/cancellation.</p>
              <div className="grid grid-cols-2 gap-2">
                {['healthy', 'payment_failing'].map(s => (
                  <div key={s} className="text-center p-2 rounded-lg bg-[#F5F5F7]">
                    <p className="text-lg font-bold" style={{ color: s === 'healthy' ? '#34C759' : '#FF3B30' }}>
                      {subStatusCounts['paying']?.[s] || 0}
                    </p>
                    <p className="text-[10px] text-[#8E8E93] uppercase font-bold">{s.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Event Badge (for bottom events list)
   ═══════════════════════════════════════════════════════════ */
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
      style={{ background: `${def.color}15`, color: def.color }}
    >
      {def.label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════ */
export default function AutomationsFlow() {
  const navigate = useNavigate()
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [subStatusCounts, setSubStatusCounts] = useState<Record<string, Record<string, number>>>({})
  const [recentEvents, setRecentEvents] = useState<ProspectEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedAutomation, setSelectedAutomation] = useState<string | null>(null)
  const [templates, setTemplates] = useState<any[]>([])

  async function fetchData() {
    // Get stage + sub_status counts via RPC (no 1000 row limit)
    const { data: rows } = await supabase.rpc('get_pipeline_counts')

    if (rows) {
      const sc: Record<string, number> = {}
      const ssc: Record<string, Record<string, number>> = {}
      for (const r of rows as { stage: string; sub_status: string | null; count: number }[]) {
        sc[r.stage] = (sc[r.stage] || 0) + r.count
        if (r.sub_status) {
          if (!ssc[r.stage]) ssc[r.stage] = {}
          ssc[r.stage][r.sub_status] = r.count
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
      <div className="flex items-center justify-center h-screen" style={{ background: '#faf9f6' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 border-2 border-[#5856D6]/20 rounded-full" />
            <div className="absolute inset-0 border-2 border-[#5856D6] border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-[#3b3b3b]/40 text-[10px] uppercase tracking-[0.2em] font-medium">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col" style={{ background: '#faf9f6' }}>
      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-4 h-[52px] z-10 relative"
        style={{ background: '#ffffff', borderBottom: '1px solid #efeff1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#5856D6]" />
            <div className="flex flex-col leading-none">
              <span className="text-[#0b0707]/80 font-extrabold text-[12px] tracking-[0.05em]">AUTOMATIONS FLOW</span>
              <span className="text-[7px] text-[#3b3b3b]/30 uppercase tracking-[0.25em]">pipeline network</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#5856D6]/10 border border-[#5856D6]/20 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#5856D6] animate-pulse shadow-[0_0_6px_rgba(88,86,214,0.8)]" />
            <span className="text-[9px] font-bold text-[#5856D6] uppercase tracking-[0.12em]">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f5f2ed] border border-[#efeff1]">
            <span className="text-[8px] text-[#3b3b3b]/40 uppercase tracking-[0.15em] font-medium">Total</span>
            <span className="text-[15px] font-black tabular-nums text-[#0b0707]/80">{totalProspects.toLocaleString()}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all
              bg-[#f5f2ed] hover:bg-[#efece7] border border-[#efeff1] text-[#3b3b3b]/60 hover:text-[#3b3b3b]/90"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ═══════════════ SOLAR SYSTEM PIPELINE ═══════════════ */}
      <div className="flex-1 relative overflow-hidden">
        <PipelineVisualization
          stageCounts={stageCounts}
          subStatusCounts={subStatusCounts}
          navigate={navigate}
          selectedAutomation={selectedAutomation}
          setSelectedAutomation={setSelectedAutomation}
          templates={templates}
          setTemplates={setTemplates}
        />
      </div>

      {/* ═══════════════ BOTTOM BAR — Recent Events ═══════════════ */}
      <div
        className="shrink-0 z-10 overflow-hidden"
        style={{ background: '#ffffff', borderTop: '1px solid #efeff1', boxShadow: '0 -1px 3px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-2 px-4 pt-2 pb-1">
          <Phone className="w-3 h-3 text-[#007AFF]/60" />
          <span className="text-[8px] text-[#3b3b3b]/40 uppercase tracking-[0.15em] font-semibold">Recent Events</span>
          <span className="text-[7px] text-[#3b3b3b]/25 ml-1">Last 20</span>
        </div>
        <div className="flex overflow-x-auto gap-1 px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
          {recentEvents.length === 0 ? (
            <span className="text-[10px] text-[#3b3b3b]/25 py-2">No recent events</span>
          ) : (
            recentEvents.slice(0, 12).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0"
                style={{ background: '#f5f2ed', border: '1px solid #efeff1' }}
              >
                <span className="text-[8px] text-[#3b3b3b]/25 font-mono">{fmtTime(ev.created_at)}</span>
                <EventBadge type={ev.event_type} />
                <span className="text-[9px] text-[#3b3b3b]/50 max-w-[100px] truncate">
                  {ev.event_type === 'auto_followup'
                    ? 'Auto follow-up'
                    : <>
                        <span className="text-[#3b3b3b]/30">{ev.old_value || '?'}</span>
                        <ArrowRight className="w-2 h-2 inline mx-0.5 text-[#3b3b3b]/15" />
                        <span className="text-[#0b0707]/70 font-semibold">{ev.new_value}</span>
                      </>
                  }
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
