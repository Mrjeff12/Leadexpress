import { useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { Wrench, Plus, Edit3, Trash2 } from 'lucide-react'

interface Profession {
  id: string
  nameEn: string
  nameHe: string
  color: string
  activeContractors: number
  enabled: boolean
}

const initialProfessions: Profession[] = [
  { id: '1', nameEn: 'HVAC', nameHe: 'מזגנים', color: 'hsl(205 85% 52%)', activeContractors: 12, enabled: true },
  { id: '2', nameEn: 'Renovation', nameHe: 'שיפוצים', color: 'hsl(28 90% 56%)', activeContractors: 8, enabled: true },
  { id: '3', nameEn: 'Fencing', nameHe: 'גדרות', color: 'hsl(262 68% 56%)', activeContractors: 5, enabled: true },
  { id: '4', nameEn: 'Garage Cleaning', nameHe: 'ניקוי גראז׳', color: 'hsl(160 50% 48%)', activeContractors: 3, enabled: true },
  { id: '5', nameEn: 'Plumbing', nameHe: 'אינסטלציה', color: 'hsl(190 70% 45%)', activeContractors: 0, enabled: false },
  { id: '6', nameEn: 'Electrical', nameHe: 'חשמל', color: 'hsl(45 90% 50%)', activeContractors: 0, enabled: false },
]

const colorPresets = [
  'hsl(205 85% 52%)', // Blue
  'hsl(28 90% 56%)',  // Orange
  'hsl(262 68% 56%)', // Purple
  'hsl(160 50% 48%)', // Teal
  'hsl(190 70% 45%)', // Cyan
  'hsl(45 90% 50%)',  // Yellow
  'hsl(340 75% 55%)', // Pink
  'hsl(155 44% 30%)', // Forest Green
]

export default function Professions() {
  const { locale } = useI18n()
  const he = locale === 'he'

  const [professions, setProfessions] = useState<Profession[]>(initialProfessions)
  const [nameEn, setNameEn] = useState('')
  const [nameHe, setNameHe] = useState('')
  const [selectedColor, setSelectedColor] = useState(colorPresets[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const resetForm = () => {
    setNameEn('')
    setNameHe('')
    setSelectedColor(colorPresets[0])
    setEditingId(null)
    setShowForm(false)
  }

  const handleSave = () => {
    if (!nameEn.trim() || !nameHe.trim()) return

    if (editingId) {
      setProfessions((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? { ...p, nameEn: nameEn.trim(), nameHe: nameHe.trim(), color: selectedColor }
            : p
        )
      )
    } else {
      const newProfession: Profession = {
        id: Date.now().toString(),
        nameEn: nameEn.trim(),
        nameHe: nameHe.trim(),
        color: selectedColor,
        activeContractors: 0,
        enabled: true,
      }
      setProfessions((prev) => [...prev, newProfession])
    }
    resetForm()
  }

  const handleEdit = (profession: Profession) => {
    setNameEn(profession.nameEn)
    setNameHe(profession.nameHe)
    setSelectedColor(profession.color)
    setEditingId(profession.id)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    setProfessions((prev) => prev.filter((p) => p.id !== id))
    if (editingId === id) resetForm()
  }

  const handleToggle = (id: string) => {
    setProfessions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    )
  }

  const totalActive = professions.filter((p) => p.enabled).length
  const totalContractors = professions.reduce((sum, p) => sum + p.activeContractors, 0)

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
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
            >
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
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
            >
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
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'rgba(90,138,94,0.1)' }}
            >
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

          {/* Color Picker */}
          <div className="mb-5">
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

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!nameEn.trim() || !nameHe.trim()}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
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
                  {/* Color Swatch */}
                  <td className="px-5 py-3.5">
                    <div
                      className="w-7 h-7 rounded-lg"
                      style={{ backgroundColor: profession.color }}
                    />
                  </td>
                  {/* Icon */}
                  <td className="px-5 py-3.5">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ backgroundColor: profession.color + '1a' }}
                    >
                      <Wrench className="h-4 w-4" style={{ color: profession.color }} />
                    </div>
                  </td>
                  {/* Name EN */}
                  <td className="px-5 py-3.5 font-medium" style={{ color: '#2d3a2e' }}>
                    {profession.nameEn}
                  </td>
                  {/* Name HE */}
                  <td className="px-5 py-3.5 font-medium" dir="rtl" style={{ color: '#2d3a2e' }}>
                    {profession.nameHe}
                  </td>
                  {/* Active Contractors */}
                  <td className="px-5 py-3.5" style={{ color: '#6b7c6e' }}>
                    {profession.activeContractors}
                  </td>
                  {/* Status Toggle */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggle(profession.id)}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: profession.enabled ? '#5a8a5e' : '#d1d5db',
                      }}
                      aria-label={profession.enabled ? 'Disable' : 'Enable'}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm"
                        style={{
                          transform: profession.enabled ? 'translateX(22px)' : 'translateX(4px)',
                        }}
                      />
                    </button>
                  </td>
                  {/* Actions */}
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
