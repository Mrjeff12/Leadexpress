import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronRight, PlayCircle } from 'lucide-react'

export interface TransitionRule {
  from: string
  to: string
  trigger: string
  color: string
}

export interface TransitionRulesNodeData {
  stageColor: string
  rules: TransitionRule[]
}

function TransitionRulesNodeComponent({ data }: NodeProps) {
  const d = data as unknown as TransitionRulesNodeData

  return (
    <>
      <Handle type="target" position={Position.Left}
        className="!w-1.5 !h-1.5 !border-0 !rounded-full"
        style={{ background: d.stageColor, opacity: 0.3 }}
      />
      <div
        className="rounded-xl border border-black/[0.06] overflow-hidden"
        style={{
          width: 280,
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-black/[0.04]" style={{ background: '#fafafa' }}>
          <div className="w-1 h-3.5 rounded-full bg-[#FF9500]" />
          <span className="text-[10px] font-bold text-[#1C1C1E] uppercase tracking-[0.08em]">Transition Rules</span>
          <span className="text-[8px] text-[#8E8E93] ml-auto">{d.rules.length}</span>
        </div>
        {d.rules.length === 0 ? (
          <p className="text-[9px] text-[#8E8E93] italic px-3 py-3">No rules defined</p>
        ) : (
          <div className="p-2 space-y-1">
            {d.rules.map((rule, i) => (
              <div key={i} className="px-2.5 py-1.5 rounded-lg" style={{ background: `${rule.color}05`, border: `1px solid ${rule.color}10` }}>
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${rule.color}12`, color: rule.color }}>
                    {rule.from}
                  </span>
                  <ChevronRight className="w-2.5 h-2.5 text-[#C7C7CC]" />
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${rule.color}12`, color: rule.color }}>
                    {rule.to}
                  </span>
                </div>
                <p className="text-[8px] text-[#8E8E93] leading-relaxed flex items-center gap-1">
                  <PlayCircle className="w-2.5 h-2.5 text-[#C7C7CC] shrink-0" />
                  {rule.trigger}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default memo(TransitionRulesNodeComponent)
