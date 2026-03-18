import { useState, useEffect } from 'react'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { Wrench, Plus, Edit3, Trash2, Loader2 } from 'lucide-react'

interface Profession {
  id: string
  name_en: string
  name_he: string
  emoji: string
  color: string
  is_active: boolean
  sort_order: number
}

const colorPresets = [
  'hsl(205 85% 52%)',
  'hsl(28 90% 56%)',
  'hsl(262 68% 56%)',
  'hsl(160 50% 48%)',
  'hsl(190 70% 45%)',
  'hsl(45 90% 50%)',
  'hsl(340 75% 55%)',
  'hsl(14 99% 57%)',
]

export default function Professions() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [professions, setProfessions] = useState<Profession[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contractorCounts, setContractorCounts] = useState<Record<string, number>>({})

  // Form state
  const [formId, setFormId] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameHe, setNameHe] = useState('')
  const [emoji, setEmoji] = useState('🔧')
  const [selectedColor, setSelectedColor] = useState(colorPresets[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Fetch professions from DB
  useEffect(() => {
    async function fetchData() {
      const [profRes, contractorsRes] = await Promise.all([
        supabase
          .from('professions')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .from('contractors')
          .select('professions')
          .eq('is_active', true),
      ])

      if (profRes.data) setProfessions(profRes.data)

      // Count contractors per profession
      if (contractorsRes.data) {
        const counts: Record<string, number> = {}
        for (const c of contractorsRes.data) {
          for (const p of (c.professions as string[])) {
            counts[p] = (counts[p] ?? 0) + 1
          }
        }
        setContractorCounts(counts)
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const resetForm = () => {
    setFormId('')
    setNameEn('')
    setNameHe('')
    setEmoji('🔧')
    setSelectedColor(colorPresets[0])
    setEditingId(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!nameEn.trim() || !nameHe.trim()) return
    setSaving(true)

    const id = editingId ?? formId.trim().toLowerCase().replace(/\s+/g, '_')
    if (!id) { setSaving(false); return }

    const record = {
      id,
      name_en: nameEn.trim(),
      name_he: nameHe.trim(),
      emoji,
      color: selectedColor,
      is_active: true,
      sort_order: editingId
        ? professions.find(p => p.id === editingId)?.sort_order ?? professions.length
        : professions.length + 1,
    }

    const { error } = await supabase
      .from('professions')
      .upsert(record, { onConflict: 'id' })

    if (!error) {
      if (editingId) {
        setProfessions(prev => prev.map(p => p.id === editingId ? { ...p, ...record } : p))
      } else {
        setProfessions(prev => [...prev, record])
      }
      resetForm()
    }
    setSaving(false)
  }

  const handleEdit = (profession: Profession) => {
    setFormId(profession.id)
    setNameEn(profession.name_en)
    setNameHe(profession.name_he)
    setEmoji(profession.emoji)
    setSelectedColor(profession.color)
    setEditingId(profession.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    const count = contractorCounts[id] ?? 0
    if (count > 0) {
      alert(he
        ? `לא ניתן למחוק — ${count} קבלנים משויכים למקצוע זה`
        : `Cannot delete — ${count} contractors are assigned to this profession`)
      return
    }

    const { error } = await supabase.from('professions').delete().eq('id', id)
    if (!error) {
      setProfessions(prev => prev.filter(p => p.id !== id))
      if (editingId === id) resetForm()
    }
  }

  const handleToggle = async (id: string) => {
    const profession = professions.find(p => p.id === id)
    if (!profession) return

    const { error } = await supabase
      .from('professions')
      .update({ is_active: !profession.is_active })
      .eq('id', id)

    if (!error) {
      setProfessions(prev =>
        prev.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p)
      )
    }
  }

  const totalActive = professions.filter(p => p.is_active).length
  const totalContractors = Object.values(contractorCounts).reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#5a8a5e' }} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#2d3a2e' }}>
            {he ? 'מקצועות' : 'Professions'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#6b7c6e' }}>
            {he ? 'ניהול מקצועות זמינים' : 'Manage available professions'}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {he ? 'הוסף מקצוע' : 'Add Profession'}
          </button>
        )}
      </header>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 stagger-kpi">
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}>
              <Wrench className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>{professions.length}</p>
              <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
                {he ? 'סה"כ מקצועות' : 'Total Professions'}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}>
              <Wrench className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>{totalActive}</p>
              <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
                {he ? 'מקצועות פעילים' : 'Active Professions'}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}>
              <Wrench className="h-5 w-5" style={{ color: '#5a8a5e' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#2d3a2e' }}>{totalContractors}</p>
              <p className="text-xs font-medium" style={{ color: '#9ca89e' }}>
                {he ? 'קבלנים משויכים' : 'Assigned Contractors'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="glass-panel p-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#2d3a2e' }}>
            {editingId
              ? (he ? 'עריכת מקצוע' : 'Edit Profession')
              : (he ? 'הוספת מקצוע חדש' : 'Add New Profession')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {!editingId && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca89e' }}>
                  ID (slug)
                </label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="e.g. plumbing"
                  className="w-full rounded-xl border text-sm py-2 px-3"
                  style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca89e' }}>
                {he ? 'שם באנגלית' : 'English Name'}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder={he ? 'לדוגמה: Plumbing' : 'e.g. Plumbing'}
                className="w-full rounded-xl border text-sm py-2 px-3"
                style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9ca89e' }}>
                {he ? 'שם בעברית' : 'Hebrew Name'}
              </label>
              <input
                type="text"
                value={nameHe}
                onChange={(e) => setNameHe(e.target.value)}
                placeholder={he ? 'לדוגמה: אינסטלציה' : 'e.g. אינסטלציה'}
                className="w-full rounded-xl border text-sm py-2 px-3"
                dir="rtl"
                style={{ borderColor: '#e0e4e0', color: '#2d3a2e', fontFamily: 'Outfit, sans-serif' }}
              />
            </div>
          </div>

          {/* Emoji + Color Picker */}
          <div className="flex gap-6 mb-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9ca89e' }}>
                Emoji
              </label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-16 text-center text-2xl rounded-xl border py-1.5"
                style={{ borderColor: '#e0e4e0' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9ca89e' }}>
                {he ? 'צבע' : 'Color'}
              </label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className="w-9 h-9 rounded-xl transition-all"
                    style={{
                      backgroundColor: color,
                      outline: selectedColor === color ? '3px solid #2d3a2e' : '2px solid transparent',
                      outlineOffset: '2px',
                      transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                    }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!nameEn.trim() || !nameHe.trim() || (!editingId && !formId.trim()) || saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingId
                ? (he ? 'שמור שינויים' : 'Save Changes')
                : (he ? 'הוסף מקצוע' : 'Add Profession')}
            </button>
            <button onClick={resetForm} className="btn-ghost">
              {he ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Professions Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-sticky">
            <thead>
              <tr style={{ borderBottom: '1px solid #e0e4e0' }}>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'צבע' : 'Color'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'אייקון' : 'Icon'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'שם (EN)' : 'Name (EN)'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'שם (HE)' : 'Name (HE)'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'קבלנים פעילים' : 'Active Contractors'}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#9ca89e' }}>
                  {he ? 'סטטוס' : 'Status'}
                </th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {professions.map((profession) => (
                <tr
                  key={profession.id}
                  className="transition-colors hover:bg-[#f5f7f5]"
                  style={{ borderBottom: '1px solid #eef0ee' }}
                >
                  <td className="px-5 py-3.5">
                    <div className="w-7 h-7 rounded-lg" style={{ backgroundColor: profession.color }} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg text-lg">
                      {profession.emoji}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                    {profession.name_en}
                  </td>
                  <td className="px-5 py-3.5 font-medium" dir="rtl" style={{ color: '#2d3a2e' }}>
                    {profession.name_he}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                    {contractorCounts[profession.id] ?? 0}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggle(profession.id)}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{ backgroundColor: profession.is_active ? '#5a8a5e' : '#d1d5db' }}
                      aria-label={profession.is_active ? 'Disable' : 'Enable'}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm"
                        style={{ transform: profession.is_active ? 'translateX(22px)' : 'translateX(4px)' }}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(profession)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[#eef0ee]"
                        aria-label={he ? 'עריכה' : 'Edit'}
                      >
                        <Edit3 className="h-4 w-4" style={{ color: '#6b7c6e' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(profession.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[#fde8e8]"
                        aria-label={he ? 'מחיקה' : 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" style={{ color: '#dc2626' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {professions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center" style={{ color: '#9ca89e' }}>
                    <Wrench className="h-10 w-10 mx-auto mb-3" style={{ color: '#b0b8b1' }} />
                    <p className="text-sm">
                      {he ? 'אין מקצועות עדיין' : 'No professions yet'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
