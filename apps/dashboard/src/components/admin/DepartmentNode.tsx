import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import type { DepartmentDef } from '../../config/departmentConfig'
import type { AdminKPIs } from '../../hooks/useAdminKPIs'

interface DepartmentNodeData {
  department: DepartmentDef
  kpis: AdminKPIs
  locale: 'en' | 'he'
}

/** Urgency tier based on primary KPI value */
function getUrgencyTier(val: number): 'hot' | 'warm' | 'idle' {
  if (val >= 10) return 'hot'
  if (val >= 1) return 'warm'
  return 'idle'
}

const urgencyStyles = {
  hot: {
    ringOpacity: '60',
    pulseClass: 'animate-pulse',
    badgeBg: 'bg-red-500/20 border-red-500/40 text-red-400',
    badgeText: 'URGENT',
  },
  warm: {
    ringOpacity: '40',
    pulseClass: '',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    badgeText: 'ACTIVE',
  },
  idle: {
    ringOpacity: '20',
    pulseClass: '',
    badgeBg: 'bg-white/5 border-white/10 text-white/30',
    badgeText: 'IDLE',
  },
}

function DepartmentNodeComponent({ data }: NodeProps) {
  const { department: dept, kpis, locale } = data as unknown as DepartmentNodeData
  const navigate = useNavigate()
  const he = locale === 'he'
  const Icon = dept.icon

  // Compute KPI values
  const primaryKpi = dept.kpis[0]
  const primaryVal = Number(kpis[primaryKpi?.key] ?? 0)
  const tier = getUrgencyTier(primaryVal)
  const urgency = urgencyStyles[tier]

  let primaryDisplay: string
  if (primaryKpi?.format === 'currency') primaryDisplay = `$${primaryVal.toLocaleString()}`
  else if (primaryKpi?.format === 'percent') primaryDisplay = `${primaryVal}%`
  else primaryDisplay = String(primaryVal)

  // Count pending actions across all KPIs
  const totalPending = dept.kpis.reduce((sum, kpi) => {
    const v = Number(kpis[kpi.key] ?? 0)
    return sum + v
  }, 0)

  return (
    <>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />

      <div
        onClick={() => navigate(`/admin/${dept.basePath}`)}
        className="group cursor-pointer transition-all duration-500 hover:scale-[1.04] hover:-translate-y-1 relative"
        dir={he ? 'rtl' : 'ltr'}
      >
        {/* Glow ring — intensity based on urgency */}
        <div
          className={`absolute -inset-[2px] rounded-[20px] transition-all duration-500 group-hover:opacity-80 ${urgency.pulseClass}`}
          style={{
            opacity: tier === 'hot' ? 0.7 : 0.4,
            background: `linear-gradient(135deg, ${dept.color}${urgency.ringOpacity}, transparent 60%, ${dept.color}${urgency.ringOpacity === '60' ? '30' : '15'})`,
            filter: `blur(${tier === 'hot' ? 2 : 1}px)`,
          }}
        />

        {/* Card shell */}
        <div
          className="relative rounded-[18px] overflow-hidden w-[340px]"
          style={{
            background: `linear-gradient(160deg, ${dept.color}0a 0%, #0c0c20 35%, #0a0a18 100%)`,
            border: `1px solid ${dept.color}${tier === 'hot' ? '50' : '25'}`,
            boxShadow: `
              0 0 40px ${dept.color}${tier === 'hot' ? '18' : '08'},
              inset 0 1px 0 ${dept.color}10,
              0 20px 60px rgba(0,0,0,0.4)
            `,
          }}
        >
          {/* Top accent gradient line */}
          <div
            className="h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent 5%, ${dept.color}80 30%, ${dept.color} 50%, ${dept.color}80 70%, transparent 95%)`,
            }}
          />

          {/* Watermark icon */}
          <div className="absolute top-3 right-3 opacity-[0.03] pointer-events-none">
            <Icon style={{ width: 120, height: 120, color: dept.color }} />
          </div>

          {/* Content */}
          <div className="p-5 pb-4 relative">
            {/* Header: icon + name + urgency badge */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg, ${dept.color}20, ${dept.color}08)`,
                    border: `1px solid ${dept.color}30`,
                    boxShadow: `0 0 12px ${dept.color}15`,
                  }}
                >
                  <Icon className="w-[18px] h-[18px]" style={{ color: dept.color }} />
                </div>
                <div>
                  <div
                    className="text-[14px] font-extrabold uppercase tracking-[0.08em] leading-tight"
                    style={{ color: dept.color }}
                  >
                    {he ? dept.nameHe : dept.nameEn}
                  </div>
                  <div className="text-[9px] text-white/20 uppercase tracking-[0.15em] mt-0.5">
                    {dept.tabs.length} {he ? 'מודולים' : 'modules'}
                  </div>
                </div>
              </div>

              {/* Urgency badge */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[8px] font-bold uppercase tracking-[0.15em] ${urgency.badgeBg}`}>
                {tier === 'hot' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_6px_rgba(248,113,113,0.8)]" />
                )}
                {tier === 'warm' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                )}
                {tier === 'idle' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                )}
                {urgency.badgeText}
              </div>
            </div>

            {/* Primary KPI — big number */}
            <div className="mb-4">
              <div
                className="text-[42px] font-black tabular-nums leading-none tracking-tight transition-all duration-300"
                style={{
                  color: dept.color,
                  textShadow: tier === 'hot' ? `0 0 20px ${dept.color}40` : 'none',
                }}
              >
                {primaryDisplay}
              </div>
              <div className="text-[10px] text-white/30 mt-1.5 uppercase tracking-[0.15em] font-medium">
                {he ? primaryKpi?.labelHe : primaryKpi?.labelEn}
              </div>
            </div>

            {/* Secondary KPIs row */}
            <div
              className="flex gap-4 pt-3.5"
              style={{ borderTop: `1px solid ${dept.color}10` }}
            >
              {dept.kpis.slice(1).map((kpi) => {
                const val = kpis[kpi.key]
                let display: string
                if (kpi.format === 'currency') display = `$${Number(val ?? 0).toLocaleString()}`
                else if (kpi.format === 'percent') display = `${val ?? 0}%`
                else display = String(val ?? 0)

                return (
                  <div key={kpi.key} className="flex-1 min-w-0">
                    <div className="text-[20px] font-bold text-white/85 tabular-nums leading-tight">
                      {display}
                    </div>
                    <div className="text-[8px] text-white/25 uppercase tracking-[0.12em] truncate mt-0.5 font-medium">
                      {he ? kpi.labelHe : kpi.labelEn}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom bar: notification count + enter CTA */}
          <div
            className="flex items-center justify-between px-5 py-2.5 transition-all duration-300"
            style={{ background: `${dept.color}06`, borderTop: `1px solid ${dept.color}08` }}
          >
            {/* Pending count */}
            {totalPending > 0 ? (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black"
                  style={{ background: `${dept.color}25`, color: dept.color }}
                >
                  {totalPending}
                </div>
                <span className="text-[9px] text-white/25 uppercase tracking-wider">
                  {he ? 'פעולות' : 'actions'}
                </span>
              </div>
            ) : (
              <div className="text-[9px] text-white/15 uppercase tracking-wider">
                {he ? 'אין פעולות' : 'no actions'}
              </div>
            )}

            {/* Enter CTA — always visible, intensifies on hover */}
            <div
              className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-all duration-300"
              style={{ color: dept.color }}
            >
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold">
                {he ? 'היכנס' : 'Enter'}
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" className={he ? 'rotate-180' : ''}>
                <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default memo(DepartmentNodeComponent)
