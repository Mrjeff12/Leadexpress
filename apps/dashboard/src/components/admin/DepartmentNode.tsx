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

function DepartmentNodeComponent({ data }: NodeProps) {
  const { department: dept, kpis, locale } = data as unknown as DepartmentNodeData
  const navigate = useNavigate()
  const he = locale === 'he'
  const Icon = dept.icon

  // Primary KPI (big number)
  const primaryKpi = dept.kpis[0]
  const primaryVal = kpis[primaryKpi?.key] ?? 0
  let primaryDisplay: string
  if (primaryKpi?.format === 'currency') primaryDisplay = `$${Number(primaryVal).toLocaleString()}`
  else if (primaryKpi?.format === 'percent') primaryDisplay = `${primaryVal}%`
  else primaryDisplay = String(primaryVal)

  return (
    <>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />

      <div
        onClick={() => navigate(`/admin/${dept.basePath}`)}
        className="group cursor-pointer transition-all duration-500 hover:scale-[1.05] relative"
        dir={he ? 'rtl' : 'ltr'}
      >
        {/* Outer glow */}
        <div
          className="absolute -inset-[1px] rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `linear-gradient(135deg, ${dept.color}40, transparent 50%, ${dept.color}20)`,
            filter: 'blur(1px)',
          }}
        />

        {/* Card body */}
        <div
          className="relative rounded-2xl overflow-hidden w-[320px]"
          style={{
            background: `linear-gradient(145deg, ${dept.color}08 0%, #0d0d1a 40%, ${dept.color}05 100%)`,
            border: `1px solid ${dept.color}30`,
            boxShadow: `0 0 30px ${dept.color}10, inset 0 1px 0 ${dept.color}15`,
          }}
        >
          {/* Background watermark icon */}
          <div className="absolute -top-2 -right-2 opacity-[0.04] pointer-events-none">
            <Icon className="w-28 h-28" style={{ color: dept.color }} />
          </div>

          {/* Animated top accent line */}
          <div
            className="h-[2px] w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${dept.color}, transparent)`,
            }}
          />

          <div className="p-5 relative">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${dept.color}18`, border: `1px solid ${dept.color}30` }}
                >
                  <Icon className="w-4 h-4" style={{ color: dept.color }} />
                </div>
                <div>
                  <div className="text-[13px] font-bold uppercase tracking-wider" style={{ color: dept.color }}>
                    {he ? dept.nameHe : dept.nameEn}
                  </div>
                  <div className="text-[9px] text-white/25 uppercase tracking-[0.15em]">
                    {dept.tabs.length} {he ? 'מודולים' : 'modules'}
                  </div>
                </div>
              </div>

              {/* Status dot */}
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: dept.color, boxShadow: `0 0 6px ${dept.color}` }}
                />
                <span className="text-[9px] text-white/30 uppercase tracking-wider">
                  {he ? 'פעיל' : 'active'}
                </span>
              </div>
            </div>

            {/* Big primary KPI */}
            <div className="mb-4">
              <div
                className="text-[36px] font-black tabular-nums leading-none tracking-tight"
                style={{ color: dept.color }}
              >
                {primaryDisplay}
              </div>
              <div className="text-[11px] text-white/35 mt-1 uppercase tracking-wider">
                {he ? primaryKpi?.labelHe : primaryKpi?.labelEn}
              </div>
            </div>

            {/* Secondary KPIs */}
            <div
              className="flex gap-3 pt-3"
              style={{ borderTop: `1px solid ${dept.color}12` }}
            >
              {dept.kpis.slice(1).map((kpi) => {
                const val = kpis[kpi.key]
                let display: string
                if (kpi.format === 'currency') display = `$${Number(val ?? 0).toLocaleString()}`
                else if (kpi.format === 'percent') display = `${val ?? 0}%`
                else display = String(val ?? 0)

                return (
                  <div key={kpi.key} className="flex-1 min-w-0">
                    <div className="text-[18px] font-bold text-white/80 tabular-nums">
                      {display}
                    </div>
                    <div className="text-[9px] text-white/30 uppercase tracking-wider truncate">
                      {he ? kpi.labelHe : kpi.labelEn}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom hover indicator */}
          <div
            className="h-8 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 -mt-1"
            style={{ background: `${dept.color}08` }}
          >
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: `${dept.color}90` }}>
              {he ? 'היכנס' : 'Enter'}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" className={he ? 'rotate-180' : ''}>
              <path d="M3 1 L7 5 L3 9" fill="none" stroke={dept.color} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </>
  )
}

export default memo(DepartmentNodeComponent)
