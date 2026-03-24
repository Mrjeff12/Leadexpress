import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface StageNodeData {
  id: string
  label: string
  count: number
  color: string
  gradient: [string, string]
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  automation?: string
  isSelected: boolean
  onToggle: (stageId: string) => void
}

function StageNodeComponent({ data }: NodeProps) {
  const d = data as unknown as StageNodeData
  const Icon = d.icon
  const size = 56

  return (
    <>
      <Handle type="target" position={Position.Left}
        className="!w-2 !h-2 !border-0 !rounded-full"
        style={{ background: d.color, opacity: 0.4 }}
      />
      <Handle type="source" position={Position.Right}
        className="!w-2 !h-2 !border-0 !rounded-full"
        style={{ background: d.color, opacity: 0.4 }}
      />

      <div
        onClick={() => d.onToggle(d.id)}
        className="cursor-pointer flex flex-col items-center group nopan nodrag"
      >
        <div
          className="relative flex items-center justify-center transition-all duration-300 group-hover:scale-105"
          style={{
            width: size, height: size,
            borderRadius: size * 0.28,
            background: `linear-gradient(145deg, ${d.gradient[0]}, ${d.gradient[1]})`,
            boxShadow: d.isSelected
              ? `0 0 0 3px #fff, 0 0 0 5px ${d.color}, 0 8px 32px ${d.color}50`
              : `0 6px 24px ${d.color}35, 0 2px 8px ${d.color}25`,
          }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{
            borderRadius: size * 0.28,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 50%)',
          }} />
          <Icon className="text-white relative z-10" style={{
            width: size * 0.45, height: size * 0.45,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
          }} />
        </div>
        <div className="text-[14px] font-black tabular-nums text-[#0b0707]/85 mt-1.5 leading-none">
          {d.count.toLocaleString()}
        </div>
        <div className="text-[7px] text-[#3b3b3b]/40 uppercase tracking-[0.1em] font-semibold mt-0.5 text-center max-w-[90px]">
          {d.label}
        </div>
      </div>
    </>
  )
}

export default memo(StageNodeComponent)
