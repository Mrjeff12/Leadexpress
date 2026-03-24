import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Edit3, Check, X, Bell, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle } from 'lucide-react'

export interface NudgeWave {
  wave: number
  delay: string
  message: string
}

export interface FlowStepNodeData {
  stepLabel: string
  subStatusKey: string
  count: number
  color: string
  stageColor: string
  trigger?: string
  template?: any
  automation?: { name: string; interval: string; icon: React.ComponentType<any>; color: string }
  nudges?: NudgeWave[]
  isFirst: boolean
  isLast: boolean
  onSave?: (id: string, body: string) => Promise<void>
}

function FlowStepNodeComponent({ data }: NodeProps) {
  const d = data as unknown as FlowStepNodeData
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

  const t = d.template

  function startEdit() {
    if (!t) return
    setEditing(true)
    setEditBody(t.body_template)
  }

  async function saveEdit() {
    if (!d.onSave || !t) return
    setSaving(true)
    await d.onSave(t.id, editBody)
    setSaving(false)
    setEditing(false)
  }

  const replyRate = t && t.send_count > 0 ? (t.reply_count / t.send_count) : 0
  const rateColor = replyRate > 0.1 ? '#34C759' : replyRate > 0 ? '#FF9500' : '#C7C7CC'

  return (
    <>
      {!d.isFirst && (
        <Handle type="target" position={Position.Left}
          className="!w-2.5 !h-2.5 !border-2 !rounded-full"
          style={{ background: '#fff', borderColor: d.stageColor }}
        />
      )}
      {!d.isLast && (
        <Handle type="source" position={Position.Right}
          className="!w-2.5 !h-2.5 !border-2 !rounded-full"
          style={{ background: '#fff', borderColor: d.stageColor }}
        />
      )}

      <div
        className="rounded-2xl border overflow-hidden nopan nodrag"
        style={{
          width: 260,
          background: '#ffffff',
          borderColor: editing ? `${d.stageColor}40` : 'rgba(0,0,0,0.06)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* ── Step header ── */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{
            background: `linear-gradient(135deg, ${d.color}10, ${d.color}20)`,
            borderBottom: `1px solid ${d.color}15`,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-[11px] font-bold text-[#1C1C1E]">{d.stepLabel}</span>
          </div>
          <span className="text-[12px] font-black tabular-nums" style={{ color: d.count > 0 ? d.color : '#D1D1D6' }}>
            {d.count}
          </span>
        </div>

        {/* ── Trigger line ── */}
        {d.trigger && (
          <div className="px-3 py-1.5 border-b border-black/[0.04]" style={{ background: '#fafafa' }}>
            <p className="text-[8px] text-[#8E8E93] leading-relaxed">{d.trigger}</p>
          </div>
        )}

        {/* ── Automation badge ── */}
        {d.automation && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-black/[0.04]" style={{ background: `${d.automation.color}05` }}>
            <d.automation.icon style={{ width: 12, height: 12, color: d.automation.color }} />
            <span className="text-[8px] font-semibold text-[#3A3A3C]">{d.automation.name}</span>
            <span className="text-[7px] text-[#8E8E93] ml-auto">{d.automation.interval}</span>
          </div>
        )}

        {/* ── Template message ── */}
        {t && !editing && (
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-[#8E8E93]">
                {t.name?.replace(/_/g, ' ')}
              </span>
              <div className="flex items-center gap-1.5">
                {/* Meta approval badge */}
                {t.meta_approval_status && (
                  <span className="flex items-center gap-0.5 text-[7px] font-semibold px-1.5 py-0.5 rounded-full" style={{
                    background: t.meta_approval_status === 'approved' ? 'rgba(52,199,89,0.12)' : t.meta_approval_status === 'rejected' ? 'rgba(255,59,48,0.12)' : 'rgba(255,149,0,0.12)',
                    color: t.meta_approval_status === 'approved' ? '#34C759' : t.meta_approval_status === 'rejected' ? '#FF3B30' : '#FF9500',
                  }}>
                    {t.meta_approval_status === 'approved' ? <CheckCircle2 className="w-2.5 h-2.5" /> : t.meta_approval_status === 'rejected' ? <XCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                    {t.meta_approval_status === 'approved' ? 'Meta ✓' : t.meta_approval_status === 'rejected' ? 'Rejected' : 'Pending'}
                  </span>
                )}
                {t.send_count > 0 && (
                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${rateColor}15`, color: rateColor }}>
                    {t.send_count} · {(replyRate * 100).toFixed(0)}%
                  </span>
                )}
                <button
                  onClick={startEdit}
                  className="p-1 rounded-md hover:bg-black/[0.06] text-[#8E8E93] hover:text-[#007AFF] transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[#3A3A3C] leading-relaxed whitespace-pre-line" dir="rtl">
              {t.body_template}
            </p>
          </div>
        )}

        {/* ── Edit mode ── */}
        {t && editing && (
          <div className="p-3">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              dir="rtl"
              rows={4}
              className="w-full text-[10px] text-[#1C1C1E] leading-relaxed p-2 rounded-lg border border-[#007AFF]/30 bg-[#F0F4FF]/50 focus:outline-none focus:border-[#007AFF] resize-none"
            />
            <div className="flex items-center justify-end gap-1.5 mt-1.5">
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-semibold text-[#8E8E93] hover:bg-black/[0.04]">
                <X className="w-2.5 h-2.5" /> Cancel
              </button>
              <button onClick={saveEdit}
                disabled={saving || editBody === t.body_template}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[8px] font-bold text-white disabled:opacity-40"
                style={{ background: '#007AFF' }}>
                {saving ? <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                Save
              </button>
            </div>
          </div>
        )}

        {/* ── No template — just a status step ── */}
        {!t && !d.trigger && !d.automation && !d.nudges && (
          <div className="px-3 py-2">
            <p className="text-[9px] text-[#C7C7CC] italic">No message at this step</p>
          </div>
        )}

        {/* ── Nudge waves (onboarding reminders) ── */}
        {d.nudges && d.nudges.length > 0 && (
          <NudgeSection nudges={d.nudges} color={d.stageColor} />
        )}
      </div>
    </>
  )
}

function NudgeSection({ nudges, color }: { nudges: NudgeWave[]; color: string }) {
  const [expanded, setExpanded] = useState(true)
  const WAVE_COLORS = ['#34C759', '#FF9500', '#FF3B30', '#8E8E93']

  return (
    <div className="border-t border-black/[0.04]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-black/[0.02] transition-colors nopan nodrag"
      >
        <div className="flex items-center gap-1.5">
          <Bell className="w-3 h-3 text-[#FF9500]" />
          <span className="text-[8px] font-bold text-[#8E8E93] uppercase tracking-wider">Nudges</span>
          <span className="text-[7px] text-[#C7C7CC]">{nudges.length} waves</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3 text-[#C7C7CC]" /> : <ChevronDown className="w-3 h-3 text-[#C7C7CC]" />}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {nudges.map((nudge) => (
            <div
              key={nudge.wave}
              className="rounded-lg px-2.5 py-1.5"
              style={{
                background: `${WAVE_COLORS[nudge.wave - 1]}06`,
                border: `1px solid ${WAVE_COLORS[nudge.wave - 1]}15`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white"
                  style={{ background: WAVE_COLORS[nudge.wave - 1] }}
                >
                  {nudge.wave}
                </div>
                <span className="text-[8px] font-bold text-[#3A3A3C]">גל {nudge.wave}</span>
                <span className="text-[7px] text-[#8E8E93] ml-auto">{nudge.delay}</span>
              </div>
              <p className="text-[8px] text-[#3A3A3C] leading-relaxed whitespace-pre-line" dir="rtl">
                {nudge.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default memo(FlowStepNodeComponent)
