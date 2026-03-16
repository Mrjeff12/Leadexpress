import { useI18n } from '../../lib/i18n'
import { BarChart3, TrendingUp, Users, Briefcase } from 'lucide-react'

const dailyLeads = [
  { day: 'Sun', value: 12 },
  { day: 'Mon', value: 18 },
  { day: 'Tue', value: 15 },
  { day: 'Wed', value: 22 },
  { day: 'Thu', value: 19 },
  { day: 'Fri', value: 8 },
  { day: 'Sat', value: 3 },
]

const dayLabelsHe: Record<string, string> = {
  Sun: 'א׳',
  Mon: 'ב׳',
  Tue: 'ג׳',
  Wed: 'ד׳',
  Thu: 'ה׳',
  Fri: 'ו׳',
  Sat: 'ש׳',
}

const funnel = [
  { stage: 'Leads Received', stageHe: 'לידים שהתקבלו', value: 847, color: '#3b82f6' },
  { stage: 'Assigned to Contractors', stageHe: 'הוקצו לקבלנים', value: 623, color: '#f59e0b' },
  { stage: 'Contacted', stageHe: 'נוצר קשר', value: 412, color: '#8b5cf6' },
  { stage: 'Completed', stageHe: 'הושלמו', value: 198, color: '#22c55e' },
]

const topContractors = [
  { name: 'Carlos Mendez', leadsReceived: 45, completionRate: 78, profession: 'HVAC' },
  { name: 'Sarah Cohen', leadsReceived: 38, completionRate: 84, profession: 'Renovation' },
  { name: 'Tom Baker', leadsReceived: 32, completionRate: 65, profession: 'Fencing' },
  { name: 'Rachel Stern', leadsReceived: 28, completionRate: 72, profession: 'Cleaning' },
  { name: 'David Levy', leadsReceived: 25, completionRate: 59, profession: 'HVAC' },
]

const professionStats = [
  { name: 'HVAC', nameHe: 'מזגנים', leads: 234, color: 'hsl(205 85% 52%)' },
  { name: 'Renovation', nameHe: 'שיפוצים', leads: 189, color: 'hsl(28 90% 56%)' },
  { name: 'Fencing', nameHe: 'גדרות', leads: 156, color: 'hsl(262 68% 56%)' },
  { name: 'Cleaning', nameHe: 'ניקוי', leads: 98, color: 'hsl(160 50% 48%)' },
]

function rateColor(rate: number): string {
  if (rate >= 80) return '#22c55e'
  if (rate >= 70) return '#f59e0b'
  return '#ef4444'
}

export default function Analytics() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const maxDaily = Math.max(...dailyLeads.map((d) => d.value))
  const maxFunnel = Math.max(...funnel.map((f) => f.value))
  const maxProfession = Math.max(...professionStats.map((p) => p.leads))

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
          {he ? 'אנליטיקס' : 'Analytics'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
          {he ? 'לידים, המרות וביצועים' : 'Leads, conversions & performance'}
        </p>
      </header>

      <div className="stagger-children space-y-8">
        {/* Leads Over Time Chart — full width */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'לידים לאורך זמן' : 'Leads Over Time'}
            </h2>
          </div>
          <div className="flex items-end justify-between gap-3" style={{ height: 220 }}>
            {dailyLeads.map((d) => {
              const heightPct = (d.value / maxDaily) * 100
              return (
                <div key={d.day} className="flex flex-col items-center flex-1 h-full justify-end">
                  <span className="text-xs font-semibold mb-1" style={{ color: '#2d3a2e' }}>
                    {d.value}
                  </span>
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: '#5a8a5e',
                      minHeight: 4,
                    }}
                  />
                  <span className="text-xs mt-2 font-medium" style={{ color: '#6b7c6e' }}>
                    {he ? dayLabelsHe[d.day] : d.day}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 2-column row: Conversion Funnel | Profession Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Conversion Funnel */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5" style={{ color: '#5a8a5e' }} />
              <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
                {he ? 'משפך המרה' : 'Conversion Funnel'}
              </h2>
            </div>
            <div className="space-y-4">
              {funnel.map((f) => {
                const widthPct = (f.value / maxFunnel) * 100
                const pctOfTotal = ((f.value / funnel[0].value) * 100).toFixed(1)
                return (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                        {he ? f.stageHe : f.stage}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: '#6b7c6e' }}>
                        {f.value.toLocaleString()} ({pctOfTotal}%)
                      </span>
                    </div>
                    <div
                      className="rounded-full"
                      style={{ height: 10, width: '100%', backgroundColor: '#f0f0ee' }}
                    >
                      <div
                        className="rounded-full transition-all"
                        style={{
                          height: '100%',
                          width: `${widthPct}%`,
                          backgroundColor: f.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Profession Distribution */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-6">
              <Briefcase className="h-5 w-5" style={{ color: '#5a8a5e' }} />
              <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
                {he ? 'התפלגות מקצועות' : 'Profession Distribution'}
              </h2>
            </div>
            <div className="space-y-4">
              {professionStats.map((p) => {
                const widthPct = (p.leads / maxProfession) * 100
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: '#2d3a2e' }}>
                        {he ? p.nameHe : p.name}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: '#6b7c6e' }}>
                        {p.leads}
                      </span>
                    </div>
                    <div
                      className="rounded-full"
                      style={{ height: 10, width: '100%', backgroundColor: '#f0f0ee' }}
                    >
                      <div
                        className="rounded-full transition-all"
                        style={{
                          height: '100%',
                          width: `${widthPct}%`,
                          backgroundColor: p.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Top Contractors Table — full width */}
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
              {he ? 'קבלנים מובילים' : 'Top Contractors'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table-sticky w-full text-sm" style={{ color: '#2d3a2e' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e6e2' }}>
                  <th className="text-start pb-3 font-semibold" style={{ color: '#6b7c6e' }}>#</th>
                  <th className="text-start pb-3 font-semibold" style={{ color: '#6b7c6e' }}>
                    {he ? 'שם' : 'Name'}
                  </th>
                  <th className="text-start pb-3 font-semibold" style={{ color: '#6b7c6e' }}>
                    {he ? 'מקצוע' : 'Profession'}
                  </th>
                  <th className="text-start pb-3 font-semibold" style={{ color: '#6b7c6e' }}>
                    {he ? 'לידים' : 'Leads Received'}
                  </th>
                  <th className="text-start pb-3 font-semibold" style={{ color: '#6b7c6e', minWidth: 160 }}>
                    {he ? 'אחוז השלמה' : 'Completion Rate'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {topContractors.map((c, i) => (
                  <tr key={c.name} style={{ borderBottom: '1px solid #f0f0ee' }}>
                    <td className="py-3 font-semibold" style={{ color: '#9ca89e' }}>
                      {i + 1}
                    </td>
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3" style={{ color: '#6b7c6e' }}>
                      {c.profession}
                    </td>
                    <td className="py-3 font-semibold">{c.leadsReceived}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="rounded-full"
                          style={{ height: 8, width: 80, backgroundColor: '#f0f0ee' }}
                        >
                          <div
                            className="rounded-full"
                            style={{
                              height: '100%',
                              width: `${c.completionRate}%`,
                              backgroundColor: rateColor(c.completionRate),
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: '#6b7c6e' }}>
                          {c.completionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
