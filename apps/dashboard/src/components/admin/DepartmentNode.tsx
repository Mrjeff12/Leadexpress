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

  return (
    <>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />

      <div
        onClick={() => navigate(`/admin/${dept.basePath}`)}
        className="group cursor-pointer transition-all duration-300 hover:scale-[1.03] rounded-2xl p-5 w-[280px]"
        style={{
          background: `${dept.color}12`,
          border: `2px solid ${dept.color}`,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 0 20px ${dept.color}15`,
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${dept.color}35`
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${dept.color}15`
        }}
        dir={he ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5" style={{ color: dept.color }} />
          <span className="text-[20px] font-bold" style={{ color: dept.color }}>
            {he ? dept.nameHe : dept.nameEn}
          </span>
        </div>

        <div className="space-y-2">
          {dept.kpis.map((kpi, i) => {
            const val = kpis[kpi.key]
            let display: string
            if (kpi.format === 'currency') display = `$${Number(val ?? 0).toLocaleString()}`
            else if (kpi.format === 'percent') display = `${val ?? 0}%`
            else display = String(val ?? 0)

            return (
              <div key={kpi.key} className="flex items-baseline gap-2">
                <span className={`text-[16px] font-semibold tabular-nums ${i === 0 ? 'text-white' : 'text-white/60'}`}>
                  {display}
                </span>
                <span className="text-[13px] text-white/40">
                  {he ? kpi.labelHe : kpi.labelEn}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default memo(DepartmentNodeComponent)
