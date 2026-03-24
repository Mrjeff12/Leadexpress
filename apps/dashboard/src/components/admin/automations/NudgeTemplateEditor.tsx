import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  FileText, ChevronDown, ChevronRight, Save, X, Loader2,
  RefreshCw, AlertCircle, Check, Edit3,
} from 'lucide-react'

interface MessageTemplate {
  id: string
  slug: string
  stage: string
  category: string
  touch_number: number
  delay_minutes: number
  body_template: string
  is_active: boolean
}

const STAGE_ORDER = ['onboarding', 'demo_trial', 'trial_expired', 'paying', 'churned']

const STAGE_META: Record<string, { label: string; color: string }> = {
  onboarding: { label: 'Onboarding', color: '#FF9500' },
  demo_trial: { label: 'Trial', color: '#AF52DE' },
  trial_expired: { label: 'Trial Expired', color: '#FF3B30' },
  paying: { label: 'Paying', color: '#34C759' },
  churned: { label: 'Churned', color: '#FF3B30' },
  first_touch: { label: 'First Touch', color: '#007AFF' },
  follow_up: { label: 'Follow-up', color: '#5856D6' },
  reactivation: { label: 'Reactivation', color: '#FF9500' },
}

function formatDelay(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`
  return `${Math.round(minutes / 1440)} day`
}

function highlightVariables(text: string): JSX.Element[] {
  const parts = text.split(/(\{[^}]+\})/)
  return parts.map((part, i) => {
    if (part.match(/^\{.+\}$/)) {
      return (
        <span key={i} className="text-[#007AFF] font-semibold bg-[#007AFF]/10 px-0.5 rounded">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function NudgeTemplateEditor() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchTemplates() {
    setError(null)
    const { data, error: err } = await supabase
      .from('message_templates')
      .select('*')
      .order('stage')
      .order('touch_number')
    if (err) {
      setError('Failed to load templates')
      setLoading(false)
      return
    }
    setTemplates((data || []) as MessageTemplate[])
    setLoading(false)
  }

  useEffect(() => { fetchTemplates() }, [])

  function toggleStage(stage: string) {
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  function startEdit(tpl: MessageTemplate) {
    setEditingId(tpl.id)
    setEditBody(tpl.body_template)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
  }

  async function saveEdit(slug: string) {
    setSaving(true)
    const { error: err } = await supabase
      .from('message_templates')
      .update({ body_template: editBody })
      .eq('slug', slug)
    if (err) {
      setError(`Failed to save: ${err.message}`)
    } else {
      setTemplates(prev =>
        prev.map(t => t.id === editingId ? { ...t, body_template: editBody } : t)
      )
      setSaveSuccess(editingId)
      setTimeout(() => setSaveSuccess(null), 2000)
    }
    setEditingId(null)
    setEditBody('')
    setSaving(false)
  }

  // Group by stage or category
  const grouped: Record<string, MessageTemplate[]> = {}
  for (const tpl of templates) {
    const key = tpl.stage || tpl.category || 'other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(tpl)
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a)
    const bi = STAGE_ORDER.indexOf(b)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#5856D6]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#5856D6]" />
          <h3 className="text-sm font-bold text-[#0b0707]/80">Nudge Templates</h3>
          <span className="text-[9px] text-[#3b3b3b]/40 bg-[#f5f2ed] px-2 py-0.5 rounded-full">
            {templates.length} templates
          </span>
        </div>
        <button
          onClick={() => { setLoading(true); fetchTemplates() }}
          className="flex items-center gap-1 text-[10px] text-[#3b3b3b]/50 hover:text-[#3b3b3b]/80 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-600">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      )}

      <div className="space-y-2">
        {sortedKeys.map(stageKey => {
          const meta = STAGE_META[stageKey] || { label: stageKey, color: '#8E8E93' }
          const tpls = grouped[stageKey]
          const isExpanded = expandedStages.has(stageKey)

          return (
            <div key={stageKey} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Stage header */}
              <button
                onClick={() => toggleStage(stageKey)}
                className="w-full flex items-center justify-between p-3 hover:bg-[#f5f2ed]/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-[#3b3b3b]/40" />
                    : <ChevronRight className="w-4 h-4 text-[#3b3b3b]/40" />
                  }
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <span className="text-xs font-bold text-[#0b0707]/70">{meta.label}</span>
                  <span className="text-[9px] text-[#3b3b3b]/30">{tpls.length} templates</span>
                </div>
                <div className="flex items-center gap-1">
                  {tpls.filter(t => t.is_active).length > 0 && (
                    <span className="text-[8px] font-bold text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded-full">
                      {tpls.filter(t => t.is_active).length} active
                    </span>
                  )}
                </div>
              </button>

              {/* Templates list */}
              {isExpanded && (
                <div className="border-t border-gray-50">
                  {tpls.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="border-b border-gray-50 last:border-b-0"
                    >
                      <div className="px-4 py-3">
                        {/* Template header */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[#5856D6] bg-[#5856D6]/10 px-1.5 py-0.5 rounded">
                              {tpl.slug}
                            </span>
                            <span className="text-[9px] text-[#3b3b3b]/30">
                              Wave {tpl.touch_number}
                            </span>
                            <span className="text-[9px] text-[#3b3b3b]/30">
                              Delay: {formatDelay(tpl.delay_minutes)}
                            </span>
                            {!tpl.is_active && (
                              <span className="text-[8px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">
                                inactive
                              </span>
                            )}
                          </div>
                          {editingId !== tpl.id && (
                            <button
                              onClick={() => startEdit(tpl)}
                              className="flex items-center gap-1 text-[10px] text-[#007AFF] hover:text-[#007AFF]/80 transition-colors"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                          )}
                          {saveSuccess === tpl.id && (
                            <div className="flex items-center gap-1 text-[10px] text-[#34C759]">
                              <Check className="w-3 h-3" />
                              Saved
                            </div>
                          )}
                        </div>

                        {/* Body */}
                        {editingId === tpl.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              dir="rtl"
                              className="w-full min-h-[100px] p-3 text-sm bg-[#f5f2ed] border border-[#efeff1] rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-[#5856D6]/30 focus:border-[#5856D6]/50
                                text-[#0b0707]/70 resize-y"
                              style={{ fontFamily: 'system-ui' }}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveEdit(tpl.slug)}
                                disabled={saving}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#5856D6] text-white text-[10px] font-semibold
                                  rounded-lg hover:bg-[#4a48c4] transition-colors disabled:opacity-50"
                              >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-[#3b3b3b]/60 text-[10px] font-semibold
                                  rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                              <span className="text-[8px] text-[#3b3b3b]/30 ml-2">
                                Variables: {'{name}'} {'{messages_scanned}'} {'{group_count}'} {'{lead_count}'} {'{payment_link}'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            dir="rtl"
                            className="text-xs text-[#0b0707]/60 leading-relaxed whitespace-pre-wrap bg-[#f5f2ed]/50 rounded-lg p-2.5"
                            style={{ fontFamily: 'system-ui' }}
                          >
                            {highlightVariables(tpl.body_template)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
