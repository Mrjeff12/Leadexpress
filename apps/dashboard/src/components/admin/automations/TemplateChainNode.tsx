import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Edit3, Check, X } from 'lucide-react'

export interface TemplateChainNodeData {
  template: any
  stageColor: string
  touchIndex: number
  totalTouches: number
  isFirst: boolean
  isLast: boolean
  onSave?: (id: string, body: string) => Promise<void>
}

function TemplateChainNodeComponent({ data }: NodeProps) {
  const d = data as unknown as TemplateChainNodeData
  const t = d.template
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setEditing(true)
    setEditBody(t.body_template)
  }

  function cancelEdit() {
    setEditing(false)
    setEditBody('')
  }

  async function saveEdit() {
    if (!d.onSave) return
    setSaving(true)
    await d.onSave(t.id, editBody)
    setSaving(false)
    setEditing(false)
  }

  const replyRate = t.send_count > 0 ? (t.reply_count / t.send_count) : 0
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
        className="rounded-2xl border overflow-hidden transition-all duration-200"
        style={{
          width: editing ? 280 : 240,
          background: '#ffffff',
          borderColor: editing ? `${d.stageColor}40` : 'rgba(0,0,0,0.06)',
          boxShadow: editing
            ? `0 8px 32px ${d.stageColor}20, 0 2px 8px rgba(0,0,0,0.06)`
            : '0 4px 16px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* ── Touch header ── */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{
            background: `linear-gradient(135deg, ${d.stageColor}08, ${d.stageColor}15)`,
            borderBottom: `1px solid ${d.stageColor}12`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
              style={{ background: d.stageColor }}
            >
              {t.touch_number}
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#1C1C1E] leading-tight">Touch {t.touch_number}</p>
              <p className="text-[7px] text-[#8E8E93]">{t.name.replace(/_/g, ' ')}</p>
            </div>
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="p-1.5 rounded-lg hover:bg-white/60 text-[#8E8E93] hover:text-[#007AFF] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Stats bar ── */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-black/[0.04]" style={{ background: '#fafafa' }}>
          <span className="text-[8px] text-[#8E8E93]">{t.send_count} sent</span>
          <span className="text-[8px] text-[#8E8E93]">{t.reply_count} replies</span>
          {t.send_count > 0 && (
            <span className="text-[8px] font-bold ml-auto px-1.5 py-0.5 rounded-full" style={{ background: `${rateColor}15`, color: rateColor }}>
              {(replyRate * 100).toFixed(0)}% reply
            </span>
          )}
        </div>

        {/* ── Message body ── */}
        {editing ? (
          <div className="p-3">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              dir="rtl"
              rows={5}
              className="w-full text-[11px] text-[#1C1C1E] leading-relaxed p-2.5 rounded-xl border border-[#007AFF]/30 bg-[#F0F4FF]/50 focus:outline-none focus:border-[#007AFF] focus:bg-white resize-none transition-colors"
              style={{ scrollbarWidth: 'thin' }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[7px] text-[#8E8E93]">
                {'{name}'} {'{group_name}'} {'{lead_count}'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold text-[#8E8E93] hover:bg-black/[0.04] transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || editBody === t.body_template}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: '#007AFF' }}
                >
                  {saving ? (
                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-3 py-2.5">
            <p className="text-[10px] text-[#3A3A3C] leading-relaxed whitespace-pre-line" dir="rtl">
              {t.body_template}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default memo(TemplateChainNodeComponent)
