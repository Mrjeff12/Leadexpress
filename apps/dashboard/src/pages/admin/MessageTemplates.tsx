import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { MessageSquareText, Plus, X, Eye } from 'lucide-react'

type Channel = 'whatsapp' | 'telegram'

interface Template {
  id: string
  name: string
  channel: Channel
  body: string
  active: boolean
  updatedAt: string
}

const initialTemplates: Template[] = [
  { id: '1', name: 'New Lead Alert', channel: 'whatsapp', body: 'New {{lead_type}} lead in {{lead_location}}! Urgency: {{lead_urgency}}', active: true, updatedAt: '2026-03-15' },
  { id: '2', name: 'Welcome Message', channel: 'telegram', body: 'Welcome {{contractor_name}}! You are now receiving leads.', active: true, updatedAt: '2026-03-14' },
  { id: '3', name: 'Payment Reminder', channel: 'whatsapp', body: 'Hi {{contractor_name}}, your subscription payment is due.', active: false, updatedAt: '2026-03-10' },
]

const variables = ['{{contractor_name}}', '{{lead_type}}', '{{lead_location}}', '{{lead_urgency}}']

const exampleValues: Record<string, string> = {
  '{{contractor_name}}': 'David Cohen',
  '{{lead_type}}': 'HVAC',
  '{{lead_location}}': 'Tel Aviv',
  '{{lead_urgency}}': 'High',
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

  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formChannel, setFormChannel] = useState<Channel>('whatsapp')
  const [formBody, setFormBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  function openNewEditor() {
    setEditingId(null)
    setFormName('')
    setFormChannel('whatsapp')
    setFormBody('')
    setShowPreview(false)
    setEditorOpen(true)
  }

  function openEditEditor(template: Template) {
    setEditingId(template.id)
    setFormName(template.name)
    setFormChannel(template.channel)
    setFormBody(template.body)
    setShowPreview(false)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingId(null)
  }

  function handleSave() {
    if (!formName.trim() || !formBody.trim()) return

    if (editingId) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, name: formName, channel: formChannel, body: formBody, updatedAt: new Date().toISOString().slice(0, 10) }
            : t,
        ),
      )
    } else {
      const newTemplate: Template = {
        id: Date.now().toString(),
        name: formName,
        channel: formChannel,
        body: formBody,
        active: true,
        updatedAt: new Date().toISOString().slice(0, 10),
      }
      setTemplates((prev) => [newTemplate, ...prev])
    }
    closeEditor()
  }

  function toggleActive(id: string) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t)),
    )
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
            {he ? 'ניהול תבניות הודעות WhatsApp וטלגרם' : 'Manage WhatsApp & Telegram message templates'}
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

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3a2e' }}>
              {he ? 'ערוץ' : 'Channel'}
            </label>
            <select
              value={formChannel}
              onChange={(e) => setFormChannel(e.target.value as Channel)}
              className="w-full"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
            </select>
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
              disabled={!formName.trim() || !formBody.trim()}
              className="btn-primary"
            >
              {he ? 'שמור' : 'Save'}
            </button>
            <button onClick={closeEditor} className="btn-outline">
              {he ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Templates Table */}
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
                  {he ? 'ערוץ' : 'Channel'}
                </th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
                  {he ? 'סטטוס' : 'Status'}
                </th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6b7c6e' }}>
                  {he ? 'עודכן' : 'Last Edited'}
                </th>
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
                    <span className={template.channel === 'whatsapp' ? 'badge badge-green' : 'badge badge-blue'}>
                      {template.channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleActive(template.id)
                      }}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{ backgroundColor: template.active ? '#5a8a5e' : '#9ca89e' }}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                        style={{ transform: template.active ? 'translateX(24px)' : 'translateX(4px)' }}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-4" style={{ color: '#6b7c6e' }}>
                    {template.updatedAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
