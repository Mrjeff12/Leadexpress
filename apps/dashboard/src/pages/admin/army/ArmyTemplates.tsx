import { useState } from 'react'
import { useI18n } from '../../../lib/i18n'
import { supabase } from '../../../lib/supabase'
import { useArmyTemplates, type ArmyTemplate } from '../../../hooks/useArmyData'
import {
  Plus, Loader2, Trash2, X, Eye, Megaphone, MessageCircleReply, HardHat, Pencil,
} from 'lucide-react'

const CATEGORIES = [
  { key: 'job_post', label: 'Job Posts', labelHe: 'פרסומי עבודה', color: '#2563eb', icon: Megaphone },
  { key: 'response', label: 'Responses', labelHe: 'תגובות', color: '#f59e0b', icon: MessageCircleReply },
  { key: 'contractor_promo', label: 'Contractor Promos', labelHe: 'פרסומי קבלנים', color: '#10b981', icon: HardHat },
] as const

const PLACEHOLDER_HINTS: Record<string, string[]> = {
  job_post: ['{profession}', '{city}', '{state}', '{price_range}', '{job_link}'],
  response: [],
  contractor_promo: ['{name}', '{experience_years}', '{rating}', '{completed_jobs}', '{city}', '{profile_link}'],
}

export default function ArmyTemplates() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [activeCategory, setActiveCategory] = useState<string>('job_post')
  const { templates, loading, refetch } = useArmyTemplates(activeCategory)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formBody, setFormBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  function openEditor(tpl?: ArmyTemplate) {
    if (tpl) {
      setEditingId(tpl.id)
      setFormName(tpl.name)
      setFormBody(tpl.body)
    } else {
      setEditingId(null)
      setFormName('')
      setFormBody('')
    }
    setPreviewMode(false)
    setEditorOpen(true)
  }

  async function handleSave() {
    if (!formName || !formBody) return
    setSaving(true)
    const placeholders = (formBody.match(/\{[^}]+\}/g) ?? [])
    const row = {
      category: activeCategory,
      name: formName,
      body: formBody,
      placeholders,
      is_active: true,
    }
    if (editingId) {
      await supabase.from('army_templates').update(row).eq('id', editingId)
    } else {
      await supabase.from('army_templates').insert(row)
    }
    setSaving(false)
    setEditorOpen(false)
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm(he ? 'למחוק תבנית?' : 'Delete template?')) return
    await supabase.from('army_templates').delete().eq('id', id)
    refetch()
  }

  async function handleToggle(id: string, current: boolean) {
    await supabase.from('army_templates').update({ is_active: !current }).eq('id', id)
    refetch()
  }

  const activeCat = CATEGORIES.find(c => c.key === activeCategory)!

  function renderPreview(body: string) {
    const examples: Record<string, string> = {
      '{profession}': 'Plumber', '{city}': 'Miami', '{state}': 'FL',
      '{price_range}': '$2,500 - $4,000', '{job_link}': 'masterlead.app/jobs/abc123',
      '{name}': 'Mike Johnson', '{experience_years}': '12', '{rating}': '4.9',
      '{completed_jobs}': '47', '{profile_link}': 'masterlead.app/pro/mike-johnson',
    }
    let result = body
    for (const [k, v] of Object.entries(examples)) result = result.replaceAll(k, v)
    return result
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Category tabs */}
      <div className="flex items-center gap-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const active = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: active ? `${cat.color}12` : 'transparent',
                color: active ? cat.color : '#3b3b3b60',
                border: `1px solid ${active ? `${cat.color}25` : 'transparent'}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {he ? cat.labelHe : cat.label}
            </button>
          )
        })}

        <div className="flex-1" />

        <button
          onClick={() => openEditor()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all"
          style={{ background: activeCat.color }}
        >
          <Plus className="w-3.5 h-3.5" />
          {he ? 'תבנית חדשה' : 'New Template'}
        </button>
      </div>

      {/* Placeholder hints */}
      {PLACEHOLDER_HINTS[activeCategory]?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-[#3b3b3b]/40 self-center">Placeholders:</span>
          {PLACEHOLDER_HINTS[activeCategory].map((p) => (
            <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#f5f2ed] text-[#3b3b3b]/60">
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Templates list */}
      <div className="space-y-3">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-2xl border border-[#efeff1] bg-white p-4 space-y-2"
            style={{ opacity: tpl.is_active ? 1 : 0.5 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0b0707]">{tpl.name}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => openEditor(tpl)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-all">
                  <Pencil className="w-3.5 h-3.5 text-[#3b3b3b]/40" />
                </button>
                <button onClick={() => handleToggle(tpl.id, tpl.is_active)} className="px-2 py-1 rounded-lg text-[10px] font-semibold hover:bg-gray-100 transition-all" style={{ color: tpl.is_active ? '#10b981' : '#ef4444' }}>
                  {tpl.is_active ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => handleDelete(tpl.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <pre className="text-[12px] text-[#3b3b3b]/70 whitespace-pre-wrap font-sans leading-relaxed">
              {tpl.body}
            </pre>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-12 text-sm text-[#3b3b3b]/30">
            {he ? 'אין תבניות עדיין' : 'No templates yet'}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                {editingId ? (he ? 'ערוך תבנית' : 'Edit Template') : (he ? 'תבנית חדשה' : 'New Template')}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold hover:bg-gray-100 transition-all"
                  style={{ color: previewMode ? activeCat.color : '#3b3b3b80' }}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
                <button onClick={() => setEditorOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={he ? 'שם התבנית' : 'Template name'}
                className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm focus:outline-none focus:border-red-300"
              />

              {previewMode ? (
                <div className="rounded-xl bg-[#dcf8c6] p-3 text-sm whitespace-pre-wrap min-h-[120px]">
                  {renderPreview(formBody)}
                </div>
              ) : (
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={6}
                  placeholder={he ? 'תוכן ההודעה...' : 'Message body...'}
                  className="w-full px-3 py-2 rounded-xl border border-[#efeff1] text-sm font-mono focus:outline-none focus:border-red-300 resize-none"
                />
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !formName || !formBody}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (he ? 'שמור' : 'Save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
