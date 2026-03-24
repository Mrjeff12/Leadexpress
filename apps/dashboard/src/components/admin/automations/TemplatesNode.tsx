import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Edit3, Check, X, Send } from 'lucide-react'

export interface TemplatesNodeData {
  stageColor: string
  stageId: string
  templates: any[]
  onSave?: (id: string, body: string) => Promise<void>
}

function TemplatesNodeComponent({ data }: NodeProps) {
  const d = data as unknown as TemplatesNodeData
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(t: any) {
    setEditingId(t.id)
    setEditBody(t.body_template)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
  }

  async function saveEdit(id: string) {
    if (!d.onSave) return
    setSaving(true)
    await d.onSave(id, editBody)
    setSaving(false)
    setEditingId(null)
  }

  return (
    <>
      <Handle type="target" position={Position.Left}
        className="!w-1.5 !h-1.5 !border-0 !rounded-full"
        style={{ background: d.stageColor, opacity: 0.3 }}
      />
      <div
        className="rounded-xl border border-black/[0.06] overflow-hidden"
        style={{
          width: 300,
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-black/[0.04]" style={{ background: '#fafafa' }}>
          <div className="w-1 h-3.5 rounded-full bg-[#007AFF]" />
          <span className="text-[10px] font-bold text-[#1C1C1E] uppercase tracking-[0.08em]">Templates</span>
          <span className="text-[8px] text-[#8E8E93] ml-auto">{d.templates.length}</span>
        </div>
        {d.templates.length === 0 ? (
          <p className="text-[9px] text-[#8E8E93] italic px-3 py-3">No templates for this stage</p>
        ) : (
          <div className="p-2 space-y-1.5 max-h-[280px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {d.templates.map((t: any) => {
              const isEditing = editingId === t.id

              return (
                <div key={t.id} className="rounded-lg border border-black/[0.04] overflow-hidden" style={{ background: isEditing ? '#F0F4FF' : '#F5F5F7' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-[#1C1C1E]">Touch {t.touch_number}</span>
                      <span className="text-[8px] text-[#8E8E93]">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {t.send_count > 0 && (
                        <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full" style={{
                          background: (t.reply_count / t.send_count) > 0.1 ? '#34C75915' : '#FF950015',
                          color: (t.reply_count / t.send_count) > 0.1 ? '#34C759' : '#FF9500',
                        }}>
                          {t.send_count} sent · {((t.reply_count / t.send_count) * 100).toFixed(0)}%
                        </span>
                      )}
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(t)}
                          className="p-1 rounded-md hover:bg-black/[0.06] text-[#8E8E93] hover:text-[#007AFF] transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body — view or edit */}
                  {isEditing ? (
                    <div className="px-2.5 pb-2">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        dir="rtl"
                        rows={4}
                        className="w-full text-[10px] text-[#1C1C1E] leading-relaxed p-2 rounded-lg border border-[#007AFF]/30 bg-white focus:outline-none focus:border-[#007AFF] resize-none"
                        style={{ scrollbarWidth: 'thin' }}
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[7px] text-[#8E8E93]">
                          Variables: {'{name}'} {'{group_name}'} {'{lead_count}'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-semibold text-[#8E8E93] hover:bg-black/[0.04] transition-colors"
                          >
                            <X className="w-2.5 h-2.5" /> Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(t.id)}
                            disabled={saving || editBody === t.body_template}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[8px] font-bold text-white transition-colors disabled:opacity-40"
                            style={{ background: '#007AFF' }}
                          >
                            {saving ? (
                              <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Check className="w-2.5 h-2.5" />
                            )}
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-2.5 pb-2">
                      <p className="text-[9px] text-[#3A3A3C] leading-relaxed whitespace-pre-line line-clamp-3" dir="rtl">
                        {t.body_template}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

export default memo(TemplatesNodeComponent)
