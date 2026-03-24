import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface SubStatusesNodeData {
  stageId: string
  stageColor: string
  subs: { key: string; label: string; color: string }[]
  counts: Record<string, number>
}

function SubStatusesNodeComponent({ data }: NodeProps) {
  const d = data as unknown as SubStatusesNodeData

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
          width: 280,
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-black/[0.04]" style={{ background: '#fafafa' }}>
          <div className="w-1 h-3.5 rounded-full" style={{ background: d.stageColor }} />
          <span className="text-[10px] font-bold text-[#1C1C1E] uppercase tracking-[0.08em]">Sub-Statuses</span>
          <span className="text-[8px] text-[#8E8E93] ml-auto">{d.subs.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-1 p-2">
          {d.subs.map((sub) => {
            const count = d.counts[sub.key] || 0
            return (
              <div
                key={sub.key}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                style={{
                  background: count > 0 ? `${sub.color}08` : '#fafafa',
                  border: `1px solid ${count > 0 ? sub.color + '18' : '#f0f0f0'}`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: sub.color, opacity: count > 0 ? 1 : 0.25 }} />
                  <span className="text-[9px] font-semibold text-[#3A3A3C]">{sub.label}</span>
                </div>
                <span className="text-[11px] font-black tabular-nums" style={{ color: count > 0 ? sub.color : '#D1D1D6' }}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default memo(SubStatusesNodeComponent)
