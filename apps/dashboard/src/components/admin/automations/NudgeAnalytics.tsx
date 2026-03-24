import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  BarChart3, Loader2, RefreshCw, AlertCircle,
  Send, CheckCheck, Eye, TrendingUp,
} from 'lucide-react'

interface NudgeAnalyticRow {
  stage: string
  wave: number
  sent: number
  delivered: number
  read: number
}

interface StageSummary {
  stage: string
  sent: number
  delivered: number
  read: number
  waves: NudgeAnalyticRow[]
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  onboarding: { label: 'Onboarding', color: '#FF9500' },
  demo_trial: { label: 'Trial', color: '#AF52DE' },
  trial_expired: { label: 'Trial Expired', color: '#FF3B30' },
  paying: { label: 'Paying', color: '#34C759' },
  churned: { label: 'Churned', color: '#FF3B30' },
  first_touch: { label: 'First Touch', color: '#007AFF' },
}

function rateColor(rate: number): string {
  if (rate >= 50) return '#34C759'
  if (rate >= 20) return '#FF9500'
  return '#FF3B30'
}

function ReadRateBadge({ delivered, read }: { delivered: number; read: number }) {
  if (delivered === 0) return <span className="text-[9px] text-[#3b3b3b]/25">--</span>
  const rate = Math.round((read / delivered) * 100)
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: `${rateColor(rate)}15`, color: rateColor(rate) }}
    >
      {rate}%
    </span>
  )
}

export default function NudgeAnalytics() {
  const [data, setData] = useState<NudgeAnalyticRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)

  async function fetchAnalytics() {
    setError(null)
    setLoading(true)
    const { data: rows, error: err } = await supabase.rpc('get_nudge_analytics', { p_days: days })
    if (err) {
      setError(`Failed to load analytics: ${err.message}`)
      setLoading(false)
      return
    }
    setData((rows || []) as NudgeAnalyticRow[])
    setLoading(false)
  }

  useEffect(() => { fetchAnalytics() }, [days])

  // Aggregate totals
  const totals = data.reduce(
    (acc, r) => ({
      sent: acc.sent + (r.sent || 0),
      delivered: acc.delivered + (r.delivered || 0),
      read: acc.read + (r.read || 0),
    }),
    { sent: 0, delivered: 0, read: 0 }
  )

  // Group by stage
  const stageMap: Record<string, StageSummary> = {}
  for (const row of data) {
    if (!stageMap[row.stage]) {
      stageMap[row.stage] = { stage: row.stage, sent: 0, delivered: 0, read: 0, waves: [] }
    }
    stageMap[row.stage].sent += row.sent || 0
    stageMap[row.stage].delivered += row.delivered || 0
    stageMap[row.stage].read += row.read || 0
    stageMap[row.stage].waves.push(row)
  }
  const stages = Object.values(stageMap)

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
          <BarChart3 className="w-4 h-4 text-[#5856D6]" />
          <h3 className="text-sm font-bold text-[#0b0707]/80">Nudge Analytics</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-[10px] bg-[#f5f2ed] border border-[#efeff1] rounded-lg px-2 py-1
              text-[#3b3b3b]/60 focus:outline-none focus:ring-1 focus:ring-[#5856D6]/30"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
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
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-3.5 h-3.5 text-[#007AFF]" />
            <span className="text-[9px] uppercase tracking-wider text-[#3b3b3b]/40 font-semibold">Sent</span>
          </div>
          <span className="text-2xl font-black text-[#0b0707]/80 tabular-nums">{totals.sent.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCheck className="w-3.5 h-3.5 text-[#34C759]" />
            <span className="text-[9px] uppercase tracking-wider text-[#3b3b3b]/40 font-semibold">Delivered</span>
          </div>
          <span className="text-2xl font-black text-[#0b0707]/80 tabular-nums">{totals.delivered.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-3.5 h-3.5 text-[#5856D6]" />
            <span className="text-[9px] uppercase tracking-wider text-[#3b3b3b]/40 font-semibold">Read</span>
          </div>
          <span className="text-2xl font-black text-[#0b0707]/80 tabular-nums">{totals.read.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF9500]" />
            <span className="text-[9px] uppercase tracking-wider text-[#3b3b3b]/40 font-semibold">Read Rate</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tabular-nums" style={{ color: rateColor(totals.delivered > 0 ? (totals.read / totals.delivered) * 100 : 0) }}>
              {totals.delivered > 0 ? Math.round((totals.read / totals.delivered) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Per-stage breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <span className="text-xs font-bold text-[#0b0707]/70">Per-Stage Breakdown</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Stage</th>
              <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Sent</th>
              <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Delivered</th>
              <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Read</th>
              <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Rate</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const meta = STAGE_META[s.stage] || { label: s.stage, color: '#8E8E93' }
              return (
                <tr key={s.stage} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                      <span className="text-xs font-semibold text-[#0b0707]/70">{meta.label}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">{s.sent.toLocaleString()}</td>
                  <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">{s.delivered.toLocaleString()}</td>
                  <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">{s.read.toLocaleString()}</td>
                  <td className="text-right px-4 py-2.5">
                    <ReadRateBadge delivered={s.delivered} read={s.read} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Per-wave breakdown within stages */}
      {stages.map((s) => {
        const meta = STAGE_META[s.stage] || { label: s.stage, color: '#8E8E93' }
        if (s.waves.length <= 1) return null

        return (
          <div key={`waves-${s.stage}`} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
              <span className="text-xs font-bold text-[#0b0707]/70">{meta.label} — Per Wave</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Wave</th>
                  <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Sent</th>
                  <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Delivered</th>
                  <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Read</th>
                  <th className="text-right text-[9px] text-[#3b3b3b]/40 uppercase tracking-wider font-semibold px-4 py-2">Rate</th>
                </tr>
              </thead>
              <tbody>
                {s.waves
                  .sort((a, b) => a.wave - b.wave)
                  .map((w) => (
                    <tr key={`${s.stage}-w${w.wave}`} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold text-[#0b0707]/60">Wave {w.wave}</span>
                      </td>
                      <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">{(w.sent || 0).toLocaleString()}</td>
                      <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">{(w.delivered || 0).toLocaleString()}</td>
                      <td className="text-right px-4 py-2.5 text-xs tabular-nums text-[#0b0707]/60">{(w.read || 0).toLocaleString()}</td>
                      <td className="text-right px-4 py-2.5">
                        <ReadRateBadge delivered={w.delivered || 0} read={w.read || 0} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      })}

      {data.length === 0 && !error && (
        <div className="text-center py-8 text-[#3b3b3b]/30 text-xs">
          No analytics data for the selected period.
        </div>
      )}
    </div>
  )
}
