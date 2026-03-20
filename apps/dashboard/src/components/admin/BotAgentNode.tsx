import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Cpu, Zap } from 'lucide-react'

export interface BotAgentNodeData {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  color: string
  model: string
  is_active: boolean
  is_entry_point: boolean
  tool_count: number
  onSelect: (agent: BotAgentNodeData) => void
}

function BotAgentNodeComponent({ data }: NodeProps) {
  const agent = data as unknown as BotAgentNodeData

  const glowColor = agent.color || '#8b5cf6'

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full"
        style={{
          background: '#0a0a1a',
          borderColor: glowColor,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !border-2 !rounded-full"
        style={{
          background: '#0a0a1a',
          borderColor: glowColor,
        }}
      />

      <div
        onClick={() => agent.onSelect?.(agent)}
        className="cursor-pointer flex flex-col items-center justify-center relative"
        style={{
          width: 120,
          height: 140,
          background: '#12122a',
          borderRadius: 16,
          border: `1.5px solid ${glowColor}44`,
          boxShadow: `0 0 20px ${glowColor}25, 0 0 40px ${glowColor}10, inset 0 1px 0 rgba(255,255,255,0.04)`,
          animation: agent.is_entry_point ? 'pulse-glow 2s ease-in-out infinite' : undefined,
        }}
      >
        {/* Pulse animation keyframes injected via style tag */}
        {agent.is_entry_point && (
          <style>{`
            @keyframes pulse-glow {
              0%, 100% { box-shadow: 0 0 20px ${glowColor}25, 0 0 40px ${glowColor}10; }
              50% { box-shadow: 0 0 30px ${glowColor}50, 0 0 60px ${glowColor}25, 0 0 80px ${glowColor}10; }
            }
          `}</style>
        )}

        {/* Active indicator dot */}
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{
            background: agent.is_active ? '#22c55e' : '#6b7280',
            boxShadow: agent.is_active ? '0 0 6px #22c55e80' : 'none',
          }}
        />

        {/* Entry point bolt icon */}
        {agent.is_entry_point && (
          <Zap
            className="absolute top-1.5 left-1.5 w-3 h-3"
            style={{ color: glowColor, filter: `drop-shadow(0 0 3px ${glowColor})` }}
          />
        )}

        {/* Agent emoji icon */}
        <div
          className="text-3xl leading-none select-none mb-1.5"
          style={{ filter: `drop-shadow(0 0 8px ${glowColor}60)` }}
        >
          {agent.icon || '🤖'}
        </div>

        {/* Agent name */}
        <div
          className="text-[11px] font-semibold text-center leading-tight px-2 mb-1 truncate w-full"
          style={{ color: '#e2e8f0' }}
        >
          {agent.name}
        </div>

        {/* Tool count */}
        {agent.tool_count > 0 && (
          <div className="flex items-center gap-0.5 mb-1">
            <Cpu className="w-2.5 h-2.5" style={{ color: '#64748b' }} />
            <span className="text-[9px]" style={{ color: '#64748b' }}>
              {agent.tool_count} tool{agent.tool_count !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Model badge */}
        <div
          className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
          style={{
            background: `${glowColor}15`,
            color: glowColor,
            border: `1px solid ${glowColor}30`,
          }}
        >
          {agent.model || 'gpt-4o-mini'}
        </div>
      </div>
    </>
  )
}

export default memo(BotAgentNodeComponent)
