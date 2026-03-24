import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface AutomationDef {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  interval: string
  color: string
}

export interface AutomationsListNodeData {
  stageColor: string
  automations: AutomationDef[]
}

function AutomationsListNodeComponent({ data }: NodeProps) {
  const d = data as unknown as AutomationsListNodeData

  return (
    <>
      <Handle type="target" position={Position.Left}
        className="!w-1.5 !h-1.5 !border-0 !rounded-full"
        style={{ background: d.stageColor, opacity: 0.3 }}
      />
      <Handle type="source" position={Position.Right}
        className="!w-1.5 !h-1.5 !border-0 !rounded-full"
        style={{ background: d.stageColor, opacity: 0.3 }}
      />
      <div
        className="rounded-xl border border-black/[0.06] overflow-hidden"
        style={{
          width: 260,
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-black/[0.04]" style={{ background: '#fafafa' }}>
          <div className="w-1 h-3.5 rounded-full bg-[#5856D6]" />
          <span className="text-[10px] font-bold text-[#1C1C1E] uppercase tracking-[0.08em]">Automations</span>
          <span className="text-[8px] text-[#8E8E93] ml-auto">{d.automations.length} active</span>
        </div>
        {d.automations.length === 0 ? (
          <p className="text-[9px] text-[#8E8E93] italic px-3 py-3">No automations</p>
        ) : (
          <div className="p-2 space-y-1">
            {d.automations.map((auto) => {
              const Icon = auto.icon
              return (
                <div
                  key={auto.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                  style={{ background: `${auto.color}06`, border: `1px solid ${auto.color}12` }}
                >
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: `${auto.color}15`, border: `1px solid ${auto.color}20`,
                    }}
                  >
                    <Icon style={{ width: 13, height: 13, color: auto.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#1C1C1E] leading-tight">{auto.name}</p>
                    <p className="text-[8px] text-[#8E8E93]">{auto.interval}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
                    <span className="text-[7px] text-[#34C759] font-bold uppercase">On</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

export default memo(AutomationsListNodeComponent)
