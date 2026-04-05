import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { MessageSquareText, Plus, X, Eye, Loader2, AlertCircle, Trash2 } from 'lucide-react'

type Channel = 'whatsapp'

interface Template {
  id: string
  name: string
  touch_number: number
  category: string
  body_template: string
  language: string
  is_active: boolean
  send_count: number
  reply_count: number
  created_at: string
}

const variables = ['{{contractor_name}}', '{{lead_type}}', '{{lead_location}}', '{{lead_urgency}}', '{name}', '{group_name}', '{lead_count}', '{contractor_count}']

const exampleValues: Record<string, string> = {
  '{{contractor_name}}': 'David Cohen',
  '{{lead_type}}': 'HVAC',
  '{{lead_location}}': 'Miami, FL',
  '{{lead_urgency}}': 'High',
  '{name}': 'David Cohen',
  '{group_name}': 'Florida Contractors',
  '{lead_count}': '12',
  '{contractor_count}': '45',
}

function renderPreview(body: string): string {
  let result = body
  for (const [key, value] of Object.entries(exampleValues)) {
    result = result.replaceAll(key, value)
  }
  return result
}

export default function MessageTemplates() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('custom')
  const [formTouchNumber, setFormTouchNumber] = useState(1)
  const [formLanguage, setFormLanguage] = useState('en')
  const [formBody, setFormBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setTemplates(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  function openNewEditor() {
    setEditingId(null)
    setFormName('')
    setFormCategory('custom')
    setFormTouchNumber(1)
    setFormLanguage('en')
    setFormBody('')
    setShowPreview(false)
    setEditorOpen(true)
  }

  function openEditEditor(template: Template) {
    setEditingId(template.id)
    setFormName(template.name)
    setFormCategory(template.category)
    setFormTouchNumber(template.touch_number)
    setFormLanguage(template.language)
    setFormBody(template.body_template)
    setShowPreview(false)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingId(null)
  }

  async function handleSave() {
    if (!formName.trim() || !formBody.trim()) return
    setSaving(true)
    setError(null)

    if (editingId) {
      const { error: err } = await supabase
        .from('message_templates')
        .update({
          name: formName,
          category: formCategory,
          touch_number: formTouchNumber,
          language: formLanguage,
          body_template: formBody,
        })
        .eq('id', editingId)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase
        .from('message_templates')
        .insert({
          name: formName,
          category: formCategory,
          touch_number: formTouchNumber,
          language: formLanguage,
          body_template: formBody,
          is_active: true,
        })
      if (err) { setError(err.message); setSaving(false); return }
    }
    setSaving(false)
    closeEditor()
    fetchTemplates()
  }

  async function toggleActive(id: string, currentActive: boolean) {
    const { error: err } = await supabase
      .from('message_templates')
      .update({ is_active: !currentActive })
      .eq('id', id)
    if (err) { setError(err.message); return }
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: !t.is_active } : t)),
    )
  }

  async function handleDelete(id: string) {
    if (!confirm(he ? 'למחוק תבנית זו?' : 'Delete this template?')) return
    const { error: err } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id)
    if (err) { setError(err.message); return }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  function insertVariable(variable: string) {
    setFormBody((prev) => prev + variable)
  }

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
            {he ? 'תבניות הודעות' : 'Message Templates'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
            {he ? 'ניהול תבניות הודעות WhatsApp' : 'Manage WhatsApp message templates'}
          </p>
        </div>
        <button
          onClick={openNewEditor}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {he ? 'תבנית חדשה' : 'New Template'}
        </button>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="glass-panel p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(220,38,38,0.05)', borderColor: '#fca5a5' }}>
          <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto btn-ghost p-1">
            <X className="h-4 w-4" style={{ color: '#dc2626' }} />
          </button>
        </div>
      )}

      {/* Editor Panel */}
      {editorOpen && (
        <div className="glass-panel p-6 animate-fade-in space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
              {editingId
                ? (he ? 'עריכת תבנית' : 'Edit Template')
                : (he ? 'תבנית חדשה' : 'New Template')}
            </h2>
            <button onClick={closeEditor} className="btn-ghost p-1.5 rounded-xl">
              <X className="h-5 w-5" style={{ color: '#6b7c6e' }} />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
              {he ? 'שם התבנית' : 'Template Name'}
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={he ? 'לדוגמה: התראת ליד חדש' : 'e.g. New Lead Alert'}
              className="w-full"
            />
          </div>

          {/* Category + Touch Number + Language */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
                {he ? 'קטגוריה' : 'Category'}
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full"
              >
                <option value="first_touch">First Touch</option>
                <option value="follow_up">Follow Up</option>
                <option value="reactivation">Reactivation</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
                {he ? 'מספר נגיעה' : 'Touch Number'}
              </label>
              <input
                type="number"
                min={1}
                value={formTouchNumber}
                onChange={(e) => setFormTouchNumber(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
                {he ? 'שפה' : 'Language'}
              </label>
              <select
                value={formLanguage}
                onChange={(e) => setFormLanguage(e.target.value)}
                className="w-full"
              >
                <option value="en">English</option>
                <option value="he">Hebrew</option>
              </select>
            </div>
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
              {he ? 'תוכן ההודעה' : 'Message Body'}
            </label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={4}
              placeholder={he ? 'כתוב את תוכן ההודעה כאן...' : 'Write your message content here...'}
              className="w-full resize-none"
            />
          </div>

          {/* Variable Buttons */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#6b7c6e' }}>
              {he ? 'הוסף משתנה' : 'Insert Variable'}
            </label>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="btn-outline px-3 py-1.5 text-xs"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="btn-ghost inline-flex items-center gap-2 text-sm"
              style={{ color: '#5a8a5e' }}
            >
              <Eye className="h-4 w-4" />
              {showPreview
                ? (he ? 'הסתר תצוגה מקדימה' : 'Hide Preview')
                : (he ? 'תצוגה מקדימה' : 'Show Preview')}
            </button>
            {showPreview && (
              <div
                className="mt-3 rounded-xl p-4 text-sm whitespace-pre-wrap"
                style={{ backgroundColor: '#f0f4f1', color: '#2d3a2e', border: '1px solid #e0e5e1' }}
              >
                {formBody.trim()
                  ? renderPreview(formBody)
                  : (he ? 'אין תוכן להצגה' : 'No content to preview')}
              </div>
            )}
          </div>

          {/* Save / Cancel */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!formName.trim() || !formBody.trim() || saving}
              className="btn-primary inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {he ? 'שמור' : 'Save'}
            </button>
            <button onClick={closeEditor} className="btn-outline">
              {he ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="glass-panel p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: '#5a8a5e' }} />
          <p className="text-sm" style={{ color: '#6b7c6e' }}>{he ? 'טוען תבניות...' : 'Loading templates...'}</p>
        </div>
      )}

      {/* Templates Table */}
      {!loading && (
        <div className="glass-panel overflow-hidden">
          {templates.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <MessageSquareText className="h-12 w-12 mb-4" style={{ color: '#b0b8b1' }} />
              <h2 className="text-lg font-semibold" style={{ color: '#2d3a2e' }}>
                {he ? 'אין תבניות' : 'No Templates'}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#6b7c6e' }}>
                {he ? 'צור תבנית חדשה כדי להתחיל' : 'Create a new template to get started'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#f8faf8' }}>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
                    {he ? 'שם' : 'Name'}
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
                    {he ? 'קטגוריה' : 'Category'}
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
                    {he ? 'שפה' : 'Language'}
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
                    {he ? 'סטטוס' : 'Status'}
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
                    {he ? 'נשלחו / תגובות' : 'Sent / Replies'}
                  </th>
                  <th className="px-5 py-3.5 w-16" />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr
                    key={template.id}
                    className="border-t cursor-pointer transition-colors hover:bg-[#f8faf8]"
                    style={{ borderColor: '#eef0ee' }}
                    onClick={() => openEditEditor(template)}
                  >
                    <td className="px-5 py-4 font-medium" style={{ color: '#2d3a2e' }}>
                      {template.name}
                    </td>
                    <td className="px-5 py-4">
                      <span className="badge badge-blue">
                        {template.category}
                      </span>
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6b7c6e' }}>
                      {template.language === 'he' ? 'Hebrew' : 'English'}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleActive(template.id, template.is_active)
                        }}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                        style={{ backgroundColor: template.is_active ? '#5a8a5e' : '#9ca89e' }}
                      >
                        <span
                          className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                          style={{ transform: template.is_active ? 'translateX(24px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6b7c6e' }}>
                      {template.send_count} / {template.reply_count}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(template.id)
                        }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[#fde8e8]"
                        aria-label={he ? 'מחיקה' : 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" style={{ color: '#dc2626' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
