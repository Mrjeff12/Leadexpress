import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import type { DepartmentDef } from '../../config/departmentConfig'
import type { AdminKPIs } from '../../hooks/useAdminKPIs'
import {
  Target,
  HardHat,
  MessageCircle,
  Coins,
  BarChart3,
  Handshake,
  Settings,
} from 'lucide-react'

interface DepartmentNodeData {
  department: DepartmentDef
  kpis: AdminKPIs
  locale: 'en' | 'he'
}

/* ─── Per-department icon identity ─── */
const DEPT_ICONS: Record<string, {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  gradient: string
  shadow: string
}> = {
  warroom: {
    Icon: Target,
    gradient: 'linear-gradient(145deg, #ff8a5c 0%, #ff6b35 45%, #e85520 100%)',
    shadow: '0 8px 24px rgba(255,107,53,0.35), 0 2px 8px rgba(255,107,53,0.2)',
  },
  clients: {
    Icon: HardHat,
    gradient: 'linear-gradient(145deg, #34d399 0%, #10b981 45%, #059669 100%)',
    shadow: '0 8px 24px rgba(16,185,129,0.35), 0 2px 8px rgba(16,185,129,0.2)',
  },
  channels: {
    Icon: MessageCircle,
    gradient: 'linear-gradient(145deg, #a78bfa 0%, #8b5cf6 45%, #7c3aed 100%)',
    shadow: '0 8px 24px rgba(139,92,246,0.35), 0 2px 8px rgba(139,92,246,0.2)',
  },
  finance: {
    Icon: Coins,
    gradient: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 45%, #d97706 100%)',
    shadow: '0 8px 24px rgba(245,158,11,0.35), 0 2px 8px rgba(245,158,11,0.2)',
  },
  intel: {
    Icon: BarChart3,
    gradient: 'linear-gradient(145deg, #60a5fa 0%, #3b82f6 45%, #2563eb 100%)',
    shadow: '0 8px 24px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2)',
  },
  partners: {
    Icon: Handshake,
    gradient: 'linear-gradient(145deg, #f472b6 0%, #ec4899 45%, #db2777 100%)',
    shadow: '0 8px 24px rgba(236,72,153,0.35), 0 2px 8px rgba(236,72,153,0.2)',
  },
  settings: {
    Icon: Settings,
    gradient: 'linear-gradient(145deg, #9ca3af 0%, #6b7280 45%, #4b5563 100%)',
    shadow: '0 8px 24px rgba(107,114,128,0.3), 0 2px 8px rgba(107,114,128,0.15)',
  },
}

function DepartmentNodeComponent({ data }: NodeProps) {
  const { department: dept, kpis, locale } = data as unknown as DepartmentNodeData
  const navigate = useNavigate()
  const he = locale === 'he'

  const visual = DEPT_ICONS[dept.id] ?? DEPT_ICONS.settings
  const { Icon } = visual

  // Primary KPI for badge
  const primaryKpi = dept.kpis[0]
  const primaryVal = Number(kpis[primaryKpi?.key] ?? 0)
  let badge: string | null = null
  if (primaryVal > 0) {
    if (primaryKpi?.format === 'currency') badge = `$${primaryVal}`
    else if (primaryKpi?.format === 'percent') badge = `${primaryVal}%`
    else badge = String(primaryVal)
  }

  // Secondary stat
  const secondaryKpi = dept.kpis[1]
  const secondaryVal = secondaryKpi ? Number(kpis[secondaryKpi.key] ?? 0) : null
  let secondaryDisplay: string | null = null
  if (secondaryKpi && secondaryVal !== null) {
    if (secondaryKpi.format === 'currency') secondaryDisplay = `$${secondaryVal}`
    else if (secondaryKpi.format === 'percent') secondaryDisplay = `${secondaryVal}%`
    else secondaryDisplay = String(secondaryVal)
  }

  return (
    <>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-0 !h-0" />

      <div
        onClick={() => navigate(`/admin/${dept.basePath}`)}
        className="group cursor-pointer flex flex-col items-center w-[160px]"
        dir={he ? 'rtl' : 'ltr'}
      >
        {/* App icon squircle */}
        <div className="relative mb-3">
          <div
            className="w-[100px] h-[100px] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
            style={{
              background: visual.gradient,
              borderRadius: '24px',
              boxShadow: visual.shadow,
            }}
          >
            {/* Subtle inner highlight */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: '24px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 50%)',
              }}
            />
            <Icon className="w-10 h-10 text-white relative z-10" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }} />
          </div>

          {/* Notification badge (like iOS red badge) */}
          {badge && (
            <div
              className="absolute -top-1.5 -right-1.5 min-w-[24px] h-[24px] px-1.5 rounded-full flex items-center justify-center text-white text-[11px] font-bold z-20"
              style={{
                background: 'linear-gradient(145deg, #ff4444 0%, #cc0000 100%)',
                boxShadow: '0 2px 6px rgba(204,0,0,0.4), 0 0 0 2px #faf9f6',
              }}
            >
              {badge}
            </div>
          )}
        </div>

        {/* App name */}
        <div className="text-[12px] font-semibold text-[#0b0707]/80 text-center leading-tight mb-1">
          {he ? dept.nameHe : dept.nameEn}
        </div>

        {/* Subtitle stat */}
        {secondaryDisplay !== null && (
          <div className="text-[10px] text-[#3b3b3b]/35 text-center font-medium">
            {secondaryDisplay} {he ? secondaryKpi?.labelHe : secondaryKpi?.labelEn}
          </div>
        )}
      </div>
    </>
  )
}

export default memo(DepartmentNodeComponent)
